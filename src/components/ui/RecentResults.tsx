"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateToPmu, getTodayDateStr, parsePmuDate } from "@/lib/date-utils";

function addDaysPmu(dateStr: string, diff: number): string {
  const date = parsePmuDate(dateStr);
  date.setUTCDate(date.getUTCDate() + diff);
  return formatDateToPmu(date);
}
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type BetRow = {
  id: string;
  date_str: string;
  reunion: number;
  course: number;
  hippodrome: string;
  cheval_num: number;
  cheval_nom: string;
  cote: number;
  statut: string;
  gain: number | null;
  mise: number;
};

function dayLabelForPmuDate(dateStr: string): string {
  const today = getTodayDateStr();
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === addDaysPmu(today, -1)) return "Hier";
  if (dateStr === addDaysPmu(today, -2)) return "Avant-hier";
  const d = parsePmuDate(dateStr);
  const diff = Math.round((parsePmuDate(today).getTime() - d.getTime()) / 86400000);
  if (diff === 3) return "Il y a 3j";
  if (diff > 3 && diff < 7) return `Il y a ${diff}j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
}

function outcomeLabel(statut: string): { text: string; className: string } {
  if (statut === "GAGNE") return { text: "GAGNÉ ✅", className: "text-emerald-500" };
  if (statut === "PLACE") return { text: "PLACÉ ✅", className: "text-emerald-500" };
  if (statut === "PERDU") return { text: "PERDU ❌", className: "text-red-500" };
  return { text: "⏳ Attente", className: "text-[var(--pmu-text-muted)]" };
}

function weekRoiPct(bets: BetRow[]): number | null {
  const now = parsePmuDate(getTodayDateStr());
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const startStr = formatDateToPmu(weekStart);
  const slice = bets.filter((b) => b.date_str >= startStr);
  const invested = slice.reduce((s, b) => s + (Number.isFinite(b.mise) ? b.mise : 0), 0);
  if (invested <= 0) return null;
  const returned = slice.reduce((s, b) => s + (b.gain != null && Number.isFinite(b.gain) ? b.gain : 0), 0);
  return ((returned - invested) / invested) * 100;
}

export function RecentResults() {
  const [bets, setBets] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setBets([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setBets([]);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/bets", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Historique indisponible");
      }
      const raw = Array.isArray(payload.bets) ? payload.bets : [];
      setBets(
        raw.map((b: Record<string, unknown>) => ({
          id: String(b.id ?? ""),
          date_str: String(b.date_str ?? ""),
          reunion: Number(b.reunion ?? 0),
          course: Number(b.course ?? 0),
          hippodrome: String(b.hippodrome ?? ""),
          cheval_num: Number(b.cheval_num ?? 0),
          cheval_nom: String(b.cheval_nom ?? ""),
          cote: Number(b.cote ?? 0),
          statut: String(b.statut ?? ""),
          gain: b.gain == null ? null : Number(b.gain),
          mise: Number(b.mise ?? 0),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayRows = useMemo(() => bets.slice(0, 5), [bets]);
  const roi = useMemo(() => weekRoiPct(bets), [bets]);

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading mb-4">
        <div>
          <p className="app-kicker">📊 RÉSULTATS RÉCENTS</p>
          <h2 className="app-section-title mt-1">Transparence totale</h2>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--pmu-text-muted)]" role="status">
          Chargement…
        </p>
      ) : error ? (
        <p className="text-sm text-[var(--pmu-text-soft)]">{error}</p>
      ) : displayRows.length === 0 ? (
        <p className="text-sm text-[var(--pmu-text-soft)]">
          Connecte-toi et joue un ticket pour afficher tes 5 derniers résultats ici.
        </p>
      ) : (
        <ul className="space-y-3">
          {displayRows.map((b) => {
            const o = outcomeLabel(b.statut);
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--pmu-border)] pb-3 text-sm last:border-0 last:pb-0"
              >
                <span className="w-24 shrink-0 font-semibold text-[var(--pmu-text-muted)]">
                  {dayLabelForPmuDate(b.date_str)}
                </span>
                <span className="min-w-0 flex-1 font-bold text-[var(--pmu-text)]">
                  R{b.reunion}C{b.course} · N{b.cheval_num} {b.cheval_nom}
                </span>
                <span className="tabular-nums text-[var(--pmu-text-soft)]">Cote {b.cote}</span>
                <span className={`shrink-0 font-black ${o.className}`}>{o.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      {roi != null && displayRows.length > 0 ? (
        <p className="mt-5 text-lg font-black text-[var(--pmu-text)]">
          ROI cette semaine : {roi >= 0 ? "+" : ""}
          {roi.toFixed(0)}% {roi >= 0 ? "📈" : "📉"}
        </p>
      ) : null}
    </section>
  );
}
