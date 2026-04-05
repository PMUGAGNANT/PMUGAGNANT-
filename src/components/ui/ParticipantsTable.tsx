"use client";

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
  age?: number | null;
  sexe?: string | null;
  corde?: number | string | null;
  poids?: number | null;
  musique?: string | null;
  cote?: number | null;
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
  if (odds <= 10) return "rgb(245 158 11)";
  return "var(--pmu-text-soft)";
}

function getArrivalPosition(arrivalMap: Map<number, number | null>, numPmu: number) {
  const value = arrivalMap.get(numPmu);
  if (!value) return "--";
  return value === 1 ? "1er" : `${value}e`;
}

function formatOdds(odds?: number | null) {
  if (odds === null || odds === undefined || !Number.isFinite(odds)) return "--";
  return odds.toFixed(1);
}

function formatSexAge(participant: CourseParticipantRow) {
  const sexe = participant.sexe || "--";
  const age = Number.isFinite(participant.age) ? participant.age : "--";
  return `${sexe}/${age}`;
}

function RunnerTags({ isFavori, isPepite }: { isFavori: boolean; isPepite: boolean }) {
  if (!isFavori && !isPepite) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {isFavori ? (
        <span className="rounded-full bg-[var(--pmu-primary-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-primary)]">
          Favori IA
        </span>
      ) : null}
      {isPepite ? (
        <span className="rounded-full bg-[rgba(251,191,36,0.14)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[rgb(251,191,36)]">
          Pepite
        </span>
      ) : null}
    </div>
  );
}

export function ParticipantsTable({
  participants,
  favoriNum = null,
  pepiteNum = null,
  estPlat = true,
  courseFinished = false,
  officialArrival = [],
}: ParticipantsTableProps) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const safeArrival = Array.isArray(officialArrival) ? officialArrival : [];

  const sortedParticipants = [...safeParticipants].sort(
    (left, right) => Number(left.numero ?? 999) - Number(right.numero ?? 999),
  );
  const arrivalMap = new Map(safeArrival.map((row) => [row.numPmu, row.position]));

  if (safeParticipants.length === 0) {
    return (
      <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--pmu-border)] px-4 py-4 md:px-5">
          <p className="app-kicker">Tableau des partants</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="app-section-title">Tous les chevaux de la course</h2>
          </div>
        </div>
        <div className="p-4 text-sm text-[var(--pmu-text-soft)] md:p-5">
          Les partants sont en cours de chargement.
        </div>
      </section>
    );
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="border-b border-[var(--pmu-border)] px-4 py-4 md:px-5">
        <p className="app-kicker">Tableau des partants</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="app-section-title">Tous les chevaux de la course</h2>
          <span className="rounded-full border border-[var(--pmu-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--pmu-text-soft)]">
            Tries par numero PMU
          </span>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="app-table min-w-[980px]">
          <thead>
            <tr>
              <th>No</th>
              <th>Cheval</th>
              <th>{estPlat ? "Jockey" : "Driver"}</th>
              <th>Entraineur</th>
              <th>Sexe/age</th>
              <th>Cote</th>
              <th>Musique</th>
              <th>Poids</th>
              {courseFinished ? <th>Arrivee</th> : null}
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((participant, index) => {
              const numPmu = Number(participant.numero ?? 0);
              const isFavori = String(participant.numero) === String(favoriNum);
              const isPepite = String(participant.numero) === String(pepiteNum);

              return (
                <tr
                  key={`${participant.numero}-${index}`}
                  className="transition hover:bg-[var(--pmu-surface-highlight)]"
                  style={{
                    backgroundColor: isFavori
                      ? "var(--pmu-primary-fade)"
                      : isPepite
                        ? "rgba(251, 191, 36, 0.08)"
                        : index % 2 === 0
                          ? "var(--pmu-surface)"
                          : "var(--pmu-surface-2)",
                  }}
                >
                  <td>
                    <span className="inline-flex min-w-10 items-center justify-center rounded-xl bg-[var(--pmu-surface-highlight)] px-2.5 py-2 text-sm font-black text-[var(--pmu-text)]">
                      {participant.numero ?? "--"}
                    </span>
                  </td>
                  <td>
                    <p className="font-bold text-[var(--pmu-text)]">{participant.nom || "--"}</p>
                    <RunnerTags isFavori={isFavori} isPepite={isPepite} />
                  </td>
                  <td className="text-[var(--pmu-text)]">{getHumanLead(participant, estPlat)}</td>
                  <td className="text-[var(--pmu-text-soft)]">{participant.entraineur || "--"}</td>
                  <td className="font-medium text-[var(--pmu-text-soft)]">{formatSexAge(participant)}</td>
                  <td>
                    <span
                      className="font-mono text-sm font-bold tabular-nums"
                      style={{ color: getOddsTone(participant.cote) }}
                    >
                      {formatOdds(participant.cote)}
                    </span>
                  </td>
                  <td className="font-mono text-sm text-[var(--pmu-text-soft)]">
                    {participant.musique || "--"}
                  </td>
                  <td className="text-[var(--pmu-text-soft)]">
                    {participant.poids ? `${participant.poids} kg` : "--"}
                  </td>
                  {courseFinished ? (
                    <td className="font-semibold text-[var(--pmu-text)]">
                      {getArrivalPosition(arrivalMap, numPmu)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {sortedParticipants.map((participant, index) => {
          const numPmu = Number(participant.numero ?? 0);
          const isFavori = String(participant.numero) === String(favoriNum);
          const isPepite = String(participant.numero) === String(pepiteNum);

          return (
            <article
              key={`${participant.numero}-${index}`}
              className="rounded-2xl border p-3"
              style={{
                borderColor: "var(--pmu-border)",
                background: isFavori
                  ? "var(--pmu-primary-fade)"
                  : isPepite
                    ? "rgba(251, 191, 36, 0.08)"
                    : "var(--pmu-surface-2)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="inline-flex min-w-11 items-center justify-center rounded-xl bg-[var(--pmu-surface-highlight)] px-2.5 py-2 text-sm font-black text-[var(--pmu-text)]">
                  {participant.numero ?? "--"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-[var(--pmu-text)]">
                    {participant.nom || "--"}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--pmu-text-soft)]">
                    {getHumanLead(participant, estPlat)} • {participant.entraineur || "--"}
                  </p>
                  <RunnerTags isFavori={isFavori} isPepite={isPepite} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                    Sexe/age
                  </p>
                  <p className="mt-1 font-semibold text-[var(--pmu-text)]">
                    {formatSexAge(participant)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                    Cote
                  </p>
                  <p
                    className="mt-1 font-mono font-bold tabular-nums"
                    style={{ color: getOddsTone(participant.cote) }}
                  >
                    {formatOdds(participant.cote)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                    Musique
                  </p>
                  <p className="mt-1 font-mono text-[var(--pmu-text)]">
                    {participant.musique || "--"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                    Poids
                  </p>
                  <p className="mt-1 font-semibold text-[var(--pmu-text)]">
                    {participant.poids ? `${participant.poids} kg` : "--"}
                  </p>
                </div>
                {courseFinished ? (
                  <div className="col-span-2 rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                      Arrivee
                    </p>
                    <p className="mt-1 font-semibold text-[var(--pmu-text)]">
                      {getArrivalPosition(arrivalMap, numPmu)}
                    </p>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
