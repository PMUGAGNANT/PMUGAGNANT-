"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildFeaturedRaces,
  coerceRaceSummaries,
  formatCourseMeta,
  formatRaceCode,
  getRadarRace,
  sortFeaturedRaces,
  type RaceScore,
  type RacesResponse,
  type ScoresResponse,
} from "@/features/home/lib/home-page-model";
import {
  fetchRaceScoresForDate,
  fetchRacesForDate,
  normalizeRaceScoresPayload,
} from "@/features/races/api/client";
import {
  formatOdds,
  formatRaceAnalysisId,
  getRunnerNumberColor,
  getVmaxRaceStatus,
} from "@/features/vmax/vmax-model";
import { getTodayDateStr } from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

const roiSparkline = [12, 15, 14, 18, 21, 19, 24, 27, 31, 29, 34, 37];
const successRates = [
  { label: "Quinte", value: 68 },
  { label: "Couple", value: 61 },
  { label: "Tierce", value: 54 },
  { label: "Value", value: 72 },
] as const;
const latestPerformances = [
  { race: "R1C4", pick: "Jarash", result: "+47 EUR" },
  { race: "R3C2", pick: "Karma Quick", result: "+18 EUR" },
  { race: "R4C7", pick: "Moon Lady", result: "-10 EUR" },
  { race: "R2C6", pick: "Helios", result: "+31 EUR" },
  { race: "R1C8", pick: "Noble Dream", result: "+12 EUR" },
] as const;

function Sparkline({ values }: { values: number[] }) {
  const width = 220;
  const height = 68;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="vmax-sparkline" aria-hidden>
      <polyline points={points} />
    </svg>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(score, 100));
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="vmax-gauge" aria-label={`Score confiance ${Math.round(progress)} sur 100`}>
      <svg viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} className="vmax-gauge__track" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          className="vmax-gauge__value"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <strong>{Math.round(progress)}</strong>
      <span>confiance</span>
    </div>
  );
}

function statusLabel(status: "ready" | "live" | "finished") {
  if (status === "live") return "En cours";
  if (status === "finished") return "Terminee";
  return "Analyse prete";
}

function statusTone(status: "ready" | "live" | "finished") {
  if (status === "live") return "live";
  if (status === "finished") return "done";
  return "ready";
}

function selectionNumbers(score?: RaceScore) {
  return [
    score?.pick?.numPmu ?? null,
    score?.pepiteDuJour?.numPmu ?? null,
    score?.comboCandidate?.cheval_num ?? null,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function VmaxDashboardPage() {
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateStr = getTodayDateStr();

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const [racesResponse, scoresResponse] = await Promise.all([
          fetchRacesForDate<RacesResponse>(dateStr, ac.signal),
          fetchRaceScoresForDate<ScoresResponse>(dateStr, ac.signal),
        ]);
        const normalizedRaces = coerceRaceSummaries(racesResponse.races);
        const normalizedScores = scoresResponse?.success
          ? normalizeRaceScoresPayload<RaceScore>(scoresResponse.scores ?? null, dateStr)
          : [];

        if (!cancelled) {
          setRaces(normalizedRaces);
          setScores(normalizedScores);
        }
      } catch (loadError) {
        if (!cancelled && !(loadError instanceof Error && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Chargement impossible");
          setRaces([]);
          setScores([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [dateStr]);

  const featuredRaces = useMemo(() => {
    const scoresMap = new Map(scores.map((score) => [`${score.reunion}-${score.course}`, score]));
    return sortFeaturedRaces(buildFeaturedRaces(races, scoresMap), "score");
  }, [races, scores]);
  const quinte = useMemo(
    () =>
      featuredRaces.find((item) => item.race.estQuinte && item.status !== "resultat") ??
      getRadarRace(featuredRaces),
    [featuredRaces]
  );
  const visibleRaces = featuredRaces.slice(0, 6);
  const liveActive = featuredRaces.some((item) => getVmaxRaceStatus(item.score?.stage, item.minutesUntilStart) === "live");

  return (
    <div className="vmax-page">
      <header className="vmax-header">
        <Link href="/dashboard" className="vmax-brand">
          PMU GAGNANT
        </Link>
        <span className={`vmax-live ${liveActive ? "is-active" : ""}`}>● LIVE</span>
        <nav className="vmax-nav" aria-label="Dashboard">
          {["Quinte", "Couple", "Tierce", "Value Bets", "Stats"].map((item) => (
            <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
              {item}
            </a>
          ))}
        </nav>
        <div className="vmax-user">
          <span>PRO</span>
          <div aria-hidden>JG</div>
        </div>
      </header>

      <main className="vmax-dashboard">
        {error ? (
          <section className="vmax-alert" role="alert">
            {error}
          </section>
        ) : null}

        <section className="vmax-dashboard__main" id="quinte">
          <article className="vmax-hero-card">
            <div className="vmax-hero-card__image">
              <Image
                src="/promo-poster.jpg"
                alt="Cheval favori du Quinté du jour"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 42vw"
              />
              <div>
                <span>Quinte du jour</span>
                <strong>{quinte ? formatRaceCode(quinte.race) : "Analyse"}</strong>
              </div>
            </div>

            <div className="vmax-hero-card__content">
              <p className="vmax-kicker">Signal premium</p>
              <h1>
                {isLoading
                  ? "Chargement du programme"
                  : quinte?.race.hippodrome ?? "Quinte a confirmer"}
              </h1>
              <p className="vmax-hero-meta">
                {quinte
                  ? `${quinte.race.heureDepart} · ${formatCourseMeta(quinte.race)}`
                  : "Les meilleurs spots du jour arrivent."}
              </p>

              <div className="vmax-hero-grid">
                <ConfidenceGauge score={quinte?.confidence ?? 0} />
                <div className="vmax-top-selection">
                  <span>Top 3 selections</span>
                  <div>
                    {(quinte ? selectionNumbers(quinte.score) : []).length > 0
                      ? selectionNumbers(quinte?.score).map((num) => (
                          <i key={num} style={{ background: getRunnerNumberColor(num) }}>
                            {num}
                          </i>
                        ))
                      : [1, 4, 8].map((num) => (
                          <i key={num} style={{ background: getRunnerNumberColor(num) }}>
                            {num}
                          </i>
                        ))}
                  </div>
                  <p>
                    {quinte?.score?.pick?.nom
                      ? `${quinte.score.pick.nom} en base IA`
                      : "Selection IA disponible dans la fiche complete"}
                  </p>
                </div>
              </div>

              <Link
                className="vmax-cta"
                href={
                  quinte
                    ? `/race/${formatRaceAnalysisId(quinte.race.reunion, quinte.race.course)}?date=${quinte.race.dateStr}`
                    : "/premium"
                }
              >
                Voir analyse complete
              </Link>
            </div>
          </article>

          <section className="vmax-course-grid" id="stats">
            <div className="vmax-section-heading">
              <p className="vmax-kicker">Courses du jour</p>
              <span>{visibleRaces.length}/6 visibles</span>
            </div>
            <div className="vmax-race-cards">
              {visibleRaces.map((item) => {
                const status = getVmaxRaceStatus(item.score?.stage, item.minutesUntilStart);
                const selections = selectionNumbers(item.score);

                return (
                  <Link
                    href={`/race/${formatRaceAnalysisId(item.race.reunion, item.race.course)}?date=${item.race.dateStr}`}
                    key={`${item.race.reunion}-${item.race.course}`}
                    className="vmax-race-card"
                  >
                    <div className="vmax-race-card__top">
                      <strong>{item.race.hippodrome}</strong>
                      <span className="vmax-status" data-tone={statusTone(status)}>
                        {statusLabel(status)}
                      </span>
                    </div>
                    <p>
                      {item.race.discipline} · {item.race.heureDepart} · {item.race.nombrePartants} partants
                    </p>
                    <div className="vmax-preview">
                      {(selections.length > 0 ? selections : [1, 2, 3]).slice(0, 3).map((num) => (
                        <i key={num} style={{ background: getRunnerNumberColor(num) }}>
                          {num}
                        </i>
                      ))}
                      <span>Cote {formatOdds(item.score?.pick?.cote ?? null)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="vmax-sidebar">
          <section className="vmax-stat-panel">
            <p className="vmax-kicker">ROI 30 jours</p>
            <strong>+34.7%</strong>
            <Sparkline values={roiSparkline} />
          </section>

          <section className="vmax-stat-panel">
            <p className="vmax-kicker">Reussite par pari</p>
            <div className="vmax-bars">
              {successRates.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <i>
                    <b style={{ width: `${item.value}%` }} />
                  </i>
                  <em>{item.value}%</em>
                </div>
              ))}
            </div>
          </section>

          <section className="vmax-stat-panel">
            <p className="vmax-kicker">Dernieres performances</p>
            <table className="vmax-mini-table">
              <tbody>
                {latestPerformances.map((row) => (
                  <tr key={`${row.race}-${row.pick}`}>
                    <td>{row.race}</td>
                    <td>{row.pick}</td>
                    <td>{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </main>
    </div>
  );
}
