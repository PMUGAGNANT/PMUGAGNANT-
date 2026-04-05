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
  prediction?: {
    confiance?: number | null;
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
    nomCourse?: string | null;
    discipline?: string | null;
    distance?: number | string | null;
    heureDepart?: string | null;
    nombrePartants?: number | null;
    allocation?: number | null;
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
  };
}

function normalizeParticipants(payload: RaceApiResponse | null): CourseParticipantRow[] {
  if (Array.isArray(payload?.participants)) {
    return payload.participants.map(toParticipantRow);
  }

  if (Array.isArray(payload?.analysis?.ranking)) {
    return payload.analysis.ranking.map(toParticipantRow);
  }

  return [];
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
    ? selected.prediction?.topFacteurs ?? []
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
    scoreConfiance:
      analysis.scoreConfiance?.score ??
      selected?.prediction?.confiance ??
      null,
    valueBet: analysis.pepiteDuJour?.numPmu ?? null,
    miseConseil: selected?.prediction?.miseConseillee ?? null,
    recommandation: analysis.recommandation?.decision ?? null,
    betType: selected?.prediction?.typePariConseille ?? null,
    pourquoi: facteurs.filter((factor): factor is string => typeof factor === "string"),
  };
}

function LockedCard({ previewLabel }: { previewLabel?: string | null }) {
  return (
    <div className="app-card app-card-muted flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-3 text-[var(--pmu-primary)]">
        <span aria-hidden>🔒</span>
        <span className="app-kicker">Pronostic reserve</span>
      </div>
      <h3 className="text-lg font-semibold text-[var(--pmu-text)]">Fiche course</h3>
      <p className="text-sm text-[var(--pmu-text-soft)]">
        Le tableau complet des partants et la lecture IA detaillee sont disponibles
        avec l&apos;acces Premium.
      </p>
      {previewLabel ? (
        <p className="text-sm text-[var(--pmu-text)]">
          Apercu disponible : <strong>{previewLabel}</strong>
        </p>
      ) : null}
      <Link
        href="/premium"
        className="app-button-primary inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold sm:w-auto"
      >
        Debloquer la fiche Premium
      </Link>
    </div>
  );
}

function AnalysisPendingCard() {
  return (
    <div className="app-card app-card-muted flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-3 text-[var(--pmu-primary)]">
        <span aria-hidden>⏳</span>
        <span className="app-kicker">Lecture moteur</span>
      </div>
      <h3 className="text-lg font-semibold text-[var(--pmu-text)]">Analyse en cours</h3>
      <p className="text-sm text-[var(--pmu-text-soft)]">
        Le moteur termine encore la lecture de cette course. Recharge la page dans
        quelques instants.
      </p>
    </div>
  );
}

function OfficialArrivalCard({
  arrivee,
  updatedAt,
}: {
  arrivee: ArrivalRow[];
  updatedAt?: string | null;
}) {
  const safeArrival = Array.isArray(arrivee) ? arrivee : [];

  if (safeArrival.length === 0) {
    return null;
  }

  return (
    <div className="app-card flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(0,255,136,0.08)] text-[var(--pmu-primary)]">
            <span aria-hidden>🏆</span>
          </div>
          <div>
            <p className="app-kicker">Resultat officiel</p>
            <h3 className="text-lg font-semibold text-[var(--pmu-text)]">
              Arrivee officielle
            </h3>
          </div>
        </div>
        {updatedAt ? (
          <p className="text-xs text-[var(--pmu-text-soft)]">
            Mis a jour {new Date(updatedAt).toLocaleString("fr-FR")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {safeArrival.map((row, index) => (
          <div
            key={`${row.numPmu}-${index}`}
            className="flex min-w-[88px] flex-col items-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-raised)] px-4 py-3 text-center"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--pmu-text-soft)]">
              {index + 1}e
            </span>
            <span className="mt-1 text-2xl font-black text-[var(--pmu-text)]">
              {row.numPmu}
            </span>
          </div>
        ))}
      </div>
    </div>
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
    () => (Array.isArray(data?.analysis?.ranking) ? data.analysis?.ranking ?? [] : []),
    [data],
  );
  const top5 = Array.isArray(pronostic?.top5)
    ? pronostic.top5
    : ranking
        .slice(0, 5)
        .map((runner) => runner?.numPmu)
        .filter((value): value is number | string => value !== null && value !== undefined);

  const meta = useMemo(() => {
    if (!courseInfo) return [];
    const items: string[] = [];
    if (courseInfo.discipline) items.push(courseInfo.discipline);
    if (courseInfo.distance) items.push(`${courseInfo.distance} m`);
    if (courseInfo.nombrePartants) items.push(`${courseInfo.nombrePartants} partants`);
    if (courseInfo.allocation) {
      const euros = formatEuros(courseInfo.allocation);
      if (euros) items.push(euros);
    }
    if (courseInfo.heureDepart) items.push(`Depart ${courseInfo.heureDepart}`);
    return items;
  }, [courseInfo]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 md:px-6">
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
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="h-[360px] animate-pulse rounded-2xl bg-[var(--pmu-skeleton)]" />
            <div className="h-[360px] animate-pulse rounded-2xl bg-[var(--pmu-skeleton)]" />
          </div>
        </section>
      ) : error ? (
        <section className="app-card flex flex-col gap-3 rounded-2xl p-5">
          <p className="app-kicker">Fiche course</p>
          <h1 className="text-2xl font-black text-[var(--pmu-text)]">
            Impossible de charger cette course
          </h1>
          <p className="text-sm text-[var(--pmu-text-soft)]">{error}</p>
        </section>
      ) : data && courseInfo ? (
        <section className="app-card flex flex-col gap-5 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="app-kicker">
                R{courseInfo.reunion ?? reunion}C{courseInfo.course ?? course}
                {courseInfo.hippodrome ? ` - ${courseInfo.hippodrome}` : ""}
              </p>
              <h1 className="text-3xl font-black tracking-[-0.03em] text-[var(--pmu-text)] md:text-4xl">
                {courseInfo.nomCourse || `Course ${course}`}
              </h1>
              <p className="text-sm text-[var(--pmu-text-soft)]">
                {meta.length ? meta.join(" • ") : "Depart imminent"}
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <ParticipantsTable
              participants={participants}
              favoriNum={pronostic?.favoris?.[0] ?? null}
              pepiteNum={data.analysis?.pepiteDuJour?.numPmu ?? null}
              estPlat={courseInfo.discipline?.toUpperCase() === "PLAT"}
              courseFinished={Boolean(data.isFinished || officialArrival.length)}
              officialArrival={officialArrival}
            />

            <div className="flex flex-col gap-5">
              {data.paywall?.required ? (
                <LockedCard previewLabel={data.paywall.preview?.favori?.nom ?? null} />
              ) : pronostic ? (
                <CoursePronostic pronostic={pronostic} participants={participants} />
              ) : (
                <AnalysisPendingCard />
              )}

              {top5.length ? (
                <div className="app-card app-card-muted flex flex-col gap-4 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="app-kicker">Lecture moteur</p>
                      <h3 className="text-lg font-semibold text-[var(--pmu-text)]">
                        Repere principal
                      </h3>
                    </div>
                    <span className="rounded-full border border-[var(--pmu-border)] px-3 py-1 text-xs font-semibold text-[var(--pmu-text-soft)]">
                      Top 5
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {top5.map((numero, index) => {
                      const participant = participants.find(
                        (item) => String(item.numero) === String(numero),
                      );

                      return (
                        <div
                          key={`${numero}-${index}`}
                          className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-raised)] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pmu-text-soft)]">
                              {index + 1}
                            </span>
                            <span className="text-2xl font-black text-[var(--pmu-primary)]">
                              {numero}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[var(--pmu-text)]">
                            {participant?.nom || `Cheval ${numero}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {officialArrival.length ? (
                <OfficialArrivalCard arrivee={officialArrival} updatedAt={null} />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
