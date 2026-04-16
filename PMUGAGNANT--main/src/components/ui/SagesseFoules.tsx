"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

type VoteRow = { cheval_num: number; count: number };

type SagesseFoulesProps = {
  raceId: string;
  raceLabel: string;
};

function voterStorageKey(raceId: string) {
  return `pmu-community-vote-${raceId}`;
}

export function SagesseFoules({ raceId, raceLabel }: SagesseFoulesProps) {
  const formId = useId();
  const [rows, setRows] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community-picks?race_id=${encodeURIComponent(raceId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.rows)) {
        setRows(data.rows);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [raceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);

  async function submitVote(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(num, 10);
    if (!Number.isFinite(n) || n < 1 || n > 99) {
      setMessage("Numéro invalide");
      return;
    }
    if (typeof window !== "undefined") {
      const prev = window.localStorage.getItem(voterStorageKey(raceId));
      if (prev) {
        setMessage("Tu as déjà voté pour ce Quinté.");
        return;
      }
    }
    setMessage(null);
    try {
      const res = await fetch("/api/community-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race_id: raceId, cheval_num: n }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage(typeof data.error === "string" ? data.error : "Vote impossible");
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(voterStorageKey(raceId), String(n));
      }
      setNum("");
      void load();
    } catch {
      setMessage("Erreur réseau");
    }
  }

  return (
    <section className="app-card p-5 md:p-6">
      <p className="app-kicker">👥 CONSENSUS COMMUNAUTÉ</p>
      <h2 className="app-section-title mt-1">Ce que pensent les turfistes</h2>
      <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">Quinté du jour : {raceLabel}</p>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--pmu-text-muted)]">Chargement…</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.slice(0, 3).map((r, i) => (
            <li key={r.cheval_num} className="flex items-center gap-3">
              <span className="w-6 font-black text-[var(--pmu-primary)]">{i + 1}.</span>
              <span className="min-w-[4rem] font-bold text-[var(--pmu-text)]">N°{r.cheval_num}</span>
              <div className="min-w-0 flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
                  <div
                    className="h-full bg-[var(--pmu-accent-blue)]"
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--pmu-text-muted)]">
                {r.count} votes
              </span>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="text-sm text-[var(--pmu-text-soft)]">Aucun vote encore — sois le premier.</li>
          ) : null}
        </ol>
      )}

      <form id={formId} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={submitVote}>
        <label className="flex flex-1 flex-col gap-1 text-xs font-bold text-[var(--pmu-text-muted)]">
          Ton cheval (n°)
          <input
            type="number"
            min={1}
            max={99}
            value={num}
            onChange={(e) => setNum(e.target.value)}
            className="app-input"
            placeholder="ex. 7"
          />
        </label>
        <button type="submit" className="app-button-primary shrink-0">
          Donner mon avis →
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-[var(--pmu-orange)]">{message}</p> : null}
    </section>
  );
}
