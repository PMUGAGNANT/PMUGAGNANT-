"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatOdds,
  formatRaceAnalysisId,
  getRunnerNumberClass,
} from "@/features/vmax/vmax-model";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";

type ValueBet = {
  date: string;
  race: string;
  reunion: number;
  course: number;
  hippodrome: string;
  chevalNum: number;
  cheval: string;
  cotePmu: number | null;
  coteEstimee: number | null;
  edge: number;
  miseConseillee: number | null;
};

type ValueBetsPayload = {
  success?: boolean;
  error?: string;
  date?: string;
  valueBets?: ValueBet[];
  paywall?: {
    required?: boolean;
    previewCount?: number;
    message?: string;
  } | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "locked"; message: string; previewCount: number | null }
  | { status: "error"; message: string }
  | { status: "ready"; valueBets: ValueBet[]; date: string | null };

function formatStake(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} EUR`;
}

function formatDateForRaceLink(date: string) {
  return date.split("-").reverse().join("");
}

export function PremiumValueBetsPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadValueBets() {
      if (!hasSupabaseConfig()) {
        setState({
          status: "locked",
          message: "Connecte-toi ou passe Premium pour voir les value bets du jour.",
          previewCount: null,
        });
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setState({
              status: "locked",
              message: "Connecte-toi ou passe Premium pour voir les value bets du jour.",
              previewCount: null,
            });
          }
          return;
        }

        const response = await fetch("/api/value-bets/today", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload: ValueBetsPayload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Value bets indisponibles.");
        }

        if (payload.paywall?.required) {
          if (!cancelled) {
            setState({
              status: "locked",
              message:
                payload.paywall.message ??
                "Value bets, edge et mises conseillees reserves aux membres Premium.",
              previewCount:
                typeof payload.paywall.previewCount === "number"
                  ? payload.paywall.previewCount
                  : null,
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            valueBets: payload.valueBets ?? [],
            date: payload.date ?? null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Value bets indisponibles.",
          });
        }
      }
    }

    void loadValueBets();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="rounded-lg border border-white/10 bg-[#101827] p-6 text-sm font-black text-slate-400">
        Verification de l&apos;acces Premium...
      </section>
    );
  }

  if (state.status === "locked") {
    return (
      <section className="rounded-lg border border-[#D4AF37]/25 bg-[#101827] p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
          Privilege membre
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-4xl font-black leading-none text-[#F6F2E8]">
          Les value bets completes sont Premium.
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-400">
          {state.message}
        </p>
        {state.previewCount !== null ? (
          <p className="mt-2 text-sm font-black text-[#D4AF37]">
            {state.previewCount} signal{state.previewCount > 1 ? "s" : ""} detecte
            {state.previewCount > 1 ? "s" : ""} aujourd&apos;hui.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/premium"
            className="rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#0A0E1A]"
          >
            Passer Premium
          </Link>
          <Link
            href="/login?redirect=%2Fvalue-bets"
            className="rounded-lg border border-white/10 px-5 py-3 text-sm font-black uppercase tracking-wide text-[#F6F2E8]"
          >
            Me connecter
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-lg border border-white/10 bg-[#101827] p-6 text-sm font-black text-slate-400">
        {state.message}
      </section>
    );
  }

  if (state.valueBets.length === 0) {
    return (
      <section className="rounded-lg border border-white/10 bg-[#101827] p-6 text-sm font-black text-slate-400">
        Analyse en cours : aucune value bet nette n&apos;est disponible pour le moment.
      </section>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {state.valueBets.map((card) => (
        <Link
          href={`/race/${formatRaceAnalysisId(card.reunion, card.course)}?date=${formatDateForRaceLink(card.date)}`}
          key={`${card.date}-${card.reunion}-${card.course}-${card.chevalNum}`}
          className="group rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-[#D4AF37]/45"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[#D4AF37]">
                R{card.reunion}C{card.course} - {card.hippodrome}
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-[#F6F2E8]">
                {card.cheval}
              </h2>
            </div>
            <span
              className={`grid aspect-square w-10 shrink-0 place-items-center rounded-full font-[var(--font-display)] text-xl font-black ${getRunnerNumberClass(card.chevalNum)}`}
            >
              {card.chevalNum}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">PMU</p>
              <p className="font-[var(--font-display)] text-2xl font-black text-[#D4AF37]">
                {formatOdds(card.cotePmu)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">Fair</p>
              <p className="font-[var(--font-display)] text-2xl font-black text-[#F6F2E8]">
                {formatOdds(card.coteEstimee)}
              </p>
            </div>
            <div className="rounded-lg border border-[#00C851]/25 bg-[#00C851]/10 p-3">
              <p className="text-[0.65rem] font-black uppercase text-[#00C851]">Edge</p>
              <p className="font-[var(--font-display)] text-2xl font-black text-[#00C851]">
                +{card.edge.toFixed(0)}%
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">Mise</p>
              <p className="font-[var(--font-display)] text-2xl font-black text-[#F6F2E8]">
                {formatStake(card.miseConseillee)}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
