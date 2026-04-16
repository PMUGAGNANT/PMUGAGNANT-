import { useCombo, type ComboRole } from "@/components/ComboBuilder";
import { translateFactors } from "@/lib/beginner-labels";
import { getPriorityToneColor } from "@/lib/race-priority";
import type { RaceSummary } from "@/lib/types";
import {
  SORT_OPTIONS,
  formatCourseMeta,
  formatMinutesLabel,
  formatOddsLabel,
  formatRelativeDay,
  getBetTypeLabel,
  getParticipantNum,
  type FeaturedRace,
  type FocusDetailResponse,
  type FocusParticipant,
  type SortMode,
} from "@/features/home/lib/home-page-model";
import type { HomeStats } from "@/features/home/components/home-page-types";

export function PriorityTickets({
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
          Une course focus, puis des listes de courses par couleur. Des que les
          donnees arrivent, le desk se remplit ici.
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
            <p className="app-kicker">Course a ouvrir</p>
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
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Radar</p>
              <p className="mt-1 text-3xl font-black text-[var(--pmu-primary)] md:text-4xl">
                {focusRace.scoreValue.toFixed(1)}/10
              </p>
            </div>
            <div className="app-card-muted px-4 py-3.5">
              <p className="app-label">Fenetre</p>
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
            <button type="button" onClick={() => onOpenRace(focusRace.race)} className="app-button-primary min-w-[14rem]">
              Ouvrir la course
            </button>
            {focusDetail?.paywall?.required ? (
              <button type="button" onClick={onOpenPremium} className="app-button-secondary min-w-[14rem]">
                Debloquer le ticket
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
                {selectedInCombo ? "Dans le combo" : comboFull ? "Combo complet" : "+ Ajouter au combo"}
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
              <p className="app-label">Cote repere</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
                {selectedParticipant ? `Cote ${formatOddsLabel(selectedParticipant.cote)}` : "Lecture PMU"}
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
              Lecture dense sur les 5 chevaux a garder
            </h3>
          </div>
          <span className="app-pill text-xs">
            {focusParticipants.length > 0 ? `${focusParticipants.length} lignes` : isFocusLoading ? "Chargement" : "Liste PMU"}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {isFocusLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-[1rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)]" />
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
                      {participant.jockey ?? participant.driver ?? "Jockey non renseigne"}
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
              Le detail course remontera ici des que l&apos;API PMU donnera un bloc complet.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
