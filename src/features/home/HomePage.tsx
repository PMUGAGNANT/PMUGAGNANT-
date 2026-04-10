"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { translateFactors } from "@/lib/beginner-labels";
import { getPriorityToneColor } from "@/lib/race-priority";
import type { RaceSummary } from "@/lib/types";
import { FilterPills } from "@/features/home/components/FilterPills";
import {
  SORT_OPTIONS,
  addDays,
  buildFeaturedRaces,
  coerceRaceSummaries,
  formatCourseMeta,
  formatDisplayDate,
  formatMinutesLabel,
  formatOddsLabel,
  formatRelativeDay,
  getBetTypeLabel,
  getBoardSectionMeta,
  getParticipantNum,
  getPickLabel,
  getRadarRace,
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
  return (
    <section className="app-card p-4 md:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div>
            <p className="app-kicker">Poste de decision</p>
            <h1 className="mt-2 text-3xl font-black capitalize tracking-tight text-[var(--pmu-text)] md:text-4xl">
              {formatDisplayDate(selectedDate)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
              Une seule mission ici : choisir la journee, laisser le moteur
              designer une course focus, puis ouvrir le meilleur spot sans bruit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPrevDay} className="app-button-secondary">
              Jour precedent
            </button>
            <button type="button" onClick={onToday} className="app-button-secondary">
              Aujourd&apos;hui
            </button>
            <button type="button" onClick={onNextDay} className="app-button-secondary">
              Jour suivant
            </button>
          </div>
        </div>

        <div className="flex w-full max-w-[44rem] flex-col gap-3">
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Programme</p>
          <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            {stats.total}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Jouables</p>
          <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            {stats.playable}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Reunions</p>
          <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            {stats.meetings}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Focus</p>
          <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
            {focusRace
              ? `R${focusRace.race.reunion}C${focusRace.race.course}`
              : "Aucune course"}
          </p>
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
  if (!focusRace) {
    return (
      <section className="app-card p-6 md:p-7">
        <p className="app-kicker">Focus principal</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
          Le moteur attend le programme
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          La page restera volontairement simple : une course focus, puis des
          listes de courses par couleur. Des que les donnees arrivent, le desk
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
        : "Ticket principal en preparation";
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

  return (
    <section className="grid gap-5 xl:grid-cols-[0.37fr,0.63fr] xl:items-start">
      <aside className="app-card p-5 md:p-6 xl:sticky xl:top-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="app-kicker">Course a ouvrir</p>
            <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
              R{focusRace.race.reunion}C{focusRace.race.course}
            </p>
          </div>
          <span className="app-pill text-[11px]">{focusLisibilite.toLowerCase()}</span>
        </div>

        <h2 className="mt-5 text-[2rem] font-black leading-[0.94] text-[var(--pmu-text)]">
          {focusRace.race.nomCourse}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
          {focusRace.hint}
        </p>

        <div className="mt-5 rounded-[1.45rem] border border-[color-mix(in_srgb,var(--pmu-primary)_20%,transparent)] bg-[linear-gradient(180deg,var(--pmu-primary-fade)_0%,color-mix(in_srgb,var(--pmu-surface)_94%,transparent)_100%)] px-4 py-4">
          <p className="app-label">Radar</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-4xl font-black text-[var(--pmu-primary)]">
              {focusRace.scoreValue.toFixed(1)}/10
            </p>
            <p className="text-right text-xs uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
              {focusConfidence != null && Number.isFinite(focusConfidence)
                ? `Confiance ${focusConfidence.toFixed(1)}/10`
                : "Lecture active"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="app-card-muted px-4 py-4">
            <p className="app-label">Fenetre</p>
            <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
              {focusMinutes}
            </p>
          </div>
          <div className="app-card-muted px-4 py-4">
            <p className="app-label">Ticket</p>
            <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
              {focusPickTitle}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="app-pill text-xs">{focusRace.race.hippodrome}</span>
          <span className="app-pill text-xs">{focusRace.race.heureDepart}</span>
          <span className="app-pill text-xs">{formatCourseMeta(focusRace.race)}</span>
          <span className="app-pill text-xs">{focusBetType}</span>
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
              {focusPriority.label} - {focusPriority.detail}
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onOpenRace(focusRace.race)}
            className="app-button-primary w-full"
          >
            Ouvrir la course
          </button>
          {focusDetail?.paywall?.required ? (
            <button
              type="button"
              onClick={onOpenPremium}
              className="app-button-secondary w-full"
            >
              Debloquer le ticket
            </button>
          ) : null}
        </div>
      </aside>

      <section className="app-card p-6 md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="app-kicker">Pourquoi maintenant</p>
            <h3 className="mt-2 text-[2.2rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[3rem]">
              Le ticket et les partants utiles dans le meme cadre
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="app-pill text-xs">
              {formatRelativeDay(focusRace.race.dateStr)}
            </span>
            <span className="app-pill text-xs">
              {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Par heure"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[0.94fr,1.06fr]">
          <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="app-label">Ticket principal</p>
                <h4 className="mt-2 text-3xl font-black leading-[0.96] text-[var(--pmu-text)]">
                  {focusPickTitle}
                </h4>
              </div>
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
                {focusBetType}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
              Le moteur pousse une seule course ici pour eviter les doublons et
              garder la meilleure lecture ouverte.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Score</p>
                <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  {focusRace.scoreValue.toFixed(1)}/10
                </p>
              </div>
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Cote repere</p>
                <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                  {selectedParticipant
                    ? `Cote ${formatOddsLabel(selectedParticipant.cote)}`
                    : "Lecture PMU"}
                </p>
              </div>
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Actives</p>
                <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                  {stats.active} courses
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(focusFactors.length > 0
                ? focusFactors
                : [
                    focusRace.race.estQuinte ? "Course Quinte" : "Course cible",
                    `${focusRace.race.nombrePartants} partants`,
                    focusMinutes,
                  ]
              ).map((factor) => (
                <span key={factor} className="app-pill text-xs">
                  {factor}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-label">Partants utiles</p>
                <h4 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  Les chevaux a garder a l ecran
                </h4>
              </div>
              <span className="app-pill text-xs">
                {focusParticipants.length > 0
                  ? `${focusParticipants.length} lignes`
                  : isFocusLoading
                    ? "Chargement"
                    : "Liste PMU"}
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {isFocusLoading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-[1.1rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)]"
                  />
                ))
              ) : focusParticipants.length > 0 ? (
                focusParticipants.map((participant) => {
                  const num = getParticipantNum(participant);
                  const confidence = participant.prediction?.confiance;

                  return (
                    <div
                      key={`${num}-${participant.nom ?? "cheval"}`}
                      className="grid gap-3 rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-4 md:grid-cols-[auto,1fr,auto]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-fade)] text-lg font-black text-[var(--pmu-text)]">
                        {Number.isFinite(num) ? num : "--"}
                      </div>

                      <div>
                        <p className="text-base font-black text-[var(--pmu-text)]">
                          {participant.nom ?? "Cheval"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--pmu-text-soft)]">
                          {participant.jockey ??
                            participant.driver ??
                            "Jockey non renseigne"}
                          {participant.entraineur
                            ? ` - ${participant.entraineur}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-sm font-black text-[var(--pmu-text)]">
                          Cote {formatOddsLabel(participant.cote)}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
                          {confidence != null && Number.isFinite(confidence)
                            ? `Confiance ${confidence.toFixed(1)}/10`
                            : "Lecture PMU"}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Le detail course remontera ici des que l API PMU donnera un
                  bloc complet.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </section>
  );
}

function CompactRaceCard({
  item,
  onOpenRace,
}: {
  item: FeaturedRace;
  onOpenRace: (race: RaceSummary) => void;
}) {
  const toneColor = item.priorityBadge
    ? getPriorityToneColor(item.priorityBadge.tone)
    : "var(--pmu-text-muted)";

  return (
    <button
      type="button"
      onClick={() => onOpenRace(item.race)}
      className="app-card flex h-full flex-col items-start gap-4 p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex w-full flex-wrap items-start justify-between gap-3">
        <div>
          <p className="app-kicker">
            R{item.race.reunion}C{item.race.course}
          </p>
          <h3 className="mt-2 text-[1.55rem] font-black leading-[1] text-[var(--pmu-text)]">
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
          {item.priorityBadge?.label ?? "A suivre"}
        </div>
      </div>

      <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">
        {item.race.hippodrome} - {formatCourseMeta(item.race)}
      </p>

      <div className="grid w-full gap-3 sm:grid-cols-3">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Score</p>
          <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            {item.scoreValue.toFixed(1)}/10
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Ticket</p>
          <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
            {getPickLabel(item.score)}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Depart</p>
          <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
            {item.race.heureDepart} - {formatMinutesLabel(item.minutesUntilStart)}
          </p>
        </div>
      </div>
    </button>
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
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-5 py-5 md:flex-row md:items-start md:justify-between">
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
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            {meta.description}
          </p>
        </div>
      </div>

      <div className="grid auto-rows-fr gap-5 2xl:grid-cols-2">
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
      <div className="app-card h-44 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
      <div className="grid gap-5 xl:grid-cols-[0.37fr,0.63fr]">
        <div className="app-card h-[30rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        <div className="app-card h-[30rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
      </div>
      <div className="grid gap-5 2xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="app-card h-72 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
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
      window.localStorage.setItem("pmu-sort-mode", sortMode);
    } catch (effectError) {
      console.error(effectError);
    }
  }, [sortMode]);

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
          throw new Error("Le service courses a renvoye une reponse invalide.");
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
        items: featuredRaces.filter((item) => item.status === "jouable"),
      },
      {
        key: "surveillance" as const,
        items: featuredRaces.filter((item) => item.status === "surveillance"),
      },
      {
        key: "passer" as const,
        items: featuredRaces.filter((item) => item.status === "passer"),
      },
    ].filter((lane) => lane.items.length > 0);

    if (activeLanes.length > 0) {
      return activeLanes;
    }

    const results = featuredRaces.filter((item) => item.status === "resultat");
    return results.length > 0 ? [{ key: "resultat", items: results }] : [];
  }, [featuredRaces]);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
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
            Reessayer
          </button>
        </section>
      ) : featuredRaces.length === 0 ? (
        <section className="app-card p-8 text-center">
          <p className="text-xl font-black text-[var(--pmu-text)]">
            Aucune course exploitable pour cette date
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
            La home reste volontairement simple : un focus, puis les courses par
            couleur. Recharge la journee ou change de date.
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

          {stats.playable === 0 && lanes.some((lane) => lane.key === "surveillance") ? (
            <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Aucune course verte pour l&apos;instant. La meilleure surveillance
              reste visible juste en dessous pour garder une ouverture prioritaire.
            </section>
          ) : null}

          <section className="space-y-6">
            {lanes.map((lane) => (
              <HomeLaneSection
                key={lane.key}
                lane={lane}
                onOpenRace={navigateToRace}
              />
            ))}
          </section>
        </>
      )}
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
