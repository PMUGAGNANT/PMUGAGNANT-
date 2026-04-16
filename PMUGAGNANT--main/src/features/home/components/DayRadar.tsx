import {
  formatOddsLabel,
  formatRaceCode,
  getBetTypeLabel,
  getParticipantNum,
  type FeaturedRace,
  type FocusParticipant,
} from "@/features/home/lib/home-page-model";
import type { HomeStats } from "@/features/home/components/home-page-types";

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V"];

export function DayRadar({
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
        label: `Reunion ${focusRace.race.reunion} - Course ${focusRace.race.course}`,
        hippodrome: focusRace.race.hippodrome,
        heureDepart: focusRace.race.heureDepart,
      }
    : null;

  return (
    <aside className="turf-home-aside" aria-label="Radar du jour">
      <section className="turf-aside-card turf-radar-card">
        <p className="app-kicker">Radar du jour</p>
        <div className="turf-radar-card__score">{radarScore || "--"}</div>
        <p className="app-label">Score journee - lisibilite</p>

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
            <span>Lisibilite</span>
            <i style={{ width: `${focusRace ? 82 : 36}%` }} />
          </div>
          <div>
            <span>Value</span>
            <i style={{ width: `${focusRace ? Math.max(34, radarScore - 10) : 28}%` }} />
          </div>
          <div>
            <span>Fiabilite</span>
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
              {focusRaceMeta.label} - {focusRaceMeta.hippodrome.toLocaleUpperCase("fr-FR")}
            </span>
          ) : null}
        </header>
        <div className="turf-ticket-card__body">
          {ticketRows.length > 0 ? (
            ticketRows.map((participant, index) => {
              const num = getParticipantNum(participant);

              return (
                <div key={`${num}-${participant.nom ?? "participant"}`} className="turf-ticket-row">
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
                      {participant.jockey ?? participant.driver ?? "monte a confirmer"}
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
            <p className="turf-ticket-card__empty">Ticket principal en preparation</p>
          )}
        </div>
      </section>

      <section className="turf-aside-card turf-aside-quote">
        <p>Jouer juste, jouer rare, jouer fort</p>
        <span>TurfEdge &middot; Algo v9.2</span>
        <small>
          {stats.playable} validee{stats.playable > 1 ? "s" : ""} sur {stats.total} courses
        </small>
      </section>
    </aside>
  );
}
