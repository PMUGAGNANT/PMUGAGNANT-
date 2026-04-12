"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { CourseRoles } from "@/components/CourseRoles";
import { CourseDetailSkeleton } from "@/features/race/components/CourseDetailSkeleton";
import { CoursePronostic } from "@/features/race/components/CoursePronostic";
import {
  AnalysisPendingCard,
  CourseDeskCard,
  LockedTicketCard,
  OfficialArrivalCard,
  TopFiveCard,
} from "@/features/race/components/RaceDetailCards";
import { ParticipantsTable } from "@/features/race/components/ParticipantsTable";
import { RaceHeroSection } from "@/features/race/components/RaceHeroSection";
import {
  getTopFiveNumbers,
  normalizeOfficialArrival,
  normalizeParticipants,
  normalizePronostic,
  normalizeRoles,
  type RaceApiResponse,
} from "@/features/race/lib/race-page-model";
import { fetchRaceDetails } from "@/features/races/api/client";

function CourseLoadError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <section className="app-card p-6 md:p-7">
      <p className="app-kicker">Fiche course</p>
      <h1 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
        Impossible de charger cette course
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{error}</p>
      <button type="button" className="app-button-primary mt-5" onClick={onRetry}>
        Reessayer
      </button>
    </section>
  );
}

function CourseNotFoundState() {
  return (
    <section className="app-card p-6 md:p-7">
      <p className="app-kicker">Fiche course</p>
      <h1 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
        Course introuvable
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
        Le programme n&apos;a pas renvoye de contexte exploitable pour cette course.
      </p>
    </section>
  );
}

function RaceDetailsContent({
  data,
  selectedDate,
}: {
  data: RaceApiResponse;
  selectedDate: string | null;
}) {
  const courseInfo = data.courseInfo ?? null;
  const participants = useMemo(() => normalizeParticipants(data), [data]);
  const officialArrival = useMemo(() => normalizeOfficialArrival(data), [data]);
  const pronostic = useMemo(() => normalizePronostic(data), [data]);
  const roles = useMemo(() => normalizeRoles(data), [data]);
  const top5 = useMemo(() => getTopFiveNumbers(pronostic, data), [data, pronostic]);

  if (!courseInfo) {
    return <CourseNotFoundState />;
  }

  const isFinished = Boolean(data.isFinished || officialArrival.length > 0);
  const paywallRequired = data.paywall?.required === true;
  const roleLisibilite = data.analysis?.prediction?.lisibilite ?? "COMPLEXE";

  return (
    <>
      <RaceHeroSection
        courseInfo={courseInfo}
        selectedDate={selectedDate}
        minutesUntilStart={data.minutesUntilStart}
        paywallRequired={paywallRequired}
        isFinished={isFinished}
        refreshPriority={data.refreshPriority ?? null}
        meteo={data.meteo ?? null}
      />

      <section className="grid gap-5 xl:grid-cols-[1.12fr,0.88fr]">
        <div className="space-y-5">
          {paywallRequired ? (
            <LockedTicketCard
              previewLabel={data.paywall?.preview?.favori?.nom ?? null}
              previewLisibilite={data.paywall?.preview?.lisibilite ?? null}
              previewRecommendation={data.paywall?.preview?.recommendation ?? null}
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
            refreshPriority={data.refreshPriority ?? null}
          />

          <CourseRoles roles={roles} lisibilite={roleLisibilite} />

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
  );
}

export default function RaceDetailsPage() {
  const params = useParams<{ reunion: string; course: string }>();
  const searchParams = useSearchParams();

  const [data, setData] = useState<RaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);

  const reunion = params?.reunion ?? "";
  const course = params?.course ?? "";
  const selectedDate = searchParams.get("date");
  const backHref = selectedDate ? `/?date=${selectedDate}` : "/";

  useEffect(() => {
    let cancelled = false;

    async function loadRace() {
      try {
        setLoading(true);
        setError(null);

        const payload = await fetchRaceDetails<RaceApiResponse>(reunion, course, {
          date: selectedDate,
        });

        if (!cancelled) {
          setData(payload);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
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

  const paywallRequired = data?.paywall?.required === true;

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
        <CourseLoadError
          error={error}
          onRetry={() => setFetchRevision((revision) => revision + 1)}
        />
      ) : data ? (
        <RaceDetailsContent data={data} selectedDate={selectedDate} />
      ) : (
        <CourseNotFoundState />
      )}
    </main>
  );
}
