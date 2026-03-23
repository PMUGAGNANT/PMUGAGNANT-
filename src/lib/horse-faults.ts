import { getSupabaseAdminClient } from "@/lib/supabase";
import type { ChevalFaultRow, Participant } from "@/lib/types";

function normalizeHorseName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function computeFaultRateFromMusic(music: string) {
  const tokens = Array.from(music ?? "").filter((char) => /\d|D|a/.test(char)).slice(-10);
  if (tokens.length === 0) {
    return { tauxFaute: 0, dqCount: 0, sampleSize: 0 };
  }

  const dqCount = tokens.filter((token) => token === "D").length;
  return {
    tauxFaute: dqCount / tokens.length,
    dqCount,
    sampleSize: tokens.length,
  };
}

export async function attachFaultRates(participants: Participant[]): Promise<Participant[]> {
  const admin = getSupabaseAdminClient();
  if (!admin || participants.length === 0) {
    return participants.map((participant) => {
      const derived = computeFaultRateFromMusic(participant.musique);
      return {
        ...participant,
        tauxFaute: participant.tauxFaute ?? derived.tauxFaute,
      };
    });
  }

  const normalizedNames = Array.from(
    new Set(participants.map((participant) => normalizeHorseName(participant.nom)))
  );

  const { data } = await admin
    .from("chevaux")
    .select("cheval_nom,taux_faute")
    .in("cheval_nom", normalizedNames);

  const map = new Map<string, number>();
  for (const row of (data ?? []) as Pick<ChevalFaultRow, "cheval_nom" | "taux_faute">[]) {
    map.set(row.cheval_nom, row.taux_faute);
  }

  return participants.map((participant) => {
    const normalized = normalizeHorseName(participant.nom);
    const derived = computeFaultRateFromMusic(participant.musique);
    return {
      ...participant,
      tauxFaute: participant.tauxFaute ?? map.get(normalized) ?? derived.tauxFaute,
    };
  });
}

export async function upsertFaultRates(participants: Participant[]): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin || participants.length === 0) {
    return;
  }

  const rows = participants.map((participant) => {
    const computed = computeFaultRateFromMusic(participant.musique);
    return {
      cheval_nom: normalizeHorseName(participant.nom),
      taux_faute: Number((participant.tauxFaute ?? computed.tauxFaute).toFixed(4)),
      dq_count: computed.dqCount,
      sample_size: computed.sampleSize,
      updated_at: new Date().toISOString(),
    };
  });

  await admin.from("chevaux").upsert(rows, { onConflict: "cheval_nom" });
}

export { normalizeHorseName };
