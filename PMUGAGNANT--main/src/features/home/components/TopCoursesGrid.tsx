import { useMemo, useState } from "react";
import { useCombo, type ComboRole } from "@/components/ComboBuilder";
import { getPriorityToneColor } from "@/lib/race-priority";
import type { RaceSummary } from "@/lib/types";
import {
  formatCourseMeta,
  formatMinutesLabel,
  formatOddsLabel,
  formatRaceCode,
  formatStake,
  getBoardSectionMeta,
  getPickLabel,
  type FeaturedRace,
} from "@/features/home/lib/home-page-model";
import type { HomeLane } from "@/features/home/components/home-page-types";

const INITIAL_VISIBLE_COURSES = 8;
const VISIBLE_COURSES_STEP = 8;

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
      label: `Ajouter ${roleCandidate.cheval_nom} au combo`,
    };
  }

  if (score.decision === "VALIDE" && roleCandidate?.role === "OUTSIDER") {
    return {
      ...roleCandidate,
      variant: "outsider",
      label: `Ajouter ${roleCandidate.cheval_nom} au combo`,
    };
  }

  if (score.decision === "SURVEILLANCE" && score.pick?.numPmu != null) {
    const chevalNom = score.pick.nom ?? `N ${score.pick.numPmu}`;
    const confiance = score.pick.confidence ?? 0;

    return {
      cheval_num: score.pick.numPmu,
      cheval_nom: chevalNom,
      cote: score.pick.cote ?? roleCandidate?.cote ?? 1,
      role: "OUTSIDER",
      confiance,
      score_cheval: buildScoreFromConfidence(confiance, item.scoreValue),
      variant: "surveillance",
      label: `Ajouter ${chevalNom} en observation`,
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
    ? "Dans le combo"
    : comboFull
      ? "Combo complet"
      : comboCandidate?.label ?? "";
  const decision =
    item.status === "jouable"
      ? { label: "JOUER", tone: "success" as const }
      : item.status === "surveillance"
        ? { label: "SURVEILLER", tone: "warning" as const }
        : { label: "PASSER", tone: "neutral" as const };
  const stakeValue = item.score?.pick?.stake ?? null;
  const stake = formatStake(stakeValue);
  const odds = item.score?.pick?.cote ?? null;
  const grossReturn =
    typeof stakeValue === "number" &&
    Number.isFinite(stakeValue) &&
    typeof odds === "number" &&
    Number.isFinite(odds) &&
    odds > 0
      ? stakeValue * odds
      : null;

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
            <span className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_35%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1 text-[12px] font-black uppercase text-[var(--pmu-primary)]">
              {raceCode}
            </span>
            <p className="app-kicker">
              Reunion {item.race.reunion} - Course {item.race.course}
            </p>
          </div>
          <h3 className="mt-1 text-[1.3rem] font-black leading-[1.02] text-[var(--pmu-text)]">
            {item.race.nomCourse}
          </h3>
        </div>
        <div
          className="rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase"
          style={{
            color: toneColor,
            borderColor: `color-mix(in srgb, ${toneColor} 24%, transparent)`,
            background: `color-mix(in srgb, ${toneColor} 10%, var(--pmu-surface))`,
          }}
        >
          {item.priorityBadge?.label ?? "A suivre"}
        </div>
      </div>

      <p className="text-sm leading-5 text-[var(--pmu-text-soft)]">
        {item.race.hippodrome} - {formatCourseMeta(item.race)}
      </p>

      <div className="grid w-full gap-3 sm:grid-cols-4">
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Decision</p>
          <p className="mt-2">
            <span className="turf-decision-badge" data-tone={decision.tone}>
              {decision.label}
            </span>
          </p>
        </div>
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Cheval</p>
          <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
            {getPickLabel(item.score)}
          </p>
        </div>
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Mise</p>
          <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
            {item.score?.scoreLocked
              ? "Mise PRO masquee"
              : grossReturn
                ? `${stake} -> ${formatStake(grossReturn)}`
                : `${stake} - cote ${formatOddsLabel(odds)}`}
          </p>
        </div>
        <div className="app-card-muted px-3 py-3">
          <p className="app-label">Confiance</p>
          <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
            {item.scoreValue.toFixed(1)}/10 - {formatMinutesLabel(item.minutesUntilStart)}
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

export function TopCoursesGrid({
  lane,
  onOpenRace,
}: {
  lane: HomeLane;
  onOpenRace: (race: RaceSummary) => void;
}) {
  const meta = getBoardSectionMeta(lane.key);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COURSES);
  const visibleItems = useMemo(
    () => lane.items.slice(0, visibleCount),
    [lane.items, visibleCount]
  );
  const remainingCount = Math.max(lane.items.length - visibleItems.length, 0);

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
        {visibleItems.map((item) => (
          <CompactRaceCard
            key={`${lane.key}-${item.race.reunion}-${item.race.course}`}
            item={item}
            onOpenRace={onOpenRace}
          />
        ))}
      </div>

      {remainingCount > 0 ? (
        <button
          type="button"
          className="app-button-secondary w-full"
          onClick={() =>
            setVisibleCount((current) =>
              Math.min(current + VISIBLE_COURSES_STEP, lane.items.length)
            )
          }
        >
          Afficher {Math.min(remainingCount, VISIBLE_COURSES_STEP)} course
          {Math.min(remainingCount, VISIBLE_COURSES_STEP) > 1 ? "s" : ""} de plus
        </button>
      ) : null}
    </section>
  );
}
