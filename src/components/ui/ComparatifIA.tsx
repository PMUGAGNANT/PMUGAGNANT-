"use client";

import { useEffect, useState } from "react";

export type ComparatifIAProps = {
  dateStr: string;
  reunion: number;
  course: number;
  nomCourse: string;
};

type ConsensusPayload = {
  pmuGagnant: string;
  chatgpt: string;
  gemini: string;
  consensus: string;
  demo?: boolean;
};

export function ComparatifIA({ dateStr, reunion, course, nomCourse }: ComparatifIAProps) {
  const [data, setData] = useState<ConsensusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const qs = new URLSearchParams({
          date: dateStr,
          reunion: String(reunion),
          course: String(course),
        });
        const res = await fetch(`/api/quinte-consensus?${qs.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || "Erreur");
        setData({
          pmuGagnant: json.pmuGagnant,
          chatgpt: json.chatgpt,
          gemini: json.gemini,
          consensus: json.consensus,
          demo: json.demo === true,
        });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [dateStr, reunion, course]);

  return (
    <section className="app-card p-5 md:p-6">
      <p className="app-kicker">🤖 QUE DISENT LES IA ?</p>
      <h2 className="app-section-title mt-1">Quinté du jour — consensus machines</h2>
      <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">{nomCourse}</p>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--pmu-text-muted)]">Analyse…</p>
      ) : err ? (
        <p className="mt-4 text-sm text-[var(--pmu-text-muted)]">{err}</p>
      ) : data ? (
        <div className="mt-4 space-y-2 text-sm font-semibold text-[var(--pmu-text)]">
          <p>
            <span className="text-[var(--pmu-text-muted)]">PMU Gagnant IA</span> →{" "}
            <span className="font-black text-[var(--pmu-primary)]">{data.pmuGagnant}</span>
          </p>
          <p>
            <span className="text-[var(--pmu-text-muted)]">ChatGPT</span> → {data.chatgpt}
          </p>
          <p>
            <span className="text-[var(--pmu-text-muted)]">Gemini</span> → {data.gemini}
          </p>
          <p className="mt-3 rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-3 text-[var(--pmu-text)]">
            {data.consensus}
          </p>
          {data.demo ? (
            <p className="text-xs text-[var(--pmu-text-muted)]">
              Mode démo ou cache — ajoute OPENAI_API_KEY / GEMINI_API_KEY pour appels réels.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
