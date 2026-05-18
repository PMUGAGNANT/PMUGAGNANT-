"use client";

import { useMemo, useState } from "react";
import type { RoleCheval, TypeRoleCheval } from "@/lib/horse-roles";

export interface ArrivalRow {
  position: number | null;
  numPmu: number;
  nom: string;
  jockey: string | null;
  entraineur: string | null;
}

export interface CourseParticipantRow {
  numero?: number | string | null;
  nom?: string | null;
  driver?: string | null;
  jockey?: string | null;
  entraineur?: string | null;
  proprietaire?: string | null;
  age?: number | null;
  sexe?: string | null;
  corde?: number | string | null;
  poids?: number | null;
  musique?: string | null;
  cote?: number | null;
  scoreIa?: number | null;
  nonPartant?: boolean | null;
  topFacteurs?: string[] | null;
  roleCheval?: RoleCheval | null;
}

interface ParticipantsTableProps {
  participants: CourseParticipantRow[] | null | undefined;
  favoriNum?: number | string | null;
  pepiteNum?: number | string | null;
  estPlat?: boolean;
  courseFinished?: boolean;
  officialArrival?: ArrivalRow[] | null;
}

function getHumanLead(participant: CourseParticipantRow, estPlat: boolean) {
  const primary = estPlat ? participant.jockey : participant.driver;
  return primary || participant.jockey || participant.driver || "--";
}

function getOddsTone(odds?: number | null) {
  if (odds === null || odds === undefined || !Number.isFinite(odds)) {
    return "var(--pmu-text-soft)";
  }

  if (odds < 5) return "var(--pmu-primary)";
  if (odds <= 10) return "var(--pmu-gold)";
  return "var(--pmu-text)";
}

function formatOdds(odds?: number | null) {
  if (odds === null || odds === undefined || !Number.isFinite(odds)) return "--";
  return odds.toFixed(1);
}

function getScoreStyle(score?: number | null) {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return {
      label: "--",
      background: "#F5F2EB",
      color: "#9C9485",
    };
  }

  const rounded = Math.round(score);

  if (score >= 70) {
    return {
      label: `${rounded}`,
      background: "#EAF3DE",
      color: "#2A4D12",
    };
  }

  if (score >= 50) {
    return {
      label: `${rounded}`,
      background: "#FEF3C7",
      color: "#8C6D2F",
    };
  }

  return {
    label: `${rounded}`,
    background: "#F5F2EB",
    color: "#9C9485",
  };
}

function getArrivalLabel(position?: number | null) {
  if (!position) return "--";
  return position === 1 ? "1er" : `${position}e`;
}

function getArrivalChipStyle(position?: number | null) {
  if (position === 1) {
    return {
      background: "#FDFCF9",
      border: "1px solid #8C6D2F",
      color: "#8C6D2F",
    };
  }

  if (position === 2 || position === 3) {
    return {
      background: "#F5F2EB",
      border: "1px solid #C2B49A",
      color: "#5A5444",
    };
  }

  return {
    background: "#F5F2EB",
    border: "1px solid var(--pmu-border)",
    color: "#9C9485",
  };
}

function getFallbackRole(
  participant: CourseParticipantRow,
  favoriNum?: number | string | null,
  pepiteNum?: number | string | null
): RoleCheval | null {
  const participantNumber = String(participant.numero ?? "");
  const base = {
    cheval_num: Number(participant.numero ?? 0),
    cheval_nom: participant.nom ?? "",
    cote: participant.cote ?? 0,
    score_cheval: participant.scoreIa ?? 0,
    confiance: 0,
    raison: "Repère principal du moteur.",
    variation_cote: null,
  };

  if (favoriNum !== null && favoriNum !== undefined && participantNumber === String(favoriNum)) {
    return {
      ...base,
      role: "FAVORI",
      emoji: "⭐",
      label: "Favori",
    };
  }

  if (pepiteNum !== null && pepiteNum !== undefined && participantNumber === String(pepiteNum)) {
    return {
      ...base,
      role: "PEPITE",
      emoji: "💎",
      label: "Pépite",
    };
  }

  return null;
}

function getRoleColor(role?: TypeRoleCheval | null) {
  switch (role) {
    case "FAVORI":
      return "var(--pmu-primary)";
    case "PEPITE":
      return "var(--pmu-gold)";
    case "OUTSIDER":
      return "var(--pmu-primary)";
    case "OUBLIE":
      return "var(--pmu-text-muted)";
    default:
      return null;
  }
}

function RunnerTags({ role }: { role: RoleCheval | null }) {
  if (!role) return null;

  const color = getRoleColor(role.role) ?? "var(--pmu-primary)";

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{
          color,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
        }}
      >
        {role.emoji} {role.label}
      </span>
    </div>
  );
}

function normalizeSearch(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])]
    .sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base" }));
}

export function ParticipantsTable({
  participants,
  favoriNum = null,
  pepiteNum = null,
  estPlat = true,
  courseFinished = false,
  officialArrival = [],
}: ParticipantsTableProps) {
  const [humanSearch, setHumanSearch] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const safeParticipants = useMemo(
    () => (Array.isArray(participants) ? participants : []),
    [participants]
  );
  const safeArrival = Array.isArray(officialArrival) ? officialArrival : [];

  const sortedParticipants = useMemo(
    () =>
      [...safeParticipants].sort(
        (left, right) => Number(left.numero ?? 999) - Number(right.numero ?? 999)
      ),
    [safeParticipants]
  );
  const trainers = useMemo(
    () => uniqueSorted(safeParticipants.map((participant) => participant.entraineur)),
    [safeParticipants]
  );
  const owners = useMemo(
    () => uniqueSorted(safeParticipants.map((participant) => participant.proprietaire)),
    [safeParticipants]
  );
  const normalizedHumanSearch = normalizeSearch(humanSearch);
  const activeFilters = Boolean(normalizedHumanSearch || trainerFilter || ownerFilter);
  const arrivalMap = new Map(safeArrival.map((row) => [row.numPmu, row.position]));

  function participantMatchesFilters(participant: CourseParticipantRow) {
    const humanText = normalizeSearch(
      [participant.jockey, participant.driver, participant.nom].filter(Boolean).join(" ")
    );
    const humanMatches =
      !normalizedHumanSearch || humanText.includes(normalizedHumanSearch);
    const trainerMatches =
      !trainerFilter || participant.entraineur === trainerFilter;
    const ownerMatches =
      !ownerFilter || participant.proprietaire === ownerFilter;

    return humanMatches && trainerMatches && ownerMatches;
  }

  const visibleParticipants = activeFilters
    ? sortedParticipants.filter(participantMatchesFilters)
    : sortedParticipants;

  if (safeParticipants.length === 0) {
    return (
      <section className="app-card overflow-hidden p-5 md:p-6">
        <p className="app-kicker">Table des partants</p>
        <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
          Les chevaux arrivent
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Les partants sont encore en cours de chargement.
        </p>
      </section>
    );
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="border-b border-[var(--pmu-border)] px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-kicker">Table des partants</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              Tous les chevaux
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Lecture courte : numéro, cheval, musique, score et cote.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="app-pill text-xs">{safeParticipants.length} partants</span>
            {activeFilters ? (
              <button
                type="button"
                className="app-pill text-xs"
                onClick={() => {
                  setHumanSearch("");
                  setTrainerFilter("");
                  setOwnerFilter("");
                }}
              >
                Effacer filtres
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="app-label">Recherche jockey / driver</span>
            <input
              type="search"
              value={humanSearch}
              onChange={(event) => setHumanSearch(event.target.value)}
              placeholder="No, cheval, jockey..."
              className="app-input mt-2 w-full"
            />
          </label>

          <label className="block">
            <span className="app-label">Entraîneur</span>
            <select
              value={trainerFilter}
              onChange={(event) => setTrainerFilter(event.target.value)}
              className="app-input mt-2 w-full"
            >
              <option value="">Tous les entraîneurs</option>
              {trainers.map((trainer) => (
                <option key={trainer} value={trainer}>
                  {trainer}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="app-label">Propriétaire</span>
            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="app-input mt-2 w-full"
            >
              <option value="">Tous les propriétaires</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="hidden lg:block">
        <table className="app-table w-full table-fixed">
          <colgroup>
            {courseFinished ? <col className="w-[72px]" /> : null}
            <col className="w-[72px]" />
            <col />
            <col className="w-[150px]" />
            <col className="w-[122px]" />
            <col className="w-[98px]" />
            <col className="w-[82px]" />
          </colgroup>
          <thead>
            <tr>
              {courseFinished ? <th>Arr.</th> : null}
              <th>N°</th>
              <th>Cheval</th>
              <th>Jockey / driver</th>
              <th>Musique</th>
              <th>Score</th>
              <th>Cote</th>
            </tr>
          </thead>
          <tbody>
            {visibleParticipants.map((participant, index) => {
              const numPmu = Number(participant.numero ?? 0);
              const arrivalPosition = arrivalMap.get(numPmu) ?? null;
              const role =
                participant.roleCheval ??
                getFallbackRole(participant, favoriNum, pepiteNum);
              const isAlgoPick =
                favoriNum !== null &&
                favoriNum !== undefined &&
                String(participant.numero ?? "") === String(favoriNum);
              const isWinner = arrivalPosition === 1;
              const score = getScoreStyle(participant.scoreIa);
              const struck = participant.nonPartant ? "line-through opacity-60" : "";
              const rowBackground = participant.nonPartant
                ? "var(--pmu-surface-2)"
                : isWinner
                  ? "#F4EDD8"
                  : isAlgoPick
                    ? "#EAF3DE"
                    : index % 2 === 0
                      ? "var(--pmu-surface)"
                      : "var(--pmu-surface-2)";

              return (
                <tr key={`${participant.numero}-${index}`} style={{ background: rowBackground }}>
                  {courseFinished ? (
                    <td>
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                        style={getArrivalChipStyle(arrivalPosition)}
                      >
                        {getArrivalLabel(arrivalPosition)}
                      </span>
                    </td>
                  ) : null}
                  <td>
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] px-2 text-sm font-bold text-[var(--pmu-text)]">
                      {participant.numero ?? "--"}
                    </span>
                  </td>
                  <td>
                    <div className="min-w-0">
                      <p
                        className={`truncate font-bold ${struck}`}
                        style={{ color: (isWinner || isAlgoPick) ? "#1A2018" : "var(--pmu-text)" }}
                      >
                        {participant.nom || "--"}
                      </p>
                      <RunnerTags role={role} />
                    </div>
                  </td>
                  <td>
                    <p
                      className="truncate text-sm font-bold"
                      style={{ color: (isWinner || isAlgoPick) ? "#1A2018" : "var(--pmu-text)" }}
                    >
                      {getHumanLead(participant, estPlat)}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: (isWinner || isAlgoPick) ? "#5a5a3e" : "var(--pmu-text-soft)" }}
                    >
                      {participant.entraineur || "Entraîneur --"}
                    </p>
                  </td>
                  <td className="font-mono text-[0.65rem] text-[var(--pmu-text-soft)]">
                    {participant.musique || "--"}
                  </td>
                  <td>
                    <span
                      className="inline-flex min-w-12 justify-center rounded-full px-2 py-1 text-xs font-bold"
                      style={{ background: score.background, color: score.color }}
                    >
                      {score.label}
                    </span>
                  </td>
                  <td>
                    <span
                      className="font-mono text-sm font-bold tabular-nums"
                      style={{ color: getOddsTone(participant.cote) }}
                    >
                      {formatOdds(participant.cote)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {visibleParticipants.map((participant, index) => {
          const numPmu = Number(participant.numero ?? 0);
          const arrivalPosition = arrivalMap.get(numPmu) ?? null;
          const role =
            participant.roleCheval ?? getFallbackRole(participant, favoriNum, pepiteNum);
          const score = getScoreStyle(participant.scoreIa);
          const isAlgoPick =
            favoriNum !== null &&
            favoriNum !== undefined &&
            String(participant.numero ?? "") === String(favoriNum);
          const isWinner = arrivalPosition === 1;
          const struck = participant.nonPartant ? "line-through opacity-60" : "";
          const background = participant.nonPartant
            ? "var(--pmu-surface-2)"
            : isWinner
              ? "#F4EDD8"
              : isAlgoPick
                ? "#EAF3DE"
                : "var(--pmu-surface)";

          return (
            <article
              key={`${participant.numero}-${index}`}
              className="rounded-lg border p-4"
              style={{
                background,
                borderColor: "var(--pmu-border)",
                opacity: participant.nonPartant ? 0.45 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                {courseFinished ? (
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={getArrivalChipStyle(arrivalPosition)}
                  >
                    {getArrivalLabel(arrivalPosition)}
                  </span>
                ) : null}
                <span className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] px-2 text-sm font-bold text-[var(--pmu-text)]">
                  {participant.numero ?? "--"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-base font-bold text-[var(--pmu-text)] ${struck}`}>
                    {participant.nom || "--"}
                  </p>
                  <p className="truncate text-sm text-[var(--pmu-text-soft)]">
                    {getHumanLead(participant, estPlat)}
                  </p>
                  <RunnerTags role={role} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-[var(--pmu-surface-2)] px-3 py-2">
                  <p className="app-label">Musique</p>
                  <p className="mt-1 truncate font-mono text-[0.65rem] text-[var(--pmu-text-soft)]">
                    {participant.musique || "--"}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--pmu-surface-2)] px-3 py-2">
                  <p className="app-label">Score</p>
                  <span
                    className="mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold"
                    style={{ background: score.background, color: score.color }}
                  >
                    {score.label}
                  </span>
                </div>
                <div className="rounded-lg bg-[var(--pmu-surface-2)] px-3 py-2">
                  <p className="app-label">Cote</p>
                  <p
                    className="mt-1 font-mono font-bold tabular-nums"
                    style={{ color: getOddsTone(participant.cote) }}
                  >
                    {formatOdds(participant.cote)}
                  </p>
                </div>
              </div>
            </article>
          );
        })}

        {visibleParticipants.length === 0 ? (
          <p className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-5 text-center text-sm text-[var(--pmu-text-soft)]">
            Aucun cheval ne correspond aux filtres.
          </p>
        ) : null}
      </div>
    </section>
  );
}
