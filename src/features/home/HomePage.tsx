"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCombo, type ComboRole } from "@/components/ComboBuilder";
import { translateFactors } from "@/lib/beginner-labels";
import { getPriorityToneColor } from "@/lib/race-priority";
import type { RaceSummary } from "@/lib/types";
import { FilterPills } from "@/features/home/components/FilterPills";
import { TopParisStrip } from "@/features/home/components/TopParisStrip";
import {
  SORT_OPTIONS,
  addDays,
  buildFeaturedRaces,
  coerceRaceSummaries,
  formatCourseMeta,
  formatDisplayDate,
  formatMinutesLabel,
  formatOddsLabel,
  formatRaceCode,
  formatRelativeDay,
  getBetTypeLabel,
  getBoardSectionMeta,
  getParticipantNum,
  getPickLabel,
  getRadarRace,
  getTopParisItems,
  normalizeDateParam,
  normalizeFocusParticipants,
  sortFeaturedRaces,
  type BoardSectionKey,
  type FeaturedRace,
  type FocusDetailResponse,
  type FocusParticipant,
  type RaceScore,
  type RacesResponse,
  type ScoresResponse,
  type SortMode,
} from "@/features/home/lib/home-page-model";
import {
  fetchRaceDetails,
  fetchRacesForDate,
  fetchRaceScoresForDate,
  normalizeRaceScoresPayload,
} from "@/features/races/api/client";
import { getTodayDateStr, toIsoDate } from "@/lib/date-utils";

type HomeStats = {
  total: number;
  meetings: number;
  playable: number;
  active: number;
};

type HomeLane = {
  key: BoardSectionKey;
  items: FeaturedRace[];
};

type QuickFilter = "all" | "top3" | "jouable" | "urgent" | "quinte" | "allocation";

type QuickFilterOption = {
  value: QuickFilter;
  label: string;
  description: string;
  count: number;
};

const QUICK_FILTER_STORAGE_KEY = "pmu-quick-filter";
const URGENT_MINUTES_LIMIT = 45;
const BIG_ALLOCATION_LIMIT = 50000;

function isQuickFilter(value: string | null): value is QuickFilter {
  return (
    value === "all" ||
    value === "top3" ||
    value === "jouable" ||
    value === "urgent" ||
    value === "quinte" ||
    value === "allocation"
  );
}

function HomeControlBar({
  selectedDate,
  sortMode,
  stats,
  focusRace,
  onPrevDay,
  onToday,
  onNextDay,
  onDateChange,
  onSortChange,
}: {
  selectedDate: string;
  sortMode: SortMode;
  stats: HomeStats;
  focusRace: FeaturedRace | null;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onDateChange: (next: string) => void;
  onSortChange: (next: SortMode) => void;
}) {
  const dayScore = focusRace
    ? Math.max(0, Math.min(100, Math.round(focusRace.scoreValue * 10)))
    : 0;
  const alertCount = Math.max(0, stats.active - stats.playable);

  return (
    <section className="turf-home-header">
      <div className="turf-day-strip">
        <h1>{formatDisplayDate(selectedDate)}</h1>
        <div className="turf-day-strip__pills">
          <span>{stats.total} courses</span>
          <span>{stats.playable} validées</span>
          <span>{alertCount} alertes T-10</span>
        </div>
        <p>
          Score journée <strong>{dayScore || "--"} / 100</strong>
        </p>
      </div>

      <div className="turf-control-row">
        <div className="turf-signature-banner">
          <span className="turf-monogram" aria-hidden>
            P
          </span>

          <div className="turf-signature-banner__copy">
            <p className="turf-signature-banner__eyebrow">Signature PMU Gagnant</p>
            <p className="turf-signature-banner__title">L&apos;intelligence du terrain</p>
            <p className="turf-signature-banner__meta">ALGO V9.2 - lecture bankroll</p>
          </div>

          <blockquote className="turf-devise">
            <p>Jouer juste, jouer rare, jouer fort</p>
            <cite>PMU Gagnant</cite>
          </blockquote>
        </div>

        <div className="turf-date-tools">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPrevDay} className="app-button-secondary !px-4 !py-3">
              Jour precedent
            </button>
            <button type="button" onClick={onToday} className="app-button-secondary !px-4 !py-3">
              Aujourd&apos;hui
            </button>
            <button type="button" onClick={onNextDay} className="app-button-secondary !px-4 !py-3">
              Jour suivant
            </button>
          </div>

          <label className="block">
            <span className="sr-only">Choisir une date</span>
            <input
              type="date"
              className="app-input"
              value={toIsoDate(selectedDate)}
              onChange={(event) =>
                onDateChange(normalizeDateParam(event.target.value.replaceAll("-", "")))
              }
            />
          </label>

          <FilterPills options={SORT_OPTIONS} value={sortMode} onChange={onSortChange} />
        </div>
      </div>

      <div className="turf-kpi-grid">
        <div className="app-card-muted">
          <p className="app-label">Validées</p>
          <p>{stats.playable}</p>
          <span>sur {stats.total} courses</span>
        </div>
        <div className="app-card-muted">
          <p className="app-label">Confiance moy.</p>
          <p>{focusRace ? focusRace.scoreValue.toFixed(1) : "--"}</p>
          <span>/ 10</span>
        </div>
        <div className="app-card-muted">
          <p className="app-label">ROI semaine</p>
          <p>+8.3%</p>
          <span>{stats.active} courses actives</span>
        </div>
        <div className="app-card-muted turf-bankroll-kpi">
          <p className="app-label">Bankroll</p>
          <p>1 240 EUR</p>
          <span>+240 ce mois</span>
        </div>
      </div>
    </section>
  );
}

function HomeFocusPanel({
  focusRace,
  focusDetail,
  focusParticipants,
  isFocusLoading,
  stats,
  sortMode,
  onOpenRace,
  onOpenPremium,
}: {
  focusRace: FeaturedRace | null;
  focusDetail: FocusDetailResponse | null;
  focusParticipants: FocusParticipant[];
  isFocusLoading: boolean;
  stats: HomeStats;
  sortMode: SortMode;
  onOpenRace: (race: RaceSummary) => void;
  onOpenPremium: () => void;
}) {
  const { addSelection, isSelected, selections } = useCombo();

  if (!focusRace) {
    return (
      <section className="app-card p-6 md:p-7">
        <p className="app-kicker">Focus principal</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
          Le moteur attend le programme
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          La page restera volontairement simple : une course focus, puis des
          listes de courses par couleur. Dès que les données arrivent, le desk
          se remplit ici.
        </p>
      </section>
    );
  }

  const focusLisibilite =
    focusRace.score?.lisibilite ??
    focusDetail?.paywall?.preview?.lisibilite ??
    "COMPLEXE";
  const focusMinutes = formatMinutesLabel(
    focusDetail?.minutesUntilStart ?? focusRace.minutesUntilStart ?? null
  );
  const focusPickNum =
    focusRace.score?.pick?.numPmu ??
    focusDetail?.paywall?.preview?.favori?.numPmu ??
    null;
  const focusPickTitle =
    focusRace.score?.pick?.numPmu || focusRace.score?.pick?.nom
      ? `#${focusRace.score?.pick?.numPmu ?? "--"} ${focusRace.score?.pick?.nom ?? "Selection"}`
      : focusDetail?.paywall?.preview?.favori?.numPmu ||
          focusDetail?.paywall?.preview?.favori?.nom
        ? `#${focusDetail?.paywall?.preview?.favori?.numPmu ?? "--"} ${focusDetail?.paywall?.preview?.favori?.nom ?? "Favori"}`
    : "Ticket principal en préparation";
  const focusBetType = focusRace.score?.pick?.betType
    ? getBetTypeLabel(focusRace.score)
    : focusDetail?.analysis?.recommandation?.decision ??
      focusDetail?.paywall?.preview?.recommendation ??
      "En attente";
  const focusFactors = translateFactors(
    focusRace.score?.pick?.topFacteurs ??
      focusDetail?.analysis?.scoreConfiance?.facteurs ??
      []
  ).slice(0, 3);
  const focusPriority = focusRace.priorityBadge;
  const selectedParticipant =
    focusParticipants.find(
      (participant) => String(getParticipantNum(participant)) === String(focusPickNum)
    ) ?? focusParticipants[0] ?? null;
  const focusConfidence =
    focusRace.score?.pick?.confidence ??
    selectedParticipant?.prediction?.confiance ??
    null;
  const roleCandidate =
    focusDetail?.roles?.find(
      (role) => role.role === "PEPITE" || role.role === "OUTSIDER"
    ) ?? null;
  const scorePepite = focusRace.score?.pepiteDuJour ?? null;
  const comboCandidate = roleCandidate
    ? {
        role: (roleCandidate.role === "PEPITE" ? "PEPITE" : "OUTSIDER") as ComboRole,
        chevalNum: roleCandidate.cheval_num,
        chevalNom: roleCandidate.cheval_nom,
        cote: roleCandidate.cote,
        confiance: roleCandidate.confiance,
      }
    : scorePepite?.numPmu || scorePepite?.nom
      ? {
          role: "PEPITE" as ComboRole,
          chevalNum: scorePepite.numPmu ?? focusPickNum ?? 0,
          chevalNom: scorePepite.nom ?? focusPickTitle,
          cote: scorePepite.cote ?? selectedParticipant?.cote ?? 1,
          confiance: scorePepite.confidence ?? focusConfidence ?? 0,
        }
      : null;
  const comboId = comboCandidate
    ? `${focusRace.race.dateStr}-${focusRace.race.reunion}-${focusRace.race.course}-${comboCandidate.chevalNum}-${comboCandidate.role}`
    : "";
  const selectedInCombo = comboCandidate ? isSelected(comboId) : false;
  const comboFull = selections.length >= 4 && !selectedInCombo;

  return (
    <section className="app-card p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-kicker">Course à ouvrir</p>
            <span className="app-pill text-[11px]">{focusLisibilite.toLowerCase()}</span>
            {focusPriority ? (
              <span
                className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{
                  color: getPriorityToneColor(focusPriority.tone),
                  borderColor: `color-mix(in srgb, ${getPriorityToneColor(
                    focusPriority.tone
                  )} 24%, transparent)`,
                  background: `color-mix(in srgb, ${getPriorityToneColor(
                    focusPriority.tone
                  )} 10%, var(--pmu-surface))`,
                }}
              >
                {focusPriority.label}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[1.9rem] font-black text-[var(--pmu-text)] md:text-[2.35rem]">
            R{focusRace.race.reunion}C{focusRace.race.course}
          </p>
          <h2 className="mt-2 max-w-4xl text-[2.4rem] font-black leading-[0.94] text-[var(--pmu-text)] md:text-[3.1rem]">
            {focusRace.race.nomCourse}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            {focusRace.hint}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="app-pill text-xs">{formatRelativeDay(focusRace.race.dateStr)}</span>
          <span className="app-pill text-xs">
            {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Par heure"}
          </span>
          <span className="app-pill text-xs">{focusRace.race.hippodrome}</span>
          <span className="app-pill text-xs">{focusRace.race.heureDepart}</span>
          <span className="app-pill text-xs">{focusBetType}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-[1.35rem] border border-[color-mix(in_srgb,var(--pmu-primary)_16%,transparent)] bg-[var(--pmu-primary-fade)] p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="app-card-muted px-4 py-3.5 md:col-span-1">
              <p className="app-label">Radar</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-3xl font-black text-[var(--pmu-primary)] md:text-4xl">
                  {focusRace.scoreValue.toFixed(1)}/10
                </p>
              </div>
            </div>
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Fenêtre</p>
              <p className="mt-1 text-base font-black text-[var(--pmu-text)]">{focusMinutes}</p>
            </div>
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Ticket</p>
              <p className="mt-1 text-base font-black text-[var(--pmu-text)]">{focusPickTitle}</p>
            </div>
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Confiance</p>
              <p className="mt-1 text-base font-black text-[var(--pmu-text)]">
                {focusConfidence != null && Number.isFinite(focusConfidence)
                  ? `${focusConfidence.toFixed(1)}/10`
                  : "Lecture active"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="app-pill text-xs">{formatCourseMeta(focusRace.race)}</span>
            {(focusFactors.length > 0
              ? focusFactors
              : [
                  focusRace.race.estQuinte ? "Course Quinte" : "Course cible",
                  `${focusRace.race.nombrePartants} partants`,
                  "Lecture moteur",
                ]
            ).map((factor) => (
              <span key={factor} className="app-pill text-xs">
                {factor}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenRace(focusRace.race)}
              className="app-button-primary min-w-[14rem]"
            >
              Ouvrir la course
            </button>
            {focusDetail?.paywall?.required ? (
              <button
                type="button"
                onClick={onOpenPremium}
                className="app-button-secondary min-w-[14rem]"
              >
                Débloquer le ticket
              </button>
            ) : null}
            {comboCandidate ? (
              <button
                type="button"
                disabled={selectedInCombo || comboFull}
                onClick={() =>
                  addSelection({
                    id: comboId,
                    dateStr: focusRace.race.dateStr,
                    reunion: focusRace.race.reunion,
                    course: focusRace.race.course,
                    courseLabel: `R${focusRace.race.reunion}C${focusRace.race.course} ${focusRace.race.hippodrome}`,
                    cheval_num: comboCandidate.chevalNum,
                    cheval_nom: comboCandidate.chevalNom,
                    cote: comboCandidate.cote,
                    role: comboCandidate.role,
                    confiance: comboCandidate.confiance,
                    probability: comboCandidate.confiance / 10,
                  })
                }
                className="app-button-secondary min-w-[14rem] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {selectedInCombo
                  ? "Dans le combo"
                  : comboFull
                    ? "Combo complet"
                    : "+ Ajouter au combo"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="app-label">Ticket principal</p>
              <h3 className="mt-1 text-[1.9rem] font-black leading-[0.98] text-[var(--pmu-text)]">
                {focusPickTitle}
              </h3>
            </div>
            <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
              {focusBetType}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Cote repère</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
                {selectedParticipant
                  ? `Cote ${formatOddsLabel(selectedParticipant.cote)}`
                  : "Lecture PMU"}
              </p>
            </div>
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Actives</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">{stats.active} courses</p>
            </div>
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Rythme</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
                {focusPriority?.detail ?? "Suivi courant"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-label">Partants utiles</p>
            <h3 className="mt-1 text-[1.65rem] font-black text-[var(--pmu-text)]">
              Lecture dense sur les 5 chevaux à garder
            </h3>
          </div>
          <span className="app-pill text-xs">
            {focusParticipants.length > 0
              ? `${focusParticipants.length} lignes`
              : isFocusLoading
                ? "Chargement"
                : "Liste PMU"}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {isFocusLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-[1rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)]"
              />
            ))
          ) : focusParticipants.length > 0 ? (
            focusParticipants.map((participant) => {
              const num = getParticipantNum(participant);
              const confidence = participant.prediction?.confiance;

              return (
                <div
                  key={`${num}-${participant.nom ?? "cheval"}`}
                  className="grid items-center gap-3 rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-3 md:grid-cols-[auto,1.2fr,0.7fr,auto]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-fade)] text-base font-black text-[var(--pmu-text)]">
                    {Number.isFinite(num) ? num : "--"}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[var(--pmu-text)]">
                      {participant.nom ?? "Cheval"}
                    </p>
                    <p className="truncate text-sm text-[var(--pmu-text-soft)]">
                      {participant.jockey ?? participant.driver ?? "Jockey non renseigné"}
                      {participant.entraineur ? ` - ${participant.entraineur}` : ""}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
                      Lecture
                    </p>
                    <p className="truncate text-sm font-bold text-[var(--pmu-text)]">
                      {confidence != null && Number.isFinite(confidence)
                        ? `Confiance ${confidence.toFixed(1)}/10`
                        : "Lecture PMU"}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm font-black text-[var(--pmu-text)]">
                      Cote {formatOddsLabel(participant.cote)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Le détail course remontera ici dès que l&apos;API PMU donnera un bloc complet.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

type HomeComboAction = {
  cheval_num: number;
  cheval_nom: string;
  cote: number;
  role: ComboRole;
  confiance: number;
  score_cheval: number;
  variant: "pepite" | "outsider" | "surveillance";
  label: string;
};

function buildScoreFromConfidence(confidence?: number | null, fallback = 0) {
  const value = confidence ?? fallback;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10)));
}

function getComboActionForRace(item: FeaturedRace): HomeComboAction | null {
  const score = item.score;
  if (!score || score.decision === "REJET") {
    return null;
  }

  const roleCandidate = score.comboCandidate ?? null;

  if (score.decision === "VALIDE" && roleCandidate?.role === "PEPITE") {
    return {
      ...roleCandidate,
      variant: "pepite",
      label: `💎 Ajouter ${roleCandidate.cheval_nom} au combo`,
    };
  }

  if (score.decision === "VALIDE" && roleCandidate?.role === "OUTSIDER") {
    return {
      ...roleCandidate,
      variant: "outsider",
      label: `🚀 Ajouter ${roleCandidate.cheval_nom} au combo`,
    };
  }

  if (score.decision === "SURVEILLANCE" && score.pick?.numPmu != null) {
    const chevalNom = score.pick.nom ?? `N°${score.pick.numPmu}`;
    const confiance = score.pick.confidence ?? 0;

    return {
      cheval_num: score.pick.numPmu,
      cheval_nom: chevalNom,
      cote: score.pick.cote ?? roleCandidate?.cote ?? 1,
      role: "OUTSIDER",
      confiance,
      score_cheval: buildScoreFromConfidence(confiance, item.scoreValue),
      variant: "surveillance",
      label: `👁️ Ajouter ${chevalNom} en observation`,
    };
  }

  return null;
}

function CompactRaceCard({
  item,
  onOpenRace,
}: {
  item: FeaturedRace;
  onOpenRace: (race: RaceSummary) => void;
}) {
  const { addSelection, isSelected, selections } = useCombo();
  const toneColor = item.priorityBadge
    ? getPriorityToneColor(item.priorityBadge.tone)
    : "var(--pmu-text-muted)";
  const raceCode = formatRaceCode(item.race);
  const comboCandidate = getComboActionForRace(item);
  const comboId = comboCandidate
    ? `${item.race.dateStr}-${item.race.reunion}-${item.race.course}-${comboCandidate.cheval_num}-${comboCandidate.role}${
        comboCandidate.variant === "surveillance" ? "-surveillance" : ""
      }`
    : "";
  const selectedInCombo = comboCandidate ? isSelected(comboId) : false;
  const comboFull = selections.length >= 4 && !selectedInCombo;
  const comboButtonLabel = selectedInCombo
    ? "✓ Dans le combo"
    : comboFull
      ? "Combo complet"
      : comboCandidate?.label ?? "";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpenRace(item.race)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenRace(item.race);
        }
      }}
      data-status={item.status}
      className="app-card turf-course-card flex cursor-pointer flex-col items-start gap-3 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pmu-primary)]"
    >
      <div className="flex w-full flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_35%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1 text-[12px] font-black uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
              {raceCode}
            </span>
            <p className="app-kicker">
              Réunion {item.race.reunion} - Course {item.race.course}
            </p>
          </div>
          <h3 className="mt-1 text-[1.3rem] font-black leading-[1.02] text-[var(--pmu-text)]">
            {item.race.nomCourse}
          </h3>
        </div>
        <div
          className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            color: toneColor,
            borderColor: `color-mix(in srgb, ${toneColor} 24%, transparent)`,
            background: `color-mix(in srgb, ${toneColor} 10%, var(--pmu-surface))`,
          }}
        >
          {item.priorityBadge?.label ?? "À suivre"}
        </div>
      </div>

      <p className="text-sm leading-5 text-[var(--pmu-text-soft)]">
        {item.race.hippodrome} - {formatCourseMeta(item.race)}
      </p>

      <div className="grid w-full gap-3 sm:grid-cols-4">
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Score</p>
          <p className="mt-1 text-2xl font-black text-[var(--pmu-text)]">
            {item.scoreValue.toFixed(1)}/10
          </p>
        </div>
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Ticket</p>
          <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
            {getPickLabel(item.score)}
          </p>
        </div>
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Départ</p>
          <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
            {item.race.heureDepart} - {formatMinutesLabel(item.minutesUntilStart)}
          </p>
        </div>
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Signal</p>
          <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
            {item.score?.decision ?? item.status}
          </p>
        </div>
      </div>

      {comboCandidate ? (
        <button
          type="button"
          disabled={selectedInCombo || comboFull}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (selectedInCombo || comboFull) {
              return;
            }

            addSelection({
              id: comboId,
              dateStr: item.race.dateStr,
              reunion: item.race.reunion,
              course: item.race.course,
              courseLabel: `${raceCode} ${item.race.hippodrome}`,
              cheval_num: comboCandidate.cheval_num,
              cheval_nom: comboCandidate.cheval_nom,
              cote: comboCandidate.cote,
              role: comboCandidate.role,
              confiance: comboCandidate.confiance,
              probability: comboCandidate.confiance / 10,
            });
          }}
          className={`mt-auto w-full rounded-lg border px-4 py-3 text-sm font-black transition-colors disabled:cursor-not-allowed ${
            selectedInCombo || comboFull
              ? "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]"
              : comboCandidate.variant === "pepite"
                ? "border-[color-mix(in_srgb,var(--pmu-gold)_35%,transparent)] bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)] hover:bg-[color-mix(in_srgb,var(--pmu-gold-light)_82%,white)]"
                : comboCandidate.variant === "outsider"
                  ? "border-[color-mix(in_srgb,var(--pmu-primary)_32%,transparent)] bg-[#EAF3DE] text-[var(--pmu-primary)] hover:bg-[color-mix(in_srgb,var(--pmu-primary)_14%,var(--pmu-surface))]"
                  : "border-dashed border-[#F59E0B] bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]"
          }`}
        >
          {comboButtonLabel}
        </button>
      ) : null}
    </article>
  );
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V"];

function QuickFilterBar({
  value,
  options,
  onChange,
}: {
  value: QuickFilter;
  options: QuickFilterOption[];
  onChange: (next: QuickFilter) => void;
}) {
  const activeOption = options.find((option) => option.value === value);

  return (
    <section className="app-card p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="app-kicker">Filtre express</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
            Voir clair en un clic
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            Choisis un angle de lecture : le board cache le bruit, garde le focus
            et remet les courses importantes devant tes yeux.
          </p>
        </div>
        <div className="rounded-[0.8rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-fade)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
            Vue active
          </p>
          <p className="mt-1 text-xl font-black text-[var(--pmu-primary)]">
            {activeOption?.count ?? 0} course{(activeOption?.count ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="Filtre rapide du programme"
        className="mt-5 -mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        <div className="flex min-w-max gap-2 px-1">
          {options.map((option) => {
            const active = option.value === value;
            const disabled = option.value !== "all" && option.count === 0;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={`app-pill flex min-w-[9.5rem] flex-col items-start gap-1 whitespace-nowrap text-left disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? "app-pill--active" : ""
                }`}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <strong>{option.label}</strong>
                  <span>{option.count}</span>
                </span>
                <small className="text-[11px] font-medium normal-case tracking-normal text-[var(--pmu-text-soft)]">
                  {option.description}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomeAside({
  focusRace,
  focusParticipants,
  stats,
}: {
  focusRace: FeaturedRace | null;
  focusParticipants: FocusParticipant[];
  stats: HomeStats;
}) {
  const radarScore = focusRace
    ? Math.max(0, Math.min(100, Math.round(focusRace.scoreValue * 10)))
    : 0;
  const ticketRows = focusParticipants.slice(0, 3);
  const pick = focusRace?.score?.pick ?? null;
  const focusRaceMeta = focusRace
    ? {
        code: formatRaceCode(focusRace.race),
        hippodrome: focusRace.race.hippodrome,
        heureDepart: focusRace.race.heureDepart,
      }
    : null;

  return (
    <aside className="turf-home-aside" aria-label="Radar du jour">
      <section className="turf-aside-card turf-radar-card">
        <p className="app-kicker">Radar du jour</p>
        <div className="turf-radar-card__score">
          {radarScore || "--"}
        </div>
        <p className="app-label">Score journée - lisibilité</p>

        {focusRaceMeta ? (
          <div className="mt-4 rounded-[0.7rem] border border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
              Course focus
            </p>
            <p className="mt-1 text-xl font-black text-[var(--pmu-primary)]">
              {focusRaceMeta.code}
            </p>
            <p className="mt-1 text-xs text-[var(--pmu-text-soft)]">
              {focusRaceMeta.hippodrome} - {focusRaceMeta.heureDepart}
            </p>
          </div>
        ) : null}

        <div className="turf-radar-lines">
          <div>
            <span>Lisibilité</span>
            <i style={{ width: `${focusRace ? 82 : 36}%` }} />
          </div>
          <div>
            <span>Value</span>
            <i style={{ width: `${focusRace ? Math.max(34, radarScore - 10) : 28}%` }} />
          </div>
          <div>
            <span>Fiabilité</span>
            <i style={{ width: `${focusRace ? Math.max(38, radarScore - 4) : 30}%` }} />
          </div>
          <div>
            <span>Bankroll</span>
            <i className="is-gold" style={{ width: "64%" }} />
          </div>
        </div>
      </section>

      <section className="turf-aside-card turf-ticket-card">
        <header className="turf-ticket-card__header">
          <span>Ticket prioritaire</span>
          {focusRaceMeta ? (
            <span className="turf-ticket-card__race">
              {focusRaceMeta.code} · {focusRaceMeta.hippodrome.toLocaleUpperCase("fr-FR")}
            </span>
          ) : null}
        </header>
        <div className="turf-ticket-card__body">
          {ticketRows.length > 0 ? (
            ticketRows.map((participant, index) => {
              const num = getParticipantNum(participant);

              return (
                <div
                  key={`${num}-${participant.nom ?? "participant"}`}
                  className="turf-ticket-row"
                >
                  <span className="turf-ticket-row__rank">
                    {ROMAN_NUMERALS[index] ?? index + 1}
                  </span>
                  <div>
                    <p className="turf-ticket-row__horse">
                      {Number.isFinite(num) ? `${num} ` : ""}
                      {participant.nom ?? "Cheval"}
                    </p>
                    <small>
                      Cote {formatOddsLabel(participant.cote)} -{" "}
                      {participant.jockey ?? participant.driver ?? "monte à confirmer"}
                    </small>
                  </div>
                </div>
              );
            })
          ) : pick ? (
            <div className="turf-ticket-row">
              <span className="turf-ticket-row__rank">I</span>
              <div>
                <p className="turf-ticket-row__horse">
                  {pick.numPmu ? `${pick.numPmu} ` : ""}
                  {pick.nom ?? "Cheval principal"}
                </p>
                <small>{getBetTypeLabel(focusRace?.score)}</small>
              </div>
            </div>
          ) : (
            <p className="turf-ticket-card__empty">Ticket principal en préparation</p>
          )}
        </div>
      </section>

      <section className="turf-aside-card turf-aside-quote">
        <p>Jouer juste, jouer rare, jouer fort</p>
        <span>TurfEdge &middot; Algo v9.2</span>
        <small>
          {stats.playable} validée{stats.playable > 1 ? "s" : ""} sur {stats.total} courses
        </small>
      </section>
    </aside>
  );
}

function HomeLaneSection({
  lane,
  onOpenRace,
}: {
  lane: HomeLane;
  onOpenRace: (race: RaceSummary) => void;
}) {
  const meta = getBoardSectionMeta(lane.key);

  return (
    <section className="space-y-4">
      <div className="turf-lane-header flex flex-col gap-2 rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
              style={{
                color: meta.color,
                borderColor: `color-mix(in srgb, ${meta.color} 24%, transparent)`,
                background: `color-mix(in srgb, ${meta.color} 10%, var(--pmu-surface))`,
              }}
            >
              {meta.label}
            </span>
            <span className="text-sm font-semibold text-[var(--pmu-text-muted)]">
              {lane.items.length} course{lane.items.length > 1 ? "s" : ""}
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-black text-[var(--pmu-text)]">
            {meta.title}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            {meta.description}
          </p>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        {lane.items.map((item) => (
          <CompactRaceCard
            key={`${lane.key}-${item.race.reunion}-${item.race.course}`}
            item={item}
            onOpenRace={onOpenRace}
          />
        ))}
      </div>
    </section>
  );
}

function HomeLoadingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8"
      aria-busy="true"
      aria-label="Chargement du programme"
    >
      <div className="app-card h-44 animate-pulse bg-[var(--pmu-surface-highlight)]" />
      <div className="grid gap-5 xl:grid-cols-[0.37fr,0.63fr]">
        <div className="app-card h-[30rem] animate-pulse bg-[var(--pmu-surface-highlight)]" />
        <div className="app-card h-[30rem] animate-pulse bg-[var(--pmu-surface-highlight)]" />
      </div>
      <div className="grid gap-5 2xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="app-card h-72 animate-pulse bg-[var(--pmu-surface-highlight)]"
          />
        ))}
      </div>
    </div>
  );
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = normalizeDateParam(searchParams.get("date"));

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFocusLoading, setIsFocusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [focusDetail, setFocusDetail] = useState<FocusDetailResponse | null>(null);

  const navigateToRace = useCallback(
    (race: RaceSummary) => {
      router.push(`/course/${race.reunion}/${race.course}?date=${race.dateStr}`);
    },
    [router]
  );

  useEffect(() => {
    try {
      const storedSort = window.localStorage.getItem("pmu-sort-mode");
      if (
        storedSort === "hour" ||
        storedSort === "score" ||
        storedSort === "urgent" ||
        storedSort === "allocation"
      ) {
        setSortMode(storedSort);
      }
    } catch (effectError) {
      console.error(effectError);
    }
  }, []);

  useEffect(() => {
    try {
      const storedFilter = window.localStorage.getItem(QUICK_FILTER_STORAGE_KEY);
      if (isQuickFilter(storedFilter)) {
        setQuickFilter(storedFilter);
      }
    } catch (effectError) {
      console.error(effectError);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pmu-sort-mode", sortMode);
    } catch (effectError) {
      console.error(effectError);
    }
  }, [sortMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUICK_FILTER_STORAGE_KEY, quickFilter);
    } catch (effectError) {
      console.error(effectError);
    }
  }, [quickFilter]);

  useEffect(() => {
    try {
      const currentParam = normalizeDateParam(searchParams.get("date"));
      if (currentParam === selectedDate) return;

      const nextPath =
        selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`;
      router.replace(nextPath, { scroll: false });
    } catch (effectError) {
      console.error(effectError);
    }
  }, [router, searchParams, selectedDate]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [racesResponse, scoresResponse] = await Promise.all([
          fetchRacesForDate<RacesResponse>(selectedDate, ac.signal),
          fetchRaceScoresForDate<ScoresResponse>(selectedDate, ac.signal),
        ]);

        if (!racesResponse.success) {
        throw new Error("Le service courses a renvoyé une réponse invalide.");
        }

        const scoresJson = scoresResponse ?? { success: true, scores: [] };

        if (!cancelled) {
          setRaces(coerceRaceSummaries(racesResponse.races));
          setScores(
            scoresJson.success
              ? normalizeRaceScoresPayload<RaceScore>(
                  scoresJson.scores ?? null,
                  selectedDate
                )
              : []
          );
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error && loadError.name === "AbortError") return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger la page Courses."
        );
        setRaces([]);
        setScores([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedDate, fetchRevision]);

  const featuredRaces = useMemo(() => {
    const normalizedScores = normalizeRaceScoresPayload<RaceScore>(scores, selectedDate);
    const map = new Map(
      normalizedScores.map((score) => [`${score.reunion}-${score.course}`, score])
    );

    return sortFeaturedRaces(
      buildFeaturedRaces(coerceRaceSummaries(races), map),
      sortMode
    );
  }, [races, scores, selectedDate, sortMode]);

  const focusRace = useMemo(() => getRadarRace(featuredRaces), [featuredRaces]);
  const topParisItems = useMemo(
    () => getTopParisItems(featuredRaces, navigateToRace),
    [featuredRaces, navigateToRace]
  );
  const topParisCodes = useMemo(
    () => new Set(topParisItems.map((item) => item.raceCode)),
    [topParisItems]
  );
  const quickFilterOptions = useMemo<QuickFilterOption[]>(
    () => [
      {
        value: "all",
        label: "Tout",
        description: "Programme complet",
        count: featuredRaces.length,
      },
      {
        value: "top3",
        label: "Top 3",
        description: "Priorites nettes",
        count: featuredRaces.filter((item) => topParisCodes.has(formatRaceCode(item.race))).length,
      },
      {
        value: "jouable",
        label: "Jouables",
        description: "Feu vert moteur",
        count: featuredRaces.filter((item) => item.status === "jouable").length,
      },
      {
        value: "urgent",
        label: "Départ proche",
        description: `Moins de ${URGENT_MINUTES_LIMIT} min`,
        count: featuredRaces.filter(
          (item) =>
            item.status !== "resultat" && item.minutesUntilStart <= URGENT_MINUTES_LIMIT
        ).length,
      },
      {
        value: "quinte",
        label: "Quintes",
        description: "Courses premium",
        count: featuredRaces.filter((item) => item.race.estQuinte).length,
      },
      {
        value: "allocation",
        label: "Gros enjeux",
        description: `Allocation ${BIG_ALLOCATION_LIMIT / 1000}k+`,
        count: featuredRaces.filter(
          (item) => (item.race.allocation ?? 0) >= BIG_ALLOCATION_LIMIT
        ).length,
      },
    ],
    [featuredRaces, topParisCodes]
  );
  const filteredFeaturedRaces = useMemo(() => {
    switch (quickFilter) {
      case "top3":
        return featuredRaces.filter((item) => topParisCodes.has(formatRaceCode(item.race)));
      case "jouable":
        return featuredRaces.filter((item) => item.status === "jouable");
      case "urgent":
        return featuredRaces.filter(
          (item) =>
            item.status !== "resultat" && item.minutesUntilStart <= URGENT_MINUTES_LIMIT
        );
      case "quinte":
        return featuredRaces.filter((item) => item.race.estQuinte);
      case "allocation":
        return featuredRaces.filter(
          (item) => (item.race.allocation ?? 0) >= BIG_ALLOCATION_LIMIT
        );
      case "all":
      default:
        return featuredRaces;
    }
  }, [featuredRaces, quickFilter, topParisCodes]);

  useEffect(() => {
    if (!focusRace) {
      setFocusDetail(null);
      setIsFocusLoading(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    async function loadFocusDetail() {
      setIsFocusLoading(true);

      try {
        const payload = await fetchRaceDetails<FocusDetailResponse>(
          focusRace.race.reunion,
          focusRace.race.course,
          { date: selectedDate, signal: ac.signal }
        );

        if (!cancelled) {
          setFocusDetail(payload.success === false ? null : payload);
        }
      } catch (focusError) {
        if (cancelled) return;
        if (focusError instanceof Error && focusError.name === "AbortError") return;
        console.error(focusError);
        setFocusDetail(null);
      } finally {
        if (!cancelled) {
          setIsFocusLoading(false);
        }
      }
    }

    void loadFocusDetail();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [focusRace, selectedDate]);

  const focusParticipants = useMemo(() => {
    const ranking = normalizeFocusParticipants(focusDetail?.analysis?.ranking);
    if (ranking.length > 0) {
      return ranking.slice(0, 5);
    }

    return normalizeFocusParticipants(focusDetail?.participants)
      .sort((left, right) => {
        const leftScore = left.prediction?.scoreCheval ?? -1;
        const rightScore = right.prediction?.scoreCheval ?? -1;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        const leftOdds = left.cote ?? Number.POSITIVE_INFINITY;
        const rightOdds = right.cote ?? Number.POSITIVE_INFINITY;
        return leftOdds - rightOdds;
      })
      .slice(0, 5);
  }, [focusDetail]);

  const stats = useMemo<HomeStats>(() => {
    const meetings = new Set(races.map((race) => race.reunion)).size;
    const playable = featuredRaces.filter((item) => item.status === "jouable").length;
    const active = featuredRaces.filter((item) => item.status !== "resultat").length;
    return {
      total: races.length,
      meetings,
      playable,
      active,
    };
  }, [featuredRaces, races]);

  const lanes = useMemo<HomeLane[]>(() => {
    const activeLanes: HomeLane[] = [
      {
        key: "jouable" as const,
        items: filteredFeaturedRaces.filter((item) => item.status === "jouable"),
      },
      {
        key: "surveillance" as const,
        items: filteredFeaturedRaces.filter((item) => item.status === "surveillance"),
      },
      {
        key: "passer" as const,
        items: filteredFeaturedRaces.filter((item) => item.status === "passer"),
      },
    ].filter((lane) => lane.items.length > 0);

    if (activeLanes.length > 0) {
      return activeLanes;
    }

    const results = filteredFeaturedRaces.filter((item) => item.status === "resultat");
    return results.length > 0 ? [{ key: "resultat", items: results }] : [];
  }, [filteredFeaturedRaces]);

  return (
    <div className="turf-home-page mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <HomeControlBar
        selectedDate={selectedDate}
        sortMode={sortMode}
        stats={stats}
        focusRace={focusRace}
        onPrevDay={() => setSelectedDate(addDays(selectedDate, -1))}
        onToday={() => setSelectedDate(getTodayDateStr())}
        onNextDay={() => setSelectedDate(addDays(selectedDate, 1))}
        onDateChange={setSelectedDate}
        onSortChange={setSortMode}
      />

      <div className="turf-main-layout">
        <div className="turf-main-column">
          {isLoading ? (
            <HomeLoadingSkeleton />
          ) : error ? (
            <section
              className="app-card border border-[color-mix(in_srgb,var(--pmu-red)_35%,transparent)] p-6"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-lg font-bold text-[var(--pmu-red)]">
                Impossible de charger la page Courses
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                {error}
              </p>
              <button
                type="button"
                className="app-button-primary mt-4"
                onClick={() => setFetchRevision((revision) => revision + 1)}
              >
                Réessayer
              </button>
            </section>
          ) : featuredRaces.length === 0 ? (
            <section className="app-card p-8 text-center">
              <p className="text-xl font-black text-[var(--pmu-text)]">
                Aucune course exploitable pour cette date
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
                La home reste volontairement simple : un focus, puis les courses par
                couleur. Recharge la journée ou change de date.
              </p>
            </section>
          ) : (
            <>
              <HomeFocusPanel
                focusRace={focusRace}
                focusDetail={focusDetail}
                focusParticipants={focusParticipants}
                isFocusLoading={isFocusLoading}
                stats={stats}
                sortMode={sortMode}
                onOpenRace={navigateToRace}
                onOpenPremium={() => router.push("/premium")}
              />

              {topParisItems.length > 0 ? (
                <TopParisStrip items={topParisItems} />
              ) : null}

              <QuickFilterBar
                value={quickFilter}
                options={quickFilterOptions}
                onChange={setQuickFilter}
              />

              {stats.playable === 0 && lanes.some((lane) => lane.key === "surveillance") ? (
                <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Aucune course verte pour l&apos;instant. La meilleure surveillance
                  reste visible juste en dessous pour garder une ouverture prioritaire.
                </section>
              ) : null}

              {lanes.length > 0 ? (
                <section className="space-y-6">
                  {lanes.map((lane) => (
                    <HomeLaneSection
                      key={lane.key}
                      lane={lane}
                      onOpenRace={navigateToRace}
                    />
                  ))}
                </section>
              ) : (
                <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Ce filtre ne sort aucune course sur cette date. Repasse en vue
                  complète pour revoir tout le programme.
                  <button
                    type="button"
                    className="app-button-secondary mt-4"
                    onClick={() => setQuickFilter("all")}
                  >
                    Revoir tout
                  </button>
                </section>
              )}
            </>
          )}
        </div>

        <HomeAside
          focusRace={focusRace}
          focusParticipants={focusParticipants}
          stats={stats}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoadingSkeleton />}>
      <PageContent />
    </Suspense>
  );
}
