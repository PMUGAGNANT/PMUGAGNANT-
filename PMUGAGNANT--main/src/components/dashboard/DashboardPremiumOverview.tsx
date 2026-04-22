"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatRaceAnalysisId,
  type VmaxRaceStatus,
} from "@/features/vmax/vmax-model";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";
import type { RaceSummary } from "@/lib/types";

type DashboardRaceShell = {
  race: RaceSummary;
  status: VmaxRaceStatus;
};

type RaceSignal = {
  topNumbers: number[];
  verdict: string;
  stake: number | null;
};

type SignalsPayload = {
  success?: boolean;
  error?: string;
  date?: string;
  signals?: Record<string, RaceSignal>;
  paywall?: { required?: boolean; message?: string } | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "locked" }
  | { status: "ready"; signals: Record<string, RaceSignal> }
  | { status: "error" };

type DashboardPremiumOverviewProps = {
  hero: DashboardRaceShell | null;
  visibleRaces: DashboardRaceShell[];
  emptyMessage: string;
};

function getRaceKey(race: Pick<RaceSummary, "reunion" | "course">) {
  return `${race.reunion}-${race.course}`;
}

function getRaceHref(race: RaceSummary) {
  return `/race/${formatRaceAnalysisId(race.reunion, race.course)}?date=${race.dateStr}`;
}

function getStatusLabel(status: VmaxRaceStatus) {
  if (status === "live") return "En cours";
  if (status === "finished") return "Termine";
  return "A venir";
}

function getVerdictClass(verdict: string) {
  if (verdict === "JOUER") return "is-play";
  if (verdict === "SURVEILLER") return "is-watch";
  return "is-pass";
}

function getCompactBubbleClass(index: number) {
  if (index === 0) return "is-gold";
  if (index === 1) return "is-blue";
  return "is-muted";
}

function formatStake(stake: number | null) {
  if (stake === null || !Number.isFinite(stake)) return "--";
  return `${stake.toFixed(stake % 1 === 0 ? 0 : 2)} EUR`;
}

function getSignal(
  signals: Record<string, RaceSignal>,
  race: RaceSummary
): RaceSignal | null {
  return signals[getRaceKey(race)] ?? null;
}

export function DashboardPremiumOverview({
  hero,
  visibleRaces,
  emptyMessage,
}: DashboardPremiumOverviewProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const date = hero?.race.dateStr ?? visibleRaces[0]?.race.dateStr ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadSignals() {
      if (!date || !hasSupabaseConfig()) {
        setState({ status: "locked" });
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) setState({ status: "locked" });
          return;
        }

        const response = await fetch(`/api/dashboard/premium-signals?date=${date}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload: SignalsPayload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Signaux Premium indisponibles.");
        }

        if (payload.paywall?.required) {
          if (!cancelled) setState({ status: "locked" });
          return;
        }

        if (!cancelled) {
          setState({ status: "ready", signals: payload.signals ?? {} });
        }
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    void loadSignals();

    return () => {
      cancelled = true;
    };
  }, [date]);

  const signals = useMemo(
    () => (state.status === "ready" ? state.signals : {}),
    [state]
  );
  const isUnlocked = state.status === "ready";

  const heroSignal = useMemo(
    () => (hero ? getSignal(signals, hero.race) : null),
    [hero, signals]
  );
  const heroNumbers =
    isUnlocked && heroSignal?.topNumbers.length
      ? heroSignal.topNumbers
      : [null, null, null];
  const heroVerdict = isUnlocked ? heroSignal?.verdict ?? "SURVEILLER" : "PREMIUM";

  return (
    <>
      {hero ? (
        <section className="dash-hero">
          <div>
            <p className="dash-kicker">Analyse IA du jour</p>
            <h1 className="dash-course-name">{hero.race.nomCourse}</h1>
            <p className="dash-meta">
              {hero.race.hippodrome} - {hero.race.discipline} - {hero.race.heureDepart}
            </p>
            <div className="dash-selection" aria-label="Selections IA">
              {heroNumbers.map((num, index) => (
                <span className="dash-bubble" key={`${num ?? "locked"}-${index}`}>
                  {num ?? "?"}
                </span>
              ))}
            </div>
          </div>
          <div className="dash-hero-side">
            <div>
              <p className="dash-label">Verdict</p>
              <strong className={`dash-verdict ${getVerdictClass(heroVerdict)}`}>
                {heroVerdict}
              </strong>
            </div>
            <p className="dash-stake">
              Mise conseillee
              <strong>{isUnlocked ? formatStake(heroSignal?.stake ?? null) : "--"}</strong>
            </p>
            <Link className="dash-cta" href={getRaceHref(hero.race)}>
              {isUnlocked ? "Voir l'analyse complete" : "Deverrouiller l'analyse"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="dash-empty">{emptyMessage}</section>
      )}

      <section>
        <div className="dash-section-head">
          <h2 className="dash-title">Autres courses du jour</h2>
          <p className="dash-label">{visibleRaces.length} courses</p>
        </div>
        {visibleRaces.length > 0 ? (
          <div className="dash-grid">
            {visibleRaces.map((item) => {
              const signal = getSignal(signals, item.race);
              const numbers =
                isUnlocked && signal?.topNumbers.length
                  ? signal.topNumbers
                  : [null, null, null];

              return (
                <Link
                  href={getRaceHref(item.race)}
                  key={`${item.race.reunion}-${item.race.course}`}
                  className="dash-card"
                >
                  <div className="dash-card-row">
                    <strong className="dash-card-title">{item.race.hippodrome}</strong>
                    <span className={`dash-status ${item.status}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <p className="dash-card-meta">
                    {item.race.discipline} - {item.race.heureDepart} -{" "}
                    {item.race.nombrePartants} partants
                  </p>
                  <div className="dash-card-row">
                    <div className="dash-mini-bubbles">
                      {numbers.map((num, index) => (
                        <span
                          className={`dash-mini ${getCompactBubbleClass(index)}`}
                          key={`${item.race.reunion}-${item.race.course}-${num ?? "locked"}-${index}`}
                        >
                          {num ?? "?"}
                        </span>
                      ))}
                    </div>
                    <span className="dash-label">{isUnlocked ? "Top IA" : "Premium"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="dash-empty">{emptyMessage}</div>
        )}
      </section>

      {state.status === "error" ? (
        <p className="dash-empty">
          Impossible de verifier le statut Premium pour le moment. Recharge la page dans un instant.
        </p>
      ) : null}
    </>
  );
}
