import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { CourseCard } from "@/features/home/components/CourseCard";
import { FilterPills } from "@/features/home/components/FilterPills";
import { HowItWorks } from "@/features/home/components/HowItWorks";
import { PerformanceProof } from "@/features/home/components/PerformanceProof";
import { PromoVideoSection } from "@/features/home/components/PromoVideoSection";
import { RecentResults } from "@/features/home/components/RecentResults";
import { TopParisStrip } from "@/features/home/components/TopParisStrip";
import {
  formatCourseMeta,
  type BoardFilter,
  type FeaturedRace,
  type HomeBoardSection,
  type HomeSecondaryPanel,
  type HomeTopParisItem,
  type PriorityCard,
} from "@/features/home/lib/home-page-model";
import { getRaceProfile } from "@/lib/client-race-scoring";
import { estimateEloProfileForProgrammeCard } from "@/lib/elo-scoring";
import { estimateIndiceOuvertureListe } from "@/lib/ouverture";
import { getPriorityToneColor } from "@/lib/race-priority";

function HomeBoardCard({
  item,
  onOpenRace,
}: {
  item: FeaturedRace;
  onOpenRace: (item: FeaturedRace) => void;
}) {
  const profile = getRaceProfile({
    race: item.race,
    displayScore: item.scoreValue,
    pick: item.score?.pick
      ? {
          numPmu: item.score.pick.numPmu,
          cote: null,
          confidence: item.score.pick.confidence,
        }
      : null,
  });
  const eloProfile = estimateEloProfileForProgrammeCard(item.score?.pick?.confidence);
  const indiceListe = estimateIndiceOuvertureListe({
    displayScore: item.scoreValue,
    partants: item.race.nombrePartants,
    sigmaPct: eloProfile.sigma,
  });

  return (
    <CourseCard
      raceTitle={`R${item.race.reunion}C${item.race.course} - ${item.race.nomCourse}`}
      subtitleLine={[item.race.hippodrome, formatCourseMeta(item.race)].join(" - ")}
      timeLabel={item.race.heureDepart}
      minutesUntilStart={item.minutesUntilStart}
      displayScore={item.scoreValue}
      profile={profile}
      eloProfile={eloProfile}
      indiceOuverture={indiceListe}
      pickNum={item.score?.pick?.numPmu}
      pickNom={item.score?.pick?.nom}
      pickConfidence={item.score?.pick?.confidence}
      pickCote={item.score?.pick?.cote}
      pickBetType={item.score?.pick?.betType}
      pickStake={item.score?.pick?.stake}
      detailsLocked={item.score?.scoreLocked === true}
      decision={item.score?.decision}
      topFacteurs={item.score?.pick?.topFacteurs}
      priorityBadge={item.priorityBadge}
      comboCandidate={item.score?.comboCandidate ?? null}
      reunion={item.race.reunion}
      course={item.race.course}
      dateStr={item.race.dateStr}
      courseLabel={`R${item.race.reunion}C${item.race.course} ${item.race.hippodrome}`}
      onClick={() => onOpenRace(item)}
    />
  );
}

export function HomeBoard({
  isLoading,
  error,
  featuredRaces,
  activePriorityRaces,
  boardFilter,
  boardFilterOptions,
  boardSections,
  boardCounts,
  topParisItems,
  priorityCards,
  secondaryPanels,
  secondaryPanel,
  onBoardFilterChange,
  onSecondaryPanelChange,
  onOpenRace,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  featuredRaces: FeaturedRace[];
  activePriorityRaces: FeaturedRace[];
  boardFilter: BoardFilter;
  boardFilterOptions: Array<{ value: BoardFilter; label: string }>;
  boardSections: HomeBoardSection[];
  boardCounts: Record<BoardFilter | "resultat", number>;
  topParisItems: HomeTopParisItem[];
  priorityCards: PriorityCard[];
  secondaryPanels: Array<{ key: HomeSecondaryPanel; label: string }>;
  secondaryPanel: HomeSecondaryPanel | null;
  onBoardFilterChange: (filter: BoardFilter) => void;
  onSecondaryPanelChange: (panel: HomeSecondaryPanel | null) => void;
  onOpenRace: (race: FeaturedRace) => void;
  onRetry: () => void;
}) {
  return (
    <>
      {error ? (
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
          <button type="button" className="app-button-primary mt-4" onClick={onRetry}>
            Reessayer
          </button>
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length > 0 && topParisItems.length === 0 ? (
        <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Aucune course ne depasse encore le seuil jouable pour le Top 3. Le board
          garde tout de meme les meilleurs spots visibles dans la grille ci-dessous.
        </section>
      ) : null}

      <section className="app-section-heading rounded-[1.8rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_78%,transparent)] px-5 py-5 md:px-6">
        <div>
          <p className="app-kicker">Board courses</p>
          <h2 className="app-section-title">
            Le programme trie par niveau d&apos;action
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
          Vertes pour agir, jaunes pour garder sous radar, rouges pour filtrer.
          Le board ne melange plus les bons spots avec le bruit.
        </p>
      </section>

      {isLoading ? (
        <section
          className="grid auto-rows-fr gap-5 2xl:grid-cols-2"
          aria-busy="true"
          aria-label="Chargement des courses"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="app-card h-80 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
            />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length > 0 ? (
        <section className="space-y-6">
          {activePriorityRaces.length > 0 ? (
            <section className="app-card p-4 md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="app-kicker">File active</p>
                  <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                    Les courses que le moteur repasse le plus souvent
                  </h3>
                </div>
                <span className="app-pill text-xs">
                  {activePriorityRaces.length} course
                  {activePriorityRaces.length > 1 ? "s" : ""} chaude
                  {activePriorityRaces.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-4">
                {activePriorityRaces.map((item) => {
                  const badge = item.priorityBadge;
                  if (!badge) {
                    return null;
                  }

                  const toneColor = getPriorityToneColor(badge.tone);

                  return (
                    <button
                      key={`priority-${item.race.reunion}-${item.race.course}`}
                      type="button"
                      onClick={() => onOpenRace(item)}
                      className="rounded-[1.25rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-4 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span
                          className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{
                            color: toneColor,
                            borderColor: `color-mix(in srgb, ${toneColor} 24%, transparent)`,
                            background: `color-mix(in srgb, ${toneColor} 10%, var(--pmu-surface))`,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
                          R{item.race.reunion}C{item.race.course}
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-black leading-tight text-[var(--pmu-text)]">
                        {item.race.nomCourse}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                        {item.race.hippodrome} · {item.race.heureDepart} · {badge.detail}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="app-pill text-[11px]">
                          {item.scoreValue.toFixed(1)}/10
                        </span>
                        <span className="app-pill text-[11px]">
                          {item.status === "jouable"
                            ? "verte"
                            : item.status === "surveillance"
                              ? "jaune"
                              : "rouge"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="app-card p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="app-kicker">Tri V6</p>
                <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  Regrouper le board par couleur aide a ouvrir plus vite
                </h3>
              </div>
              <div className="w-full max-w-2xl">
                <FilterPills
                  options={boardFilterOptions}
                  value={boardFilter}
                  onChange={onBoardFilterChange}
                />
              </div>
            </div>
          </div>

          {boardSections.map((section) => (
            <section key={section.key} className="space-y-4">
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_80%,transparent)] px-5 py-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                      style={{
                        color: section.color,
                        borderColor: `color-mix(in srgb, ${section.color} 24%, transparent)`,
                        background: `color-mix(in srgb, ${section.color} 10%, var(--pmu-surface))`,
                      }}
                    >
                      {section.label}
                    </span>
                    <span className="text-sm font-semibold text-[var(--pmu-text-muted)]">
                      {section.items.length} course{section.items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black text-[var(--pmu-text)]">
                    {section.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)]">
                    {section.description}
                  </p>
                </div>
              </div>

              {section.items.length > 0 ? (
                <div className="grid auto-rows-fr items-stretch gap-5 2xl:grid-cols-2">
                  {section.items.map((item) => (
                    <HomeBoardCard
                      key={`${item.race.reunion}-${item.race.course}`}
                      item={item}
                      onOpenRace={onOpenRace}
                    />
                  ))}
                </div>
              ) : (
                <div className="app-card p-5">
                  <p className="text-base font-black text-[var(--pmu-text)]">
                    {section.key === "prioritaire"
                      ? `0 course chaude. Il reste ${boardCounts.jouable} verte${boardCounts.jouable > 1 ? "s" : ""}, ${boardCounts.surveillance} jaune${boardCounts.surveillance > 1 ? "s" : ""} et ${boardCounts.passer} rouge${boardCounts.passer > 1 ? "s" : ""}.`
                      : section.key === "jouable"
                        ? `0 course verte. Il reste ${boardCounts.surveillance} jaune${boardCounts.surveillance > 1 ? "s" : ""} et ${boardCounts.passer} rouge${boardCounts.passer > 1 ? "s" : ""}.`
                        : section.key === "surveillance"
                          ? `0 course jaune. Il reste ${boardCounts.jouable} verte${boardCounts.jouable > 1 ? "s" : ""} et ${boardCounts.passer} rouge${boardCounts.passer > 1 ? "s" : ""}.`
                          : section.key === "passer"
                            ? `0 course rouge. Il reste ${boardCounts.jouable} verte${boardCounts.jouable > 1 ? "s" : ""} et ${boardCounts.surveillance} jaune${boardCounts.surveillance > 1 ? "s" : ""}.`
                            : "Aucune course dans cette vue."}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                    {section.key === "prioritaire"
                      ? "Le filtre Suivi renforce ne montre que les courses sous cadence active du moteur."
                      : section.key === "jouable"
                        ? "Le filtre Vertes isole uniquement les validations fortes. Les autres courses existent toujours dans les vues jaune et rouge."
                        : section.key === "surveillance"
                          ? "Le filtre Jaunes ne montre que les courses a garder sous radar, pas tout le programme."
                          : section.key === "passer"
                            ? "Le filtre Rouges ne montre que les courses a filtrer, pas l'ensemble du board."
                            : "Change de filtre pour revenir au programme complet."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onBoardFilterChange("all")}
                      className="app-button-secondary text-xs"
                    >
                      Voir tout
                    </button>
                    {section.key !== "prioritaire" && boardCounts.prioritaire > 0 ? (
                      <button
                        type="button"
                        onClick={() => onBoardFilterChange("prioritaire")}
                        className="app-button-secondary text-xs"
                      >
                        Voir la file active
                      </button>
                    ) : null}
                    {section.key !== "jouable" && boardCounts.jouable > 0 ? (
                      <button
                        type="button"
                        onClick={() => onBoardFilterChange("jouable")}
                        className="app-button-secondary text-xs"
                      >
                        Voir les vertes
                      </button>
                    ) : null}
                    {section.key !== "surveillance" &&
                    boardCounts.surveillance > 0 ? (
                      <button
                        type="button"
                        onClick={() => onBoardFilterChange("surveillance")}
                        className="app-button-secondary text-xs"
                      >
                        Voir les jaunes
                      </button>
                    ) : null}
                    {section.key !== "passer" && boardCounts.passer > 0 ? (
                      <button
                        type="button"
                        onClick={() => onBoardFilterChange("passer")}
                        className="app-button-secondary text-xs"
                      >
                        Voir les rouges
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          ))}
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length === 0 ? (
        <section className="app-card p-8 text-center">
          <p className="text-xl font-bold text-[var(--pmu-text)]">
            Aucune course exploitable pour cette date
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
            Change de journee ou recharge la page. Le moteur n&apos;a pas encore
            remonte de programme utilisable.
          </p>
        </section>
      ) : null}

      {topParisItems.length > 0 ? <TopParisStrip items={topParisItems} /> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {priorityCards.map((card) => {
          const toneColor =
            card.tone === "primary"
              ? "var(--pmu-primary)"
              : card.tone === "warning"
                ? "var(--pmu-orange)"
                : "var(--pmu-text)";

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => (card.race ? onOpenRace(card.race) : undefined)}
              disabled={!card.race}
              className="app-card flex h-full flex-col items-start gap-4 p-5 text-left disabled:cursor-default disabled:opacity-100"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">{card.title}</p>
                  <h3 className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                    {card.value}
                  </h3>
                </div>
                <span
                  className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: toneColor,
                    borderColor: `color-mix(in srgb, ${toneColor} 24%, transparent)`,
                    background: `color-mix(in srgb, ${toneColor} 10%, var(--pmu-surface))`,
                  }}
                >
                  {card.subtitle}
                </span>
              </div>

              <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">
                {card.description}
              </p>

              {card.race ? (
                <div className="mt-auto flex flex-wrap gap-2">
                  <span className="app-pill text-xs">{card.race.race.hippodrome}</span>
                  <span className="app-pill text-xs">{card.race.race.heureDepart}</span>
                  <span className="app-pill text-xs">
                    {card.race.scoreValue.toFixed(1)}/10
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Preuves et methode</p>
            <h2 className="app-section-title">
              Le panneau secondaire garde le reste proprement range
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            La decision vit plus haut. Ici, on ouvre seulement les preuves, la demo et
            la methode quand on en a besoin.
          </p>
        </div>

        <div className="space-y-3">
          {secondaryPanels.map((panel) => {
            const open = secondaryPanel === panel.key;
            const summary =
              panel.key === "performance"
                ? "ROI et hit rate"
                : panel.key === "results"
                  ? "Suivi recent"
                  : panel.key === "demo"
                    ? "Video produit"
                    : "Processus";

            return (
              <AccordionPanel
                key={panel.key}
                kicker="Bloc deroulant"
                title={panel.label}
                summary={summary}
                open={open}
                onToggle={(next) => onSecondaryPanelChange(next ? panel.key : null)}
                bodyClassName="pt-4"
              >
                {panel.key === "performance" ? <PerformanceProof /> : null}
                {panel.key === "results" ? <RecentResults /> : null}
                {panel.key === "demo" ? <PromoVideoSection /> : null}
                {panel.key === "method" ? (
                  <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
                    <HowItWorks />
                    <PerformanceProof />
                  </div>
                ) : null}
              </AccordionPanel>
            );
          })}
        </div>
      </section>
    </>
  );
}
