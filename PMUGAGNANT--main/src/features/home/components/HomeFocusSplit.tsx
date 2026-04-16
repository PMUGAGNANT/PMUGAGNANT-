import { translateFactors } from "@/lib/beginner-labels";
import { formatBetTypeLabelFr } from "@/lib/client-race-scoring";
import { getPriorityToneColor } from "@/lib/race-priority";
import type { RaceSummary } from "@/lib/types";
import {
  formatCourseMeta,
  formatMinutesLabel,
  formatOddsLabel,
  formatRelativeDay,
  getBoardPriorityBadge,
  getParticipantNum,
  getStageLabel,
  type FeaturedRace,
  type FocusDetailResponse,
  type FocusParticipant,
} from "@/features/home/lib/home-page-model";

export function HomeFocusSplit({
  focusRace,
  selectedDate,
  focusDetail,
  focusParticipants,
  isFocusLoading,
  summaryStats,
  sortModeLabel,
  onOpenRace,
  onOpenPremium,
}: {
  focusRace: FeaturedRace;
  selectedDate: string;
  focusDetail: FocusDetailResponse | null;
  focusParticipants: FocusParticipant[];
  isFocusLoading: boolean;
  summaryStats: { meetings: number; playable: number };
  sortModeLabel: string;
  onOpenRace: (race: RaceSummary) => void;
  onOpenPremium: () => void;
}) {
  const focusDisplayScore = focusRace.scoreValue.toFixed(1);
  const focusPriorityBadge = getBoardPriorityBadge(focusRace);
  const focusPickNum =
    focusRace.score?.pick?.numPmu ??
    focusDetail?.paywall?.preview?.favori?.numPmu ??
    null;
  const focusLisibilite =
    focusRace.score?.lisibilite ??
    focusDetail?.paywall?.preview?.lisibilite ??
    "COMPLEXE";
  const focusBetType = focusRace.score?.pick?.betType
    ? formatBetTypeLabelFr(focusRace.score.pick.betType)
    : focusDetail?.analysis?.recommandation?.decision ??
      focusDetail?.paywall?.preview?.recommendation ??
      "En attente";
  const focusPickTitle =
    focusRace.score?.pick?.numPmu || focusRace.score?.pick?.nom
      ? `#${focusRace.score?.pick?.numPmu ?? "--"} ${focusRace.score?.pick?.nom ?? "Selection"}`
      : focusDetail?.paywall?.preview?.favori?.numPmu ||
          focusDetail?.paywall?.preview?.favori?.nom
        ? `#${focusDetail?.paywall?.preview?.favori?.numPmu ?? "--"} ${focusDetail?.paywall?.preview?.favori?.nom ?? "Favori"}`
        : "Ticket principal en preparation";
  const focusFactors = translateFactors(
    focusRace.score?.pick?.topFacteurs ??
      focusDetail?.analysis?.scoreConfiance?.facteurs ??
      []
  ).slice(0, 3);
  const focusMinutesLabel = formatMinutesLabel(
    focusDetail?.minutesUntilStart ?? focusRace.minutesUntilStart ?? null
  );
  const selectedParticipant =
    focusParticipants.find(
      (participant) => String(getParticipantNum(participant)) === String(focusPickNum)
    ) ?? focusParticipants[0] ?? null;
  const focusConfidence =
    focusRace.score?.pick?.confidence ??
    selectedParticipant?.prediction?.confiance ??
    null;

  return (
    <section className="grid gap-5 xl:grid-cols-[0.36fr,0.64fr] xl:items-start">
      <aside className="app-card p-5 md:p-6 xl:sticky xl:top-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="app-kicker">
              {focusRace.race.estQuinte ? "Quinte du jour" : "Course du jour"}
            </p>
            <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
              R{focusRace.race.reunion}C{focusRace.race.course}
            </p>
          </div>
          <span className="app-pill text-[11px]">{focusLisibilite.toLowerCase()}</span>
        </div>

        <h1 className="mt-5 text-[2rem] font-black leading-[0.94] text-[var(--pmu-text)]">
          {focusRace.race.nomCourse}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
          {focusDetail?.paywall?.required
            ? "Le signal public reste visible, le ticket detaille se debloque avec l offre premium."
            : focusRace.hint}
        </p>

        <div className="mt-5 grid gap-3">
          <div className="rounded-[1.45rem] border border-[color-mix(in_srgb,var(--pmu-primary)_20%,transparent)] bg-[linear-gradient(180deg,var(--pmu-primary-fade)_0%,color-mix(in_srgb,var(--pmu-surface)_94%,transparent)_100%)] px-4 py-4">
            <p className="app-label">Radar prioritaire</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-4xl font-black text-[var(--pmu-primary)]">
                {focusDisplayScore}/10
              </p>
              <p className="text-right text-xs uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
                {focusConfidence != null && Number.isFinite(focusConfidence)
                  ? `Confiance ${focusConfidence.toFixed(1)}/10`
                  : "Lecture active"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Fenetre</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                {focusMinutesLabel}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Ticket</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                {focusPickTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="app-pill text-xs">{focusRace.race.hippodrome}</span>
          <span className="app-pill text-xs">{focusRace.race.heureDepart}</span>
          <span className="app-pill text-xs">{formatCourseMeta(focusRace.race)}</span>
          <span className="app-pill text-xs">{focusBetType}</span>
          {focusPriorityBadge ? (
            <span
              className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
              style={{
                color: getPriorityToneColor(focusPriorityBadge.tone),
                borderColor: `color-mix(in srgb, ${getPriorityToneColor(
                  focusPriorityBadge.tone
                )} 24%, transparent)`,
                background: `color-mix(in srgb, ${getPriorityToneColor(
                  focusPriorityBadge.tone
                )} 10%, var(--pmu-surface))`,
              }}
            >
              {focusPriorityBadge.label} - {focusPriorityBadge.detail}
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
            <p className="app-kicker">Desk du jour</p>
            <h2 className="mt-2 text-[2.2rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[3rem]">
              Le ticket et les partants utiles dans le meme cadre
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="app-pill text-xs">{formatRelativeDay(selectedDate)}</span>
            <span className="app-pill text-xs">
              {focusRace.score?.stage
                ? getStageLabel(focusRace.score.stage)
                : "Lecture programme"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
          <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="app-label">Ticket principal</p>
                <h3 className="mt-2 text-3xl font-black leading-[0.96] text-[var(--pmu-text)]">
                  {focusPickTitle}
                </h3>
              </div>
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
                {focusBetType}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {focusDetail?.paywall?.required
                ? "Le detail complet reste reserve, mais le signal central et les partants a suivre restent visibles."
                : focusRace.hint}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Score</p>
                <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  {focusDisplayScore}/10
                </p>
              </div>
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Fenetre</p>
                <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                  {focusMinutesLabel}
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
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {focusFactors.length > 0
                ? focusFactors.map((factor) => (
                    <span key={factor} className="app-pill text-xs">
                      {factor}
                    </span>
                  ))
                : [
                    focusRace.race.estQuinte ? "Course Quinte" : "Course cible",
                    `${focusRace.race.nombrePartants} partants`,
                    sortModeLabel,
                  ].map((factor) => (
                    <span key={factor} className="app-pill text-xs">
                      {factor}
                    </span>
                  ))}
            </div>
          </section>

          <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-label">Partants visibles</p>
                <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  Les chevaux utiles a garder a l&apos;ecran
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
                  const participantBet = participant.prediction?.typePariConseille;

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
                        {participant.prediction?.topFacteurs?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {translateFactors(participant.prediction.topFacteurs)
                              .slice(0, 2)
                              .map((factor) => (
                                <span key={factor} className="app-pill text-[11px]">
                                  {factor}
                                </span>
                              ))}
                          </div>
                        ) : null}
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
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
                          {participantBet
                            ? formatBetTypeLabelFr(participantBet)
                            : "A suivre"}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Le detail course arrive ici avec les partants et la lecture prediction
                  des que l&apos;API PMU remonte le bloc complet.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="app-card-muted px-4 py-4">
            <p className="app-label">Date</p>
            <p className="mt-2 text-sm font-black capitalize text-[var(--pmu-text)]">
              {formatRelativeDay(selectedDate)}
            </p>
          </div>
          <div className="app-card-muted px-4 py-4">
            <p className="app-label">Reunions</p>
            <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
              {summaryStats.meetings} actives
            </p>
          </div>
          <div className="app-card-muted px-4 py-4">
            <p className="app-label">Jouables</p>
            <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
              {summaryStats.playable} spots
            </p>
          </div>
          <div className="app-card-muted px-4 py-4">
            <p className="app-label">Tri</p>
            <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
              {sortModeLabel}
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
