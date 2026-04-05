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
  scoreIa?: number | null;
  nonPartant?: boolean | null;
  topFacteurs?: string[] | null;
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
  return "var(--pmu-text)";
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

function getArrivalPosition(arrivalMap: Map<number, number | null>, numPmu: number) {
  const value = arrivalMap.get(numPmu);
  if (!value) return "--";
  return value === 1 ? "1er" : `${value}e`;
}

function getScoreTone(score?: number | null) {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return {
      label: "--",
      accent: "○",
      color: "var(--pmu-text-soft)",
    };
  }

  const rounded = Math.round(score);

  if (score >= 70) {
    return { label: `${rounded}/100`, accent: "●", color: "var(--pmu-primary)" };
  }

  if (score >= 60) {
    return { label: `${rounded}/100`, accent: "◆", color: "rgb(251 191 36)" };
  }

  if (score >= 50) {
    return { label: `${rounded}/100`, accent: "●", color: "rgb(245 158 11)" };
  }

  return { label: `${rounded}/100`, accent: "○", color: "var(--pmu-text-soft)" };
}

function RunnerTags({ isFavori, isPepite }: { isFavori: boolean; isPepite: boolean }) {
  if (!isFavori && !isPepite) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {isFavori ? (
        <span className="rounded-full bg-[rgba(0,255,136,0.08)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-primary)]">
          Favori IA
        </span>
      ) : null}
      {isPepite ? (
        <span className="rounded-full bg-[rgba(251,191,36,0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[rgb(251,191,36)]">
          Pépite
        </span>
      ) : null}
    </div>
  );
}

function getRowBackground(index: number, isFavori: boolean, isPepite: boolean) {
  if (isFavori) return "rgba(0, 255, 136, 0.03)";
  if (isPepite) return "rgba(251, 191, 36, 0.04)";
  return index % 2 === 0 ? "var(--pmu-surface)" : "var(--pmu-surface-2)";
}

function getNumberChipStyle(isFavori: boolean, isPepite: boolean) {
  if (isFavori) {
    return {
      background: "rgba(0,255,136,0.10)",
      color: "var(--pmu-primary)",
      border: "1px solid rgba(0,255,136,0.16)",
    };
  }

  if (isPepite) {
    return {
      background: "rgba(251,191,36,0.12)",
      color: "rgb(251 191 36)",
      border: "1px solid rgba(251,191,36,0.16)",
    };
  }

  return {
    background: "var(--pmu-surface-highlight)",
    color: "var(--pmu-text)",
    border: "1px solid transparent",
  };
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
          <h2 className="mt-2 app-section-title">Tous les chevaux de la course</h2>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Tableau des partants</p>
            <h2 className="mt-2 app-section-title">Tous les chevaux de la course</h2>
          </div>
          <span className="rounded-full border border-[var(--pmu-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--pmu-text-soft)]">
            Tri par numéro PMU
          </span>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="app-table min-w-[1080px] table-auto">
          <thead>
            <tr>
              <th className="w-[88px]">N°</th>
              <th className="min-w-[220px]">Cheval</th>
              <th className="min-w-[170px]">{estPlat ? "Jockey/Driver" : "Driver/Jockey"}</th>
              <th className="min-w-[180px]">Entraîneur</th>
              <th className="w-[100px]">Sexe/Âge</th>
              <th className="w-[88px]">Cote</th>
              <th className="min-w-[140px]">Musique</th>
              <th className="w-[112px]">Score IA</th>
              {courseFinished ? <th className="w-[90px]">Arrivée</th> : null}
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((participant, index) => {
              const numPmu = Number(participant.numero ?? 0);
              const isFavori = String(participant.numero) === String(favoriNum);
              const isPepite = String(participant.numero) === String(pepiteNum);
              const score = getScoreTone(participant.scoreIa);
              const numberStyle = getNumberChipStyle(isFavori, isPepite);
              const struck = participant.nonPartant ? "line-through opacity-60" : "";

              return (
                <tr
                  key={`${participant.numero}-${index}`}
                  className="transition hover:bg-[var(--pmu-surface-highlight)]"
                  style={{
                    backgroundColor: getRowBackground(index, isFavori, isPepite),
                  }}
                >
                  <td>
                    <span
                      className="inline-flex min-w-12 items-center justify-center rounded-xl px-3 py-2 text-sm font-black"
                      style={numberStyle}
                    >
                      {participant.numero ?? "--"}
                    </span>
                  </td>
                  <td>
                    <div className="min-w-0">
                      <p className={`font-bold text-[var(--pmu-text)] ${struck}`}>{participant.nom || "--"}</p>
                      <RunnerTags isFavori={isFavori} isPepite={isPepite} />
                    </div>
                  </td>
                  <td className="text-[var(--pmu-text)]">{getHumanLead(participant, estPlat)}</td>
                  <td className="text-[var(--pmu-text-soft)]">{participant.entraineur || "--"}</td>
                  <td className="font-mono text-sm text-[var(--pmu-text-soft)]">{formatSexAge(participant)}</td>
                  <td>
                    <span
                      className="font-mono text-sm font-bold tabular-nums"
                      style={{ color: getOddsTone(participant.cote) }}
                    >
                      {formatOdds(participant.cote)}
                    </span>
                  </td>
                  <td className="font-mono text-sm text-[var(--pmu-text-soft)]">{participant.musique || "--"}</td>
                  <td>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--pmu-border)] px-2 py-1 font-mono text-sm font-bold tabular-nums"
                      style={{ color: score.color }}
                    >
                      <span aria-hidden>{score.accent}</span>
                      <span>{score.label}</span>
                    </span>
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
          const score = getScoreTone(participant.scoreIa);
          const numberStyle = getNumberChipStyle(isFavori, isPepite);
          const struck = participant.nonPartant ? "line-through opacity-60" : "";

          return (
            <article
              key={`${participant.numero}-${index}`}
              className="rounded-2xl border p-3"
              style={{
                borderColor: "var(--pmu-border)",
                background: getRowBackground(index, isFavori, isPepite),
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="inline-flex min-w-11 items-center justify-center rounded-xl px-2.5 py-2 text-sm font-black"
                  style={numberStyle}
                >
                  {participant.numero ?? "--"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-base font-bold text-[var(--pmu-text)] ${struck}`}>
                    {participant.nom || "--"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[var(--pmu-text-soft)]">
                    {getHumanLead(participant, estPlat)}
                  </p>
                  <RunnerTags isFavori={isFavori} isPepite={isPepite} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Entraîneur</p>
                  <p className="mt-1 text-[var(--pmu-text)]">{participant.entraineur || "--"}</p>
                </div>
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Sexe/Âge</p>
                  <p className="mt-1 text-[var(--pmu-text)]">{formatSexAge(participant)}</p>
                </div>
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Cote</p>
                  <p
                    className="mt-1 font-mono font-bold tabular-nums"
                    style={{ color: getOddsTone(participant.cote) }}
                  >
                    {formatOdds(participant.cote)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Score IA</p>
                  <p className="mt-1 font-semibold" style={{ color: score.color }}>
                    {score.accent} {score.label}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Musique</p>
                  <p className="mt-1 font-mono text-[var(--pmu-text)]">{participant.musique || "--"}</p>
                </div>
                {courseFinished ? (
                  <div className="col-span-2 rounded-xl bg-[var(--pmu-bg)] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Arrivée</p>
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
