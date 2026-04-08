"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { CoursePronostic } from "@/components/ui/CoursePronostic";
import {
  ParticipantsTable,
  type ArrivalRow,
  type CourseParticipantRow,
} from "@/components/ui/ParticipantsTable";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type RaceApiParticipant = {
  numPmu?: number | string | null;
  numero?: number | string | null;
  nom?: string | null;
  driver?: string | null;
  jockey?: string | null;
  entraineur?: string | null;
  age?: number | null;
  sexe?: string | null;
  placeCorde?: number | string | null;
  corde?: number | string | null;
  poids?: number | null;
  musique?: string | null;
  cote?: number | null;
  statut?: string | null;
  nonPartant?: boolean | null;
  prediction?: {
    confiance?: number | null;
    scoreCheval?: number | null;
    topFacteurs?: string[] | null;
    typePariConseille?: string | null;
    miseConseillee?: number | null;
  } | null;
};

type RaceApiResponse = {
  success?: boolean;
  courseInfo?: {
    reunion?: number;
    course?: number;
    hippodrome?: string | null;
    pays?: string | null;
    nomCourse?: string | null;
    discipline?: string | null;
    distance?: number | string | null;
    heureDepart?: string | null;
    nombrePartants?: number | null;
    allocation?: number | null;
    terrain?: string | null;
    meteo?: string | null;
    dateStr?: string | null;
  } | null;
  participants?: RaceApiParticipant[] | number | null;
  officialArrival?: ArrivalRow[] | null;
  minutesUntilStart?: number | null;
  pronoAvailable?: boolean;
  isFinished?: boolean;
  analysis?: {
    ranking?: RaceApiParticipant[] | null;
    top5?: RaceApiParticipant[] | null;
    favori?: RaceApiParticipant | null;
    pepiteDuJour?: RaceApiParticipant | null;
    scoreConfiance?: {
      score?: number | null;
      facteurs?: string[] | null;
    } | null;
    recommandation?: {
      decision?: string | null;
    } | null;
  } | null;
  paywall?: {
    required?: boolean;
    preview?: {
      lisibilite?: string | null;
      recommendation?: string | null;
      favori?: {
        numPmu?: number | string | null;
        nom?: string | null;
      } | null;
    } | null;
  } | null;
};

type PronosticCardData = {
  favoris?: Array<number | string>;
  top5?: Array<number | string>;
  scoreConfiance?: number | null;
  valueBet?: number | string | null;
  miseConseil?: number | null;
  recommandation?: string | null;
  betType?: string | null;
  pourquoi?: string[];
};

function formatEuros(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(dateStr?: string | null) {
  if (!dateStr || !/^\d{8}$/.test(dateStr)) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}T12:00:00Z`));
}

function mergeParticipantData(payload: RaceApiResponse | null) {
  const rawParticipants = Array.isArray(payload?.participants) ? payload.participants : [];
  const rankingParticipants = Array.isArray(payload?.analysis?.ranking) ? payload.analysis.ranking : [];

  if (rawParticipants.length === 0) {
    return rankingParticipants;
  }

  const rankingByNumber = new Map(
    rankingParticipants.map((participant) => [
      String(participant.numero ?? participant.numPmu ?? ""),
      participant,
    ]),
  );

  return rawParticipants.map((participant) => {
    const key = String(participant.numero ?? participant.numPmu ?? "");
    const ranked = rankingByNumber.get(key);

    return {
      ...participant,
      prediction: {
        ...ranked?.prediction,
        ...participant.prediction,
        topFacteurs: participant.prediction?.topFacteurs ?? ranked?.prediction?.topFacteurs ?? [],
        scoreCheval: participant.prediction?.scoreCheval ?? ranked?.prediction?.scoreCheval ?? null,
      },
      cote: participant.cote ?? ranked?.cote ?? null,
      musique: participant.musique ?? ranked?.musique ?? null,
      nonPartant: participant.nonPartant ?? ranked?.nonPartant ?? null,
    };
  });
}

function toParticipantRow(participant: RaceApiParticipant): CourseParticipantRow {
  return {
    numero: participant.numero ?? participant.numPmu ?? null,
    nom: participant.nom ?? null,
    driver: participant.driver ?? null,
    jockey: participant.jockey ?? null,
    entraineur: participant.entraineur ?? null,
    age: participant.age ?? null,
    sexe: participant.sexe ?? null,
    corde: participant.corde ?? participant.placeCorde ?? null,
    poids: participant.poids ?? null,
    musique: participant.musique ?? null,
    cote: participant.cote ?? null,
    scoreIa: participant.prediction?.scoreCheval ?? null,
    nonPartant: participant.nonPartant ?? participant.statut === "NON_PARTANT",
    topFacteurs: Array.isArray(participant.prediction?.topFacteurs)
      ? participant.prediction?.topFacteurs ?? []
      : [],
  };
}

function normalizeParticipants(payload: RaceApiResponse | null): CourseParticipantRow[] {
  return mergeParticipantData(payload).map(toParticipantRow);
}

function normalizeOfficialArrival(payload: RaceApiResponse | null): ArrivalRow[] {
  return Array.isArray(payload?.officialArrival) ? payload.officialArrival : [];
}

function normalizePronostic(payload: RaceApiResponse | null): PronosticCardData | null {
  const analysis = payload?.analysis;
  if (!analysis || typeof analysis !== "object") {
    return null;
  }

  const ranking = Array.isArray(analysis.ranking) ? analysis.ranking : [];
  const top5 = Array.isArray(analysis.top5) ? analysis.top5 : [];
  const favori = analysis.favori && typeof analysis.favori === "object" ? analysis.favori : null;
  const selected = favori ?? ranking[0] ?? null;
  const facteurs = Array.isArray(selected?.prediction?.topFacteurs)
    ? selected?.prediction?.topFacteurs ?? []
    : Array.isArray(analysis.scoreConfiance?.facteurs)
      ? analysis.scoreConfiance?.facteurs ?? []
      : [];

  if (!selected && top5.length === 0 && ranking.length === 0) {
    return null;
  }

  return {
    favoris:
      selected?.numPmu !== undefined && selected?.numPmu !== null ? [selected.numPmu] : [],
    top5: (top5.length ? top5 : ranking.slice(0, 5))
      .map((runner) => runner?.numPmu)
      .filter((value): value is number | string => value !== null && value !== undefined),
    scoreConfiance: analysis.scoreConfiance?.score ?? selected?.prediction?.confiance ?? null,
    valueBet: analysis.pepiteDuJour?.numPmu ?? null,
    miseConseil: selected?.prediction?.miseConseillee ?? null,
    recommandation: analysis.recommandation?.decision ?? null,
    betType: selected?.prediction?.typePariConseille ?? null,
    pourquoi: facteurs.filter((factor): factor is string => typeof factor === "string"),
  };
}

function LockedCard({ previewLabel }: { previewLabel?: string | null }) {
  return (
    <section className="app-card flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-3 text-[var(--pmu-primary)]">
        <span aria-hidden>🔒</span>
        <span className="app-kicker">Pronostic réservé</span>
      </div>
      <h2 className="text-xl font-black text-[var(--pmu-text)]">Pronostic Premium</h2>
      <p className="text-sm text-[var(--pmu-text-soft)]">
        Le tableau des partants reste public, mais le ticket détaillé et la lecture complète sont réservés à l&apos;accès Premium.
      </p>
      {previewLabel ? (
        <p className="text-sm text-[var(--pmu-text)]">
          Cheval repéré : <strong>{previewLabel}</strong>
        </p>
      ) : null}
      <Link
        href="/premium"
        className="app-button-primary inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold sm:w-auto"
      >
        Débloquer le pronostic Premium
      </Link>
    </section>
  );
}

function AnalysisPendingCard() {
  return (
    <section className="app-card flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-3 text-[var(--pmu-primary)]">
        <span aria-hidden>⏳</span>
        <span className="app-kicker">Lecture moteur</span>
      </div>
      <h2 className="text-xl font-black text-[var(--pmu-text)]">Analyse en cours</h2>
      <p className="text-sm text-[var(--pmu-text-soft)]">
        Le moteur termine encore la lecture de cette course. Recharge la page dans quelques instants.
      </p>
    </section>
  );
}

function OfficialArrivalCard({ arrivee }: { arrivee: ArrivalRow[] }) {
  if (arrivee.length === 0) {
    return null;
  }

  return (
    <section className="app-card flex flex-col gap-4 rounded-2xl p-5">
      <div>
        <p className="app-kicker">Résultat officiel</p>
        <h3 className="mt-2 app-section-title">Arrivée officielle</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {arrivee.map((row, index) => (
          <div
            key={`${row.numPmu}-${index}`}
            className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-raised)] px-4 py-3 text-center"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--pmu-text-soft)]">
              {index + 1}e
            </span>
            <p className="mt-1 text-2xl font-black text-[var(--pmu-text)]">{row.numPmu}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopFiveCard({
  top5,
  participants,
}: {
  top5: Array<number | string>;
  participants: CourseParticipantRow[];
}) {
  if (top5.length === 0) {
    return null;
  }

  return (
    <section className="app-card rounded-2xl p-5">
      <div>
        <p className="app-kicker">Lecture moteur</p>
        <h3 className="mt-2 app-section-title">Top 5 de l&apos;algo</h3>
      </div>

      <div className="mt-4 space-y-3">
        {top5.map((numero, index) => {
          const participant = participants.find((item) => String(item.numero) === String(numero));

          return (
            <div
              key={`${numero}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-raised)] px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[var(--pmu-text)]">
                  {index + 1}. N°{numero} {participant?.nom || `Cheval ${numero}`}
                </p>
                <p className="mt-1 text-xs text-[var(--pmu-text-soft)]">
                  Score {Math.round(participant?.scoreIa ?? 0) || "--"}
                  {typeof participant?.cote === "number" ? ` · Cote ${participant.cote.toFixed(1)}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CourseHeader({
  courseInfo,
  reunion,
  course,
  selectedDate,
}: {
  courseInfo: NonNullable<RaceApiResponse["courseInfo"]>;
  reunion: string;
  course: string;
  selectedDate: string | null;
}) {
  const titlePrefix = `R${courseInfo.reunion ?? reunion}C${courseInfo.course ?? course}`;
  const dateLabel = formatDateLabel(selectedDate ?? courseInfo.dateStr ?? null);
  const pills = [
    courseInfo.discipline,
    courseInfo.distance ? `${courseInfo.distance} m` : null,
    courseInfo.nombrePartants ? `${courseInfo.nombrePartants} partants` : null,
    courseInfo.allocation ? formatEuros(courseInfo.allocation) : null,
    courseInfo.terrain || null,
    courseInfo.meteo || null,
    courseInfo.heureDepart ? `Départ ${courseInfo.heureDepart}` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="app-card flex flex-col gap-4 rounded-2xl p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-kicker">
            {titlePrefix} — {(courseInfo.hippodrome || "Programme").toUpperCase()}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[var(--pmu-text)] md:text-4xl">
            {courseInfo.nomCourse || `Course ${course}`}
          </h1>
          <p className="mt-2 text-sm text-[var(--pmu-text-soft)]">
            {dateLabel || "Fiche course complète"}{courseInfo.pays ? ` · ${courseInfo.pays}` : ""}
          </p>
        </div>

        {courseInfo.heureDepart ? (
          <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-3 text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">Départ</p>
            <p className="mt-1 text-2xl font-black text-[var(--pmu-text)]">{courseInfo.heureDepart}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => (
          <span
            key={pill}
            className="rounded-full border border-[var(--pmu-border)] px-3 py-1 text-xs font-semibold text-[var(--pmu-text-soft)]"
          >
            {pill}
          </span>
        ))}
      </div>
    </section>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ reunion: string; course: string }>();
  const searchParams = useSearchParams();

  const [data, setData] = useState<RaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reunion = params?.reunion ?? "";
  const course = params?.course ?? "";
  const selectedDate = searchParams.get("date");

  useEffect(() => {
    let cancelled = false;

    async function loadRace() {
      try {
        setLoading(true);
        setError(null);

        const url = new URL(`/api/race/${reunion}/${course}`, window.location.origin);
        if (selectedDate) {
          url.searchParams.set("date", selectedDate);
        }

        let authorization = "";
        if (hasSupabaseConfig()) {
          try {
            const supabase = getSupabaseBrowserClient();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            authorization = session?.access_token ? `Bearer ${session.access_token}` : "";
          } catch {
            authorization = "";
          }
        }

        const response = await fetch(url.toString(), {
          headers: authorization ? { Authorization: authorization } : undefined,
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Impossible de charger cette course");
        }

        const payload = (await response.json()) as RaceApiResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger cette course");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (reunion && course) {
      void loadRace();
    }

    return () => {
      cancelled = true;
    };
  }, [course, reunion, selectedDate]);

  const courseInfo = data?.courseInfo ?? null;
  const participants = useMemo(() => normalizeParticipants(data), [data]);
  const officialArrival = useMemo(() => normalizeOfficialArrival(data), [data]);
  const pronostic = useMemo(() => normalizePronostic(data), [data]);
  const ranking = useMemo(
    () => (Array.isArray(data?.analysis?.ranking) ? data.analysis.ranking ?? [] : []),
    [data],
  );

  const top5 = Array.isArray(pronostic?.top5)
    ? pronostic.top5
    : ranking
        .slice(0, 5)
        .map((runner) => runner?.numPmu)
        .filter((value): value is number | string => value !== null && value !== undefined);

  return (
    <main className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-4 py-4 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={selectedDate ? `/?date=${selectedDate}` : "/"}
          className="app-button-secondary inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold"
        >
          ← Retour aux courses
        </Link>
      </div>

      {loading ? (
        <section className="app-card flex flex-col gap-4 rounded-2xl p-5">
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--pmu-skeleton)]" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-[var(--pmu-skeleton)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--pmu-skeleton)]" />
          <div className="h-[520px] animate-pulse rounded-2xl bg-[var(--pmu-skeleton)]" />
          <div className="h-[220px] animate-pulse rounded-2xl bg-[var(--pmu-skeleton)]" />
        </section>
      ) : error ? (
        <section className="app-card flex flex-col gap-3 rounded-2xl p-5">
          <p className="app-kicker">Fiche course</p>
          <h1 className="text-2xl font-black text-[var(--pmu-text)]">Impossible de charger cette course</h1>
          <p className="text-sm text-[var(--pmu-text-soft)]">{error}</p>
        </section>
      ) : data && courseInfo ? (
        <>
          <CourseHeader courseInfo={courseInfo} reunion={reunion} course={course} selectedDate={selectedDate} />

          <ParticipantsTable
            participants={participants}
            favoriNum={pronostic?.favoris?.[0] ?? null}
            pepiteNum={data.analysis?.pepiteDuJour?.numPmu ?? null}
            estPlat={courseInfo.discipline?.toUpperCase() === "PLAT"}
            courseFinished={Boolean(data.isFinished || officialArrival.length)}
            officialArrival={officialArrival}
          />

          {data.paywall?.required ? (
            <LockedCard previewLabel={data.paywall.preview?.favori?.nom ?? null} />
          ) : pronostic ? (
            <CoursePronostic pronostic={pronostic} participants={participants} />
          ) : (
            <AnalysisPendingCard />
          )}

          {top5.length > 0 || officialArrival.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
              <TopFiveCard top5={top5} participants={participants} />
              <OfficialArrivalCard arrivee={officialArrival} />
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
