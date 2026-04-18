"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  mergeParticipantData,
  type RaceApiParticipant,
  type RaceApiResponse,
} from "@/features/race/lib/race-page-model";
import { parseFavoriteForm } from "@/features/race/lib/favorite-form";
import { fetchRaceDetails } from "@/features/races/api/client";
import {
  buildValueBets,
  formatOdds,
  formatRaceAnalysisId,
  formatStakeLabel,
  getRunnerNumberColor,
  getScoreTier,
  getStakeTone,
  parseRaceAnalysisId,
  type ValueBetInput,
} from "@/features/vmax/vmax-model";

type RunnerRow = {
  numero: number;
  cheval: string;
  jockey: string;
  entraineur: string;
  cote: number | null;
  scoreIa: number | null;
  musique: string | null;
  mise: number | null;
  topFacteur: string | null;
};

function getParticipantNumber(participant: RaceApiParticipant) {
  const numeric = Number(participant.numPmu ?? participant.numero);
  return Number.isFinite(numeric) ? numeric : null;
}

function getSelectedNumber(payload: RaceApiResponse | null) {
  const favori = payload?.analysis?.favori;
  const ranking = Array.isArray(payload?.analysis?.ranking) ? payload.analysis.ranking : [];
  const selected = favori ?? ranking[0] ?? null;
  return selected ? getParticipantNumber(selected) : null;
}

function toRunnerRows(payload: RaceApiResponse | null): RunnerRow[] {
  return mergeParticipantData(payload)
    .map((participant) => {
      const numero = getParticipantNumber(participant);
      if (numero === null) {
        return null;
      }

      return {
        numero,
        cheval: participant.nom ?? "-",
        jockey: participant.jockey || participant.driver || "-",
        entraineur: participant.entraineur ?? "-",
        cote: participant.cote ?? null,
        scoreIa: participant.prediction?.scoreCheval ?? null,
        musique: participant.musique ?? null,
        mise: participant.prediction?.miseConseillee ?? null,
        topFacteur: participant.prediction?.topFacteurs?.[0] ?? null,
      } satisfies RunnerRow;
    })
    .filter((row): row is RunnerRow => row !== null)
    .sort((left, right) => left.numero - right.numero);
}

function FormSparkline({ musique }: { musique?: string | null }) {
  const points = parseFavoriteForm(musique);
  const width = 92;
  const height = 30;
  const polyline = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - (point.score / 100) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="vmax-formline" aria-label="Forme 5 dernieres courses">
      <polyline points={polyline} />
    </svg>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className="vmax-score-badge" data-tier={getScoreTier(score)}>
      {typeof score === "number" && Number.isFinite(score) ? Math.round(score) : "--"}
    </span>
  );
}

function StakeCell({ value }: { value: number | null }) {
  return (
    <span
      className="vmax-stake"
      data-tone={getStakeTone(value)}
      title="Base sur bankroll de 100 EUR et Kelly 25%"
    >
      {formatStakeLabel(value)}
    </span>
  );
}

export function RaceAnalysisPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<RaceApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseRaceAnalysisId(params?.id ?? ""), [params?.id]);
  const selectedDate = searchParams.get("date");

  useEffect(() => {
    if (!parsed) {
      setError("Identifiant de course invalide. Format attendu : r1c4 ou 1-4.");
      setIsLoading(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    async function loadRace() {
      if (!parsed) return;

      setIsLoading(true);
      setError(null);

      try {
        const payload = await fetchRaceDetails<RaceApiResponse>(parsed.reunion, parsed.course, {
          date: selectedDate,
          signal: ac.signal,
        });
        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled && !(loadError instanceof Error && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Analyse indisponible");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadRace();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [parsed, selectedDate]);

  const courseInfo = data?.courseInfo ?? null;
  const rows = useMemo(() => toRunnerRows(data), [data]);
  const selectedNumber = getSelectedNumber(data);
  const valueBets = useMemo(() => {
    const inputs: ValueBetInput[] = rows.map((row) => ({
      numero: row.numero,
      cheval: row.cheval,
      cote: row.cote,
      scoreIa: row.scoreIa,
      raison: row.topFacteur,
    }));
    return buildValueBets(inputs);
  }, [rows]);

  return (
    <div className="vmax-page">
      <header className="vmax-header">
        <Link href="/dashboard" className="vmax-brand">
          PMU GAGNANT
        </Link>
        <span className="vmax-live is-active">● ANALYSE</span>
        <nav className="vmax-nav" aria-label="Analyse course">
          <a href="#partants">Partants</a>
          <a href="#value-bets">Value Bets</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        <div className="vmax-user">
          <span>PRO</span>
          <div aria-hidden>JG</div>
        </div>
      </header>

      <main className="vmax-race-analysis">
        <section className="vmax-race-title">
          <p className="vmax-kicker">
            {parsed ? formatRaceAnalysisId(parsed.reunion, parsed.course).toUpperCase() : "Course"}
          </p>
          <h1>{courseInfo?.nomCourse ?? "Analyse course"}</h1>
          <p>
            {courseInfo
              ? `${courseInfo.hippodrome ?? "Hippodrome"} · ${courseInfo.heureDepart ?? "Heure"} · ${courseInfo.distance ?? "-"} m`
              : "Lecture IA des partants, cotes, scores et value bets."}
          </p>
        </section>

        {error ? (
          <section className="vmax-alert" role="alert">
            {error}
          </section>
        ) : null}

        <section className="vmax-table-card" id="partants">
          <div className="vmax-section-heading">
            <p className="vmax-kicker">Tableau des partants</p>
            <span>{isLoading ? "Chargement" : `${rows.length} partants`}</span>
          </div>

          <div className="vmax-runners-table-wrap">
            <table className="vmax-runners-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cheval</th>
                  <th>Jockey</th>
                  <th>Entraineur</th>
                  <th>Cote PMU</th>
                  <th>Score IA</th>
                  <th>Forme</th>
                  <th>Mise</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelected = selectedNumber !== null && row.numero === selectedNumber;

                  return (
                    <tr key={row.numero} className={isSelected ? "is-ai-selected" : undefined}>
                      <td>
                        <span
                          className="vmax-runner-num"
                          style={{ background: getRunnerNumberColor(row.numero) }}
                        >
                          {row.numero}
                        </span>
                      </td>
                      <td>
                        <strong>{row.cheval}</strong>
                        {isSelected ? <em>Selection IA #1</em> : null}
                      </td>
                      <td>{row.jockey}</td>
                      <td>{row.entraineur}</td>
                      <td className="vmax-odds">{formatOdds(row.cote)}</td>
                      <td>
                        <ScoreBadge score={row.scoreIa} />
                      </td>
                      <td>
                        <FormSparkline musique={row.musique} />
                      </td>
                      <td>
                        <StakeCell value={row.mise} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="vmax-value-panel" id="value-bets">
          <div className="vmax-section-heading">
            <p className="vmax-kicker">Value bets</p>
            <span>{valueBets.length} edges detectees</span>
          </div>

          {valueBets.length === 0 ? (
            <p className="vmax-empty">Aucune value bet nette pour le moment.</p>
          ) : (
            <div className="vmax-value-list">
              {valueBets.map((bet) => (
                <article key={`${bet.numero}-${bet.cheval}`}>
                  <div className="vmax-value-row">
                    <span
                      className="vmax-runner-num"
                      style={{ background: getRunnerNumberColor(bet.numero) }}
                    >
                      {bet.numero}
                    </span>
                    <strong>{bet.cheval}</strong>
                    <span>Cote actuelle {formatOdds(bet.coteActuelle)}</span>
                    <span>Cote fair {formatOdds(bet.coteFair)}</span>
                    <b>{bet.edgePct.toFixed(1)}%</b>
                    {bet.edgePct > 10 ? <i>VALUE +</i> : null}
                  </div>
                  <p>{bet.explanation}</p>
                </article>
              ))}
            </div>
          )}

          <p className="vmax-value-note">
            Cote fair calculee depuis le score IA. Exemple : score haut + cote PMU genereuse = edge positif.
          </p>
        </section>
      </main>
    </div>
  );
}
