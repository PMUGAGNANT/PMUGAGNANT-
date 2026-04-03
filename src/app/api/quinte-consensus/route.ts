import { NextRequest, NextResponse } from "next/server";
import { analyzeRaceWithParameters } from "@/lib/analysis";
import { attachFaultRates } from "@/lib/horse-faults";
import { loadAlgoParameters } from "@/lib/config";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { normalizeRequestedDate, parsePositiveInteger } from "@/lib/request-utils";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { RaceSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const CACHE_HOURS = 6;

type CachePayload = {
  pmuGagnant: string;
  chatgpt: string;
  gemini: string;
  consensus: string;
  demo: boolean;
};

function formatLine(nums: number[]): string {
  return nums.slice(0, 5).join("-");
}

function parseLineFromText(text: string): number[] {
  const raw = text.match(/\b([1-9]\d?)\b/g)?.map((x) => Number.parseInt(x, 10)) ?? [];
  const out: number[] = [];
  for (const n of raw) {
    if (n >= 1 && n <= 99 && !out.includes(n)) out.push(n);
    if (out.length >= 5) break;
  }
  return out;
}

function consensusMessage(a: number[], b: number[], c: number[]): string {
  const lists = [a, b, c].filter((l) => l.length === 5);
  if (lists.length === 0) {
    return "Consensus : données insuffisantes pour croiser les tickets.";
  }
  const first = lists[0];
  const inAll = first.filter((n) => lists.every((l) => l.includes(n)));
  if (inAll.length > 0) {
    return `Consensus : N°${inAll.join(", N°")} dans tous les tickets → BASES CONFIRMÉES ✅`;
  }
  const freq = new Map<number, number>();
  for (const l of lists) {
    for (const n of l) freq.set(n, (freq.get(n) ?? 0) + 1);
  }
  const top = [...freq.entries()]
    .filter(([, v]) => v >= 2)
    .sort((x, y) => y[1] - x[1] || x[0] - y[0])
    .slice(0, 4)
    .map(([n]) => n);
  if (top.length === 0) {
    return "Peu de recoupement entre les modèles — rester sur le ticket PMU Gagnant.";
  }
  return `Consensus : N°${top.join(", N°")} reviennent dans plusieurs listes → BASES À CONFIRMER ✅`;
}

async function openAiQuinte(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_QUINTE_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: `${prompt}\nRéponds uniquement par 5 numéros de chevaux séparés par des tirets, ex: 3-7-9-2-5. Rien d'autre.`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

async function geminiQuinte(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\nRéponds uniquement par 5 numéros séparés par des tirets.` }] }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = normalizeRequestedDate(searchParams.get("date"), getTodayDateStr());
  if (!date) {
    return NextResponse.json({ success: false, error: "Date invalide." }, { status: 400 });
  }
  const reunion = parsePositiveInteger(searchParams.get("reunion"));
  const course = parsePositiveInteger(searchParams.get("course"));
  if (reunion == null || course == null) {
    return NextResponse.json({ success: false, error: "Les paramètres `reunion` et `course` sont requis." }, { status: 400 });
  }

  const raceKey = `${date}-${reunion}-${course}`;
  const admin = getSupabaseAdminClient();
  const now = Date.now();

  if (admin) {
    const { data: cached } = await admin
      .from("quinte_ai_cache")
      .select("payload, expires_at")
      .eq("race_key", raceKey)
      .maybeSingle();
    if (cached?.payload && cached.expires_at) {
      const exp = new Date(String(cached.expires_at)).getTime();
      if (exp > now) {
        const p = cached.payload as CachePayload;
        return NextResponse.json({ success: true, ...p });
      }
    }
  }

  let pmuNums: number[] = [];
  try {
    const races = await getAllRaces(date);
    const race = races.find((r) => r.reunion === reunion && r.course === course) as RaceSummary | undefined;
    if (!race) {
      throw new Error("Course introuvable.");
    }
    const participants = await attachFaultRates(await getParticipants(date, reunion, course));
    const algo = await loadAlgoParameters();
    const analysis = analyzeRaceWithParameters(race, participants, algo);
    pmuNums = analysis.ranking.slice(0, 5).map((r) => r.numPmu);
  } catch {
    pmuNums = [3, 7, 9, 2, 5];
  }

  const pmuGagnant = formatLine(pmuNums);
  const ctx = `Quinté PMU du ${date} R${reunion}C${course}. Chevaux partants (top moteur): ${pmuGagnant}.`;

  let chatgptText = "7-3-5-9-1";
  let geminiText = "9-3-7-5-2";
  let demo = true;

  const extChat = await openAiQuinte(ctx);
  if (extChat) {
    const p = parseLineFromText(extChat);
    if (p.length === 5) {
      chatgptText = formatLine(p);
      demo = false;
    }
  }

  const extGem = await geminiQuinte(ctx);
  if (extGem) {
    const p = parseLineFromText(extGem);
    if (p.length === 5) {
      geminiText = formatLine(p);
      demo = false;
    }
  }

  const a = pmuNums.length === 5 ? pmuNums : parseLineFromText(pmuGagnant);
  const b = parseLineFromText(chatgptText);
  const c = parseLineFromText(geminiText);
  const consensus = consensusMessage(
    a.length === 5 ? a : parseLineFromText(pmuGagnant),
    b.length === 5 ? b : parseLineFromText("7-3-5-9-1"),
    c.length === 5 ? c : parseLineFromText("9-3-7-5-2")
  );

  const payload: CachePayload = {
    pmuGagnant,
    chatgpt: chatgptText,
    gemini: geminiText,
    consensus,
    demo,
  };

  if (admin) {
    const expires = new Date(now + CACHE_HOURS * 3600_000).toISOString();
    await admin.from("quinte_ai_cache").upsert({
      race_key: raceKey,
      payload,
      expires_at: expires,
    });
  }

  return NextResponse.json({ success: true, ...payload });
}
