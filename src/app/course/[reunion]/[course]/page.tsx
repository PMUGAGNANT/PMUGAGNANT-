"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { CoursePronostic } from "@/components/ui/CoursePronostic";
import { ParticipantsTable } from "@/components/ui/ParticipantsTable";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type RaceApiParticipant = {
  numero?: number | string | null;
  nom?: string | null;
  driver?: string | null;
  jockey?: string | null;
  entraineur?: string | null;
  proprietaire?: string | null;
  age?: number | null;
  sexe?: string | null;
  corde?: number | string | null;
  poids?: number | null;
  musique?: string | null;
  cote?: number | null;
  rapportDirect?: number | null;
  coefficientFormeCheval?: number | null;
  coefficientFormeJockey?: number | null;
  coefficientFormeEntraineur?: number | null;
  gainsCarriere?: number | null;
  gainsVictoires?: number | null;
  gainsPlace?: number | null;
};

type RaceApiData = {
  reunion: number;
  course: number;
  nom?: string | null;
  hippodrome?: string | null;
  discipline?: string | null;
  distance?: number | string | null;
  heureDepart?: string | null;
  heureFin?: string | null;
  nombrePartants?: number | null;
  meteo?: string | null;
  temperatureC?: number | null;
  allocation?: number | null;
  participants?: RaceApiParticipant[];
  pronostic?: {
    statut?: string;
    favoris?: Array<number | string>;
    outsider?: number | string | null;
    tocard?: number | string | null;
    bases?: Array<number | string>;
    champReduit?: Array<number | string>;
    ticketPrincipal?: Array<number | string>;
    top5?: Array<number | string>;
    scoreConfiance?: number | null;
    valueBet?: number | string | null;
    miseConseil?: number | null;
    lisibilite?: number | null;
    recommandation?: string | null;
    pourquoi?: string[];
  };
  officialResult?: {
    arrivee?: Array<number | string>;
    updatedAt?: string | null;
  };
};

function formatEuros(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function LockedCard() {
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
      <Link
        href="/premium"
        className="app-button-primary inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold sm:w-auto"
      >
        Debloquer la fiche Premium
      </Link>
    </div>
  );
}

function OfficialArrivalCard({
  arrivee,
  updatedAt,
}: {
  arrivee: Array<number | string>;
  updatedAt?: string | null;
}) {
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
        {arrivee.map((numero, index) => (
          <div
            key={`${numero}-${index}`}
            className="flex min-w-[88px] flex-col items-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-raised)] px-4 py-3 text-center"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--pmu-text-soft)]">
              {index + 1}e
            </span>
            <span className="mt-1 text-2xl font-black text-[var(--pmu-text)]">
              {numero}
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

  const [data, setData] = useState<RaceApiData | null>(null);
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

        const payload = (await response.json()) as RaceApiData;
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

  const meta = useMemo(() => {
    if (!data) return [];
    const items: string[] = [];
    if (data.discipline) items.push(data.discipline);
    if (data.distance) items.push(`${data.distance} m`);
    if (data.nombrePartants) items.push(`${data.nombrePartants} partants`);
    if (data.allocation) {
      const euros = formatEuros(data.allocation);
      if (euros) items.push(euros);
    }
    if (data.heureDepart) items.push(`Depart ${data.heureDepart}`);
    return items;
  }, [data]);

  const top5 = data?.pronostic?.top5 ?? [];

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
      ) : data ? (
        <>
          <section className="app-card flex flex-col gap-5 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="app-kicker">
                  R{data.reunion}C{data.course}
                  {data.hippodrome ? ` — ${data.hippodrome}` : ""}
                </p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-[var(--pmu-text)] md:text-4xl">
                  {data.nom || `Course ${data.course}`}
                </h1>
                <p className="text-sm text-[var(--pmu-text-soft)]">
                  {meta.length ? meta.join(" • ") : "Depart imminent"}
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <ParticipantsTable participants={data.participants ?? []} />

              <div className="flex flex-col gap-5">
                {data.pronostic ? (
                  <CoursePronostic pronostic={data.pronostic} participants={data.participants ?? []} />
                ) : (
                  <LockedCard />
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
                        const participant = (data.participants ?? []).find(
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

                {data.officialResult?.arrivee?.length ? (
                  <OfficialArrivalCard
                    arrivee={data.officialResult.arrivee}
                    updatedAt={data.officialResult.updatedAt}
                  />
                ) : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
