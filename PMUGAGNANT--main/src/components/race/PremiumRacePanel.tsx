"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatOdds, formatStakeEuro } from "@/features/vmax/vmax-model";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";
import type { RaceAnalysis, RaceSummary, ScoredParticipant } from "@/lib/types";

type RaceApiPayload = {
  success?: boolean;
  error?: string;
  courseInfo?: RaceSummary;
  analysis?: RaceAnalysis | null;
  paywall?: { required?: boolean; preview?: { message?: string } } | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "free"; message: string }
  | { status: "error"; message: string }
  | { status: "pro"; analysis: RaceAnalysis; courseInfo: RaceSummary };

type PremiumRacePanelProps = {
  dateStr: string;
  reunion: number;
  course: number;
};

function getRunnerOdds(runner: ScoredParticipant) {
  return runner.coteDepart ?? runner.coteMatin ?? runner.cote ?? null;
}

function getRunnerEdge(runner: ScoredParticipant) {
  const value = runner.prediction.valueEffective ?? runner.prediction.marketEdge ?? null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRunnerStake(runner: ScoredParticipant) {
  const stake = runner.prediction.miseConseillee ?? runner.prediction.miseBase100 ?? null;
  return typeof stake === "number" && Number.isFinite(stake) ? stake : null;
}

function formatEdge(value: number | null) {
  if (value === null) {
    return "--";
  }

  return value > 1 ? `+${Math.round(value)}%` : `+${Math.round(value * 100)}%`;
}

export function PremiumRacePanel({ dateStr, reunion, course }: PremiumRacePanelProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadPremiumRace() {
      if (!hasSupabaseConfig()) {
        setState({ status: "guest" });
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setState({ status: "guest" });
          }
          return;
        }

        const response = await fetch(`/api/race/${reunion}/${course}?date=${dateStr}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload: RaceApiPayload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Acces PRO indisponible.");
        }

        if (payload.paywall?.required || !payload.analysis || !payload.courseInfo) {
          if (!cancelled) {
            setState({
              status: "free",
              message:
                payload.paywall?.preview?.message ??
                "Scores, mises, edge et analyse complete sont reserves aux membres Premium.",
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "pro",
            analysis: payload.analysis,
            courseInfo: payload.courseInfo,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Acces PRO indisponible.",
          });
        }
      }
    }

    void loadPremiumRace();

    return () => {
      cancelled = true;
    };
  }, [course, dateStr, reunion]);

  const content = useMemo(() => {
    if (state.status === "pro") {
      const top5 = state.analysis.top5.slice(0, 5);
      const ranking = state.analysis.ranking.slice(0, 10);
      const favori = state.analysis.favori;
      const recommendation = state.analysis.recommandation;

      return (
        <section className="rounded-lg border border-[#00C851]/35 bg-[#08150f] p-5 shadow-2xl shadow-black/25">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#00C851]">
                Acces Premium actif
              </p>
              <h2 className="mt-2 font-[var(--font-display)] text-4xl font-black leading-none text-[#F6F2E8]">
                Cockpit PRO deverrouille
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-300">
                Scores VMAX, mises conseillees, edge et lecture complete de la course.
              </p>
            </div>
            <div className="rounded-lg border border-[#00C851]/30 bg-[#00C851]/10 px-4 py-3 text-right">
              <p className="text-[0.65rem] font-black uppercase text-[#00C851]">Decision</p>
              <p className="font-[var(--font-display)] text-3xl font-black text-[#00C851]">
                {state.analysis.prediction.decisionCourse}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">Confiance</p>
              <p className="mt-1 font-[var(--font-display)] text-3xl font-black text-[#F6F2E8]">
                {state.analysis.scoreConfiance?.score ?? "--"}%
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">Lisibilite</p>
              <p className="mt-1 font-[var(--font-display)] text-3xl font-black text-[#F6F2E8]">
                {state.analysis.prediction.lisibilite}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">Selection</p>
              <p className="mt-1 font-[var(--font-display)] text-3xl font-black text-[#D4AF37]">
                {favori ? `#${favori.numPmu}` : "--"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {top5.map((runner) => (
              <div
                className="rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-3"
                key={runner.numPmu}
              >
                <p className="font-[var(--font-display)] text-3xl font-black text-[#D4AF37]">
                  #{runner.numPmu}
                </p>
                <p className="mt-1 text-xs font-black uppercase leading-5 text-[#F6F2E8]">
                  {runner.nom}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white/[0.04] text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">No</th>
                  <th className="px-3 py-3">Cheval</th>
                  <th className="px-3 py-3 text-right">Score</th>
                  <th className="px-3 py-3 text-right">Cote</th>
                  <th className="px-3 py-3 text-right">Edge</th>
                  <th className="px-3 py-3 text-right">Mise</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((runner) => (
                  <tr className="border-t border-white/10" key={runner.numPmu}>
                    <td className="px-3 py-3 font-black text-[#D4AF37]">#{runner.numPmu}</td>
                    <td className="px-3 py-3 font-bold text-[#F6F2E8]">{runner.nom}</td>
                    <td className="px-3 py-3 text-right font-black text-[#00C851]">
                      {Math.round(runner.score)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-300">
                      {formatOdds(getRunnerOdds(runner))}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-[#00C851]">
                      {formatEdge(getRunnerEdge(runner))}
                    </td>
                    <td className="px-3 py-3 text-right font-black text-[#F6F2E8]">
                      {formatStakeEuro(getRunnerStake(runner))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recommendation ? (
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
                Analyse complete
              </p>
              <h3 className="mt-2 text-xl font-black text-[#F6F2E8]">
                {recommendation.decision}
              </h3>
              <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-slate-300">
                {recommendation.raisonnement.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      );
    }

    if (state.status === "loading") {
      return (
        <section className="rounded-lg border border-[#D4AF37]/25 bg-[#101827] p-5 text-sm font-black text-slate-300">
          Verification de l&apos;acces Premium...
        </section>
      );
    }

    const message =
      state.status === "guest"
        ? "Connecte-toi ou passe Premium pour deverrouiller les scores, mises, edge et analyse complete."
        : state.message;

    return (
      <section className="rounded-lg border border-[#D4AF37]/25 bg-[#101827] p-5 shadow-2xl shadow-black/20">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D4AF37]">
          Privilege membre
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl font-black leading-none text-[#F6F2E8]">
          L&apos;apercu est gratuit. La decision complete est Premium.
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-400">{message}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/premium"
            className="rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#0A0E1A]"
          >
            Passer Premium
          </Link>
          <Link
            href="/login?redirect=%2Fpremium"
            className="rounded-lg border border-white/10 px-5 py-3 text-sm font-black uppercase tracking-wide text-[#F6F2E8]"
          >
            Me connecter
          </Link>
        </div>
      </section>
    );
  }, [state]);

  return content;
}
