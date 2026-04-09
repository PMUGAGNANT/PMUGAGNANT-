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
  }).format(
    new Date(
      `${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}T12:00:00Z`
    )
  );
}

function formatMinutesLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Horaire PMU";
  }

  const roundedMinutes = Math.round(value);

  if (roundedMinutes <= -10) return "Course reglee";
  if (roundedMinutes <= 0) return "Depart imminent";
  if (roundedMinutes < 60) return `${roundedMinutes} min`;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes}`;
}

function formatDiscipline(value?: string | null) {
  const upper = (value ?? "").toUpperCase();
  if (!upper) return "Discipline";
  if (upper.includes("ATTELE")) return "Trot attele";
  if (upper.includes("MONTE")) return "Trot monte";
  if (upper.includes("PLAT")) return "Plat";
  if (upper.includes("HAIE") || upper.includes("STEEPLE")) return "Obstacle";
  return value ?? "Discipline";
}

function mergeParticipantData(payload: RaceApiResponse | null) {
  const rawParticipants = Array.isArray(payload?.participants)
    ? payload.participants
    : [];
  const rankingParticipants = Array.isArray(payload?.analysis?.ranking)
    ? payload.analysis.ranking
    : [];

  if (rawParticipants.length === 0) {
    return rankingParticipants;
  }

  const rankingByNumber = new Map(
    rankingParticipants.map((participant) => [
      String(participant.numero ?? participant.numPmu ?? ""),
      participant,
    ])
  );

  return rawParticipants.map((participant) => {
    const key = String(participant.numero ?? participant.numPmu ?? "");
    const ranked = rankingByNumber.get(key);

    return {
      ...participant,
      prediction: {
        ...ranked?.prediction,
        ...participant.prediction,
        topFacteurs:
          participant.prediction?.topFacteurs ??
          ranked?.prediction?.topFacteurs ??
          [],
        scoreCheval:
          participant.prediction?.scoreCheval ??
          ranked?.prediction?.scoreCheval ??
          null,
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
  const favori =
    analysis.favori && typeof analysis.favori === "object" ? analysis.favori : null;
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
      selected?.numPmu !== undefined && selected?.numPmu !== null
        ? [selected.numPmu]
        : [],
    top5: (top5.length ? top5 : ranking.slice(0, 5))
      .map((runner) => runner?.numPmu)
      .filter(
        (value): value is number | string =>
          value !== null && value !== undefined
      ),
    scoreConfiance:
      analysis.scoreConfiance?.score ?? selected?.prediction?.confiance ?? null,
    valueBet: analysis.pepiteDuJour?.numPmu ?? null,
    miseConseil: selected?.prediction?.miseConseillee ?? null,
    recommandation: analysis.recommandation?.decision ?? null,
    betType: selected?.prediction?.typePariConseille ?? null,
    pourquoi: facteurs.filter((factor): factor is string => typeof factor === "string"),
  };
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "warning" | "danger" | "neutral";
}) {
  const color =
    tone === "primary"
      ? "var(--pmu-primary)"
      : tone === "warning"
        ? "var(--pmu-orange)"
        : tone === "danger"
          ? "var(--pmu-red)"
          : "var(--pmu-text-soft)";

  return (
    <span
      className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 26%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, var(--pmu-surface))`,
      }}
    >
      {label}
    </span>
  );
}

function CourseHero({
  courseInfo,
  selectedDate,
  minutesUntilStart,
  paywallRequired,
  isFinished,
}: {
  courseInfo: NonNullable<RaceApiResponse["courseInfo"]>;
  selectedDate: string | null;
  minutesUntilStart?: number | null;
  paywallRequired: boolean;
  isFinished: boolean;
}) {
  const titlePrefix = `R${courseInfo.reunion ?? ""}C${courseInfo.course ?? ""}`;
  const dateLabel = formatDateLabel(selectedDate ?? courseInfo.dateStr ?? null);
  const statusTone = isFinished
    ? "neutral"
    : paywallRequired
      ? "warning"
      : "primary";
  const statusLabel = isFinished
    ? "Resultat officiel"
    : paywallRequired
      ? "Ticket premium"
      : "Signal disponible";

  const pills = [
    formatDiscipline(courseInfo.discipline),
    courseInfo.distance ? `${courseInfo.distance} m` : null,
    courseInfo.nombrePartants ? `${courseInfo.nombrePartants} partants` : null,
    courseInfo.terrain || null,
    courseInfo.meteo || null,
  ].filter(Boolean) as string[];

  return (
    <section className="app-page-hero p-6 md:p-8">
      <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={statusLabel} tone={statusTone} />
            {dateLabel ? <span className="app-pill text-xs">{dateLabel}</span> : null}
          </div>

          <div>
            <p className="app-kicker">
              {titlePrefix} - {(courseInfo.hippodrome || "Programme").toUpperCase()}
            </p>
            <h1 className="mt-2 max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
              {courseInfo.nomCourse || `Course ${courseInfo.course ?? ""}`}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              La fiche course sert de poste de lecture unique : ticket, contexte
              PMU, tableau des partants et resultat officiel restent dans le
              meme flux.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span key={pill} className="app-pill text-xs">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Depart</p>
            <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              {courseInfo.heureDepart || "--"}
            </p>
          </div>
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Fenetre</p>
            <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              {formatMinutesLabel(minutesUntilStart)}
            </p>
          </div>
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Allocation</p>
            <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              {formatEuros(courseInfo.allocation) || "--"}
            </p>
          </div>
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Acces</p>
            <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
              {paywallRequired ? "Preview public" : "Lecture complete"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LockedCard({
  previewLabel,
  previewLisibilite,
  previewRecommendation,
}: {
  previewLabel?: string | null;
  previewLisibilite?: string | null;
  previewRecommendation?: string | null;
}) {
  return (
    <section className="app-card p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label="Reserve premium" tone="warning" />
        {previewLisibilite ? <span className="app-pill text-xs">{previewLisibilite}</span> : null}
      </div>

      <h2 className="mt-4 text-3xl font-black text-[var(--pmu-text)]">
        Le ticket detaille est verrouille
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
        Le tableau des partants reste accessible, mais la lecture complete du
        moteur et le ticket d&apos;execution sont reserves a l&apos;acces Premium.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Cheval repere</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {previewLabel || "Signal en cours"}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Orientation</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {previewRecommendation || "Lecture a confirmer"}
          </p>
        </div>
      </div>

      <Link href="/premium" className="app-button-primary mt-5 inline-flex">
        Debloquer le pronostic premium
      </Link>
    </section>
  );
}

function AnalysisPendingCard() {
  return (
    <section className="app-card p-5 md:p-6">
      <StatusPill label="Analyse en cours" tone="neutral" />
      <h2 className="mt-4 text-3xl font-black text-[var(--pmu-text)]">
        Le moteur termine la lecture
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
        Les partants sont deja visibles, mais le ticket n&apos;est pas encore
        assez ferme pour etre affiche ici.
      </p>
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
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Lecture moteur</p>
          <h2 className="app-section-title">Top 5 de l&apos;algo</h2>
        </div>
      </div>

      <div className="grid gap-3">
        {top5.map((numero, index) => {
          const participant = participants.find(
            (item) => String(item.numero) === String(numero)
          );

          return (
            <div
              key={`${numero}-${index}`}
              className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pmu-primary-soft)] text-sm font-black text-[var(--pmu-primary)]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-black text-[var(--pmu-text)]">
                    N°{numero} {participant?.nom || `Cheval ${numero}`}
                  </p>
                  <p className="text-sm text-[var(--pmu-text-soft)]">
                    {participant?.entraineur || participant?.jockey || participant?.driver || "Profil a confirmer"}
                  </p>
                </div>
              </div>

              <div className="text-right text-sm">
                <p className="font-black text-[var(--pmu-text)]">
                  {Math.round(participant?.scoreIa ?? 0) || "--"}
                </p>
                <p className="text-[var(--pmu-text-soft)]">
                  {typeof participant?.cote === "number"
                    ? `Cote ${participant.cote.toFixed(1)}`
                    : "Cote --"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OfficialArrivalCard({ arrivee }: { arrivee: ArrivalRow[] }) {
  if (arrivee.length === 0) {
    return null;
  }

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Resultat officiel</p>
          <h2 className="app-section-title">Arrivee officielle</h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {arrivee.map((row, index) => (
          <div
            key={`${row.numPmu}-${index}`}
            className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] px-4 py-4 text-center"
          >
            <p className="app-label">{index + 1}e place</p>
            <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
              {row.numPmu}
            </p>
            <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
              {row.nom}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CourseDeskCard({
  courseInfo,
  minutesUntilStart,
  pronostic,
  paywallRequired,
  paywallPreview,
  isFinished,
}: {
  courseInfo: NonNullable<RaceApiResponse["courseInfo"]>;
  minutesUntilStart?: number | null;
  pronostic: PronosticCardData | null;
  paywallRequired: boolean;
  paywallPreview?: NonNullable<
    NonNullable<RaceApiResponse["paywall"]>["preview"]
  > | null;
  isFinished: boolean;
}) {
  const mainHorse = pronostic?.favoris?.[0] ?? paywallPreview?.favori?.numPmu ?? null;

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Desk course</p>
          <h2 className="app-section-title">Lecture rapide</h2>
        </div>
        <StatusPill
          label={isFinished ? "Terminee" : paywallRequired ? "Preview" : "Active"}
          tone={isFinished ? "neutral" : paywallRequired ? "warning" : "primary"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Discipline</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {formatDiscipline(courseInfo.discipline)}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Fenetre</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {formatMinutesLabel(minutesUntilStart)}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Cheval principal</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {mainHorse ? `N°${mainHorse}` : "A confirmer"}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Pari</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {pronostic?.betType || paywallPreview?.recommendation || "En attente"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-4">
        <p className="app-label">Contexte piste</p>
        <p className="mt-2 text-sm leading-7 text-[var(--pmu-text-soft)]">
          {[
            courseInfo.terrain ? `Terrain ${courseInfo.terrain}` : null,
            courseInfo.meteo ? `Meteo ${courseInfo.meteo}` : null,
            courseInfo.nombrePartants ? `${courseInfo.nombrePartants} partants` : null,
          ]
            .filter(Boolean)
            .join(" - ") || "Le contexte piste est encore en consolidation."}
        </p>
      </div>
    </section>
  );
}

function CourseDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6">
      <div className="app-page-hero h-64 animate-pulse" />
      <div className="grid gap-5 xl:grid-cols-[1.12fr,0.88fr]">
        <div className="app-card h-[28rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        <div className="grid gap-5">
          <div className="app-card h-56 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
          <div className="app-card h-56 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        </div>
      </div>
      <div className="app-card h-[34rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ reunion: string; course: string }>();
  const searchParams = useSearchParams();

  const [data, setData] = useState<RaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);

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
            authorization = session?.access_token
              ? `Bearer ${session.access_token}`
              : "";
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
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger cette course"
          );
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
  }, [course, fetchRevision, reunion, selectedDate]);

  const courseInfo = data?.courseInfo ?? null;
  const participants = useMemo(() => normalizeParticipants(data), [data]);
  const officialArrival = useMemo(() => normalizeOfficialArrival(data), [data]);
  const pronostic = useMemo(() => normalizePronostic(data), [data]);
  const ranking = useMemo(
    () =>
      Array.isArray(data?.analysis?.ranking) ? data.analysis?.ranking ?? [] : [],
    [data]
  );

  const top5 = Array.isArray(pronostic?.top5)
    ? pronostic.top5
    : ranking
        .slice(0, 5)
        .map((runner) => runner?.numPmu)
        .filter(
          (value): value is number | string =>
            value !== null && value !== undefined
        );

  const isFinished = Boolean(data?.isFinished || officialArrival.length > 0);
  const paywallRequired = data?.paywall?.required === true;
  const backHref = selectedDate ? `/?date=${selectedDate}` : "/";

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="app-button-secondary inline-flex">
          Retour aux courses
        </Link>

        {paywallRequired ? (
          <Link href="/premium" className="app-button-primary inline-flex">
            Debloquer le ticket
          </Link>
        ) : null}
      </div>

      {loading ? (
        <CourseDetailSkeleton />
      ) : error ? (
        <section className="app-card p-6 md:p-7">
          <p className="app-kicker">Fiche course</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
            Impossible de charger cette course
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
            {error}
          </p>
          <button
            type="button"
            className="app-button-primary mt-5"
            onClick={() => setFetchRevision((revision) => revision + 1)}
          >
            Reessayer
          </button>
        </section>
      ) : data && courseInfo ? (
        <>
          <CourseHero
            courseInfo={courseInfo}
            selectedDate={selectedDate}
            minutesUntilStart={data.minutesUntilStart}
            paywallRequired={paywallRequired}
            isFinished={isFinished}
          />

          <section className="grid gap-5 xl:grid-cols-[1.12fr,0.88fr]">
            <div className="space-y-5">
              {paywallRequired ? (
                <LockedCard
                  previewLabel={data.paywall?.preview?.favori?.nom ?? null}
                  previewLisibilite={data.paywall?.preview?.lisibilite ?? null}
                  previewRecommendation={
                    data.paywall?.preview?.recommendation ?? null
                  }
                />
              ) : pronostic ? (
                <CoursePronostic pronostic={pronostic} participants={participants} />
              ) : (
                <AnalysisPendingCard />
              )}
            </div>

            <div className="grid gap-5">
              <CourseDeskCard
                courseInfo={courseInfo}
                minutesUntilStart={data.minutesUntilStart}
                pronostic={pronostic}
                paywallRequired={paywallRequired}
                paywallPreview={data.paywall?.preview ?? null}
                isFinished={isFinished}
              />

              {top5.length > 0 ? (
                <TopFiveCard top5={top5} participants={participants} />
              ) : null}
            </div>
          </section>

          <ParticipantsTable
            participants={participants}
            favoriNum={pronostic?.favoris?.[0] ?? null}
            pepiteNum={data.analysis?.pepiteDuJour?.numPmu ?? null}
            estPlat={courseInfo.discipline?.toUpperCase() === "PLAT"}
            courseFinished={isFinished}
            officialArrival={officialArrival}
          />

          {officialArrival.length > 0 ? (
            <OfficialArrivalCard arrivee={officialArrival} />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
