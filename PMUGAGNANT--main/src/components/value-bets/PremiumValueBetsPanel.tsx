"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatOdds,
  formatRaceAnalysisId,
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
      <section className="value-state-card">
        Verification de l&apos;acces Premium...
      </section>
    );
  }

  if (state.status === "locked") {
    return (
      <section className="value-lock-card">
        <p className="value-kicker">Privilege membre</p>
        <h2>
          Les value bets completes sont Premium.
        </h2>
        <p className="value-lock-copy">
          {state.message}
        </p>
        {state.previewCount !== null ? (
          <p className="value-lock-count">
            {state.previewCount} signal{state.previewCount > 1 ? "s" : ""} detecte
            {state.previewCount > 1 ? "s" : ""} aujourd&apos;hui.
          </p>
        ) : null}
        <div className="value-actions">
          <Link
            href="/premium"
            className="app-button-primary"
          >
            Passer Premium
          </Link>
          <Link
            href="/login?redirect=%2Fvalue-bets"
            className="app-button-secondary"
          >
            Me connecter
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="value-state-card">
        {state.message}
      </section>
    );
  }

  if (state.valueBets.length === 0) {
    return (
      <section className="value-state-card">
        Analyse en cours : aucune value bet nette n&apos;est disponible pour le moment.
      </section>
    );
  }

  return (
    <section className="value-bets-grid">
      {state.valueBets.map((card) => (
        <Link
          href={`/race/${formatRaceAnalysisId(card.reunion, card.course)}?date=${formatDateForRaceLink(card.date)}`}
          key={`${card.date}-${card.reunion}-${card.course}-${card.chevalNum}`}
          className="value-bet-card"
        >
          <div className="value-bet-head">
            <div>
              <p className="value-race-label">
                R{card.reunion}C{card.course} - {card.hippodrome}
              </p>
              <h2>
                {card.cheval}
              </h2>
            </div>
            <span className="value-runner-number">
              {card.chevalNum}
            </span>
          </div>

          <div className="value-metrics">
            <div className="value-metric">
              <p>PMU</p>
              <strong>
                {formatOdds(card.cotePmu)}
              </strong>
            </div>
            <div className="value-metric">
              <p>Fair</p>
              <strong>
                {formatOdds(card.coteEstimee)}
              </strong>
            </div>
            <div className="value-metric value-metric--edge">
              <p>Edge</p>
              <strong>
                +{card.edge.toFixed(0)}%
              </strong>
            </div>
            <div className="value-metric">
              <p>Mise</p>
              <strong>
                {formatStake(card.miseConseillee)}
              </strong>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
