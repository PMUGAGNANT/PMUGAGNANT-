"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AvisExpert } from "@/components/AvisExpert";
import { CourseRoles } from "@/components/CourseRoles";
import { LiveCotesChart } from "@/components/LiveCotesChart";
import { CourseDetailSkeleton } from "@/features/race/components/CourseDetailSkeleton";
import { CoursePronostic } from "@/features/race/components/CoursePronostic";
import {
  AnalysisPendingCard,
  LockedTicketCard,
  OfficialArrivalCard,
} from "@/features/race/components/RaceDetailCards";
import {
  ParticipantsTable,
  type ArrivalRow,
} from "@/features/race/components/ParticipantsTable";
import { RaceHeroSection } from "@/features/race/components/RaceHeroSection";
import {
  normalizeOfficialArrival,
  normalizeParticipants,
  normalizePronostic,
  normalizeRoles,
  type PronosticCardData,
  type RaceApiResponse,
} from "@/features/race/lib/race-page-model";
import { fetchRaceDetails } from "@/features/races/api/client";

function SectionKicker({ children }: { children: ReactNode }) {
  return <p className="app-kicker mb-3">{children}</p>;
}

function TicketResultBanner({
  pronostic,
  officialArrival,
}: {
  pronostic: PronosticCardData;
  officialArrival: ArrivalRow[];
}) {
  const pickNum = pronostic.favoris?.[0] ?? pronostic.top5?.[0] ?? null;

  if (pickNum === null) {
    return null;
  }

  const arrival = officialArrival.find(
    (row) => String(row.numPmu) === String(pickNum)
  );
  const position = arrival?.position ?? null;
  const isWinner = position === 1;
  const isPlaced = position !== null && position <= 3;
  const tone = isWinner
    ? {
        background: "var(--pmu-primary-soft)",
        border: "color-mix(in srgb, var(--pmu-primary) 28%, transparent)",
        color: "var(--pmu-primary)",
        icon: "✓",
        title: "Ticket gagnant",
      }
    : isPlaced
      ? {
          background: "var(--pmu-gold-light)",
          border: "color-mix(in srgb, var(--pmu-gold) 30%, transparent)",
          color: "var(--pmu-gold)",
          icon: "•",
          title: "Cheval placé",
        }
      : {
          background: "color-mix(in srgb, var(--pmu-red) 9%, white)",
          border: "color-mix(in srgb, var(--pmu-red) 20%, transparent)",
          color: "var(--pmu-red)",
          icon: "×",
          title: "Ticket perdant",
        };

  return (
    <div
      style={{
        background: tone.background,
        border: `1px solid ${tone.border}`,
        borderRadius: "8px",
        padding: "0.85rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "var(--pmu-shadow-sm)",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          color: tone.color,
          fontSize: "1.3rem",
          fontWeight: 800,
        }}
      >
        {tone.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: tone.color, fontSize: "0.88rem", fontWeight: 700 }}>
          {tone.title} - N°{pickNum} {arrival?.nom ?? ""}
        </p>
        <p
          style={{
            color: "var(--pmu-text-muted)",
            fontSize: "0.72rem",
            marginTop: "0.15rem",
          }}
        >
          {pronostic.betType || "Simple gagnant"} · Mise{" "}
          {pronostic.miseConseil ?? 0} EUR
          {position ? ` · Arrivée ${position === 1 ? "1er" : `${position}e`}` : ""}
        </p>
      </div>
    </div>
  );
}

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
        Réessayer
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
        Le programme n&apos;a pas renvoyé de contexte exploitable pour cette course.
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
  const pepiteRole = roles.find((role) => role.role === "PEPITE") ?? null;

  if (!courseInfo) {
    return <CourseNotFoundState />;
  }

  const isFinished = Boolean(data.isFinished || officialArrival.length > 0);
  const paywallRequired = data.paywall?.required === true;
  const roleLisibilite = data.analysis?.prediction?.lisibilite ?? "COMPLEXE";

  return (
    <>
      <div className="space-y-6">
        {isFinished && pronostic && officialArrival.length > 0 ? (
          <section>
            <SectionKicker>Résultat du ticket</SectionKicker>
            <TicketResultBanner
              pronostic={pronostic}
              officialArrival={officialArrival}
            />
          </section>
        ) : null}

        {isFinished && officialArrival.length > 0 ? (
          <section>
            <SectionKicker>Arrivée officielle</SectionKicker>
            <OfficialArrivalCard arrivee={officialArrival} />
          </section>
        ) : null}

        <section>
          <SectionKicker>Decision TurfEdge</SectionKicker>
          {paywallRequired ? (
            <LockedTicketCard
              previewLabel={data.paywall?.preview?.favori?.nom ?? null}
              previewLisibilite={data.paywall?.preview?.lisibilite ?? null}
              previewRecommendation={data.paywall?.preview?.recommendation ?? null}
            />
          ) : pronostic ? (
            <CoursePronostic
              pronostic={pronostic}
              participants={participants}
              courseInfo={courseInfo}
            />
          ) : (
            <AnalysisPendingCard />
          )}
          <p className="mt-3 rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--pmu-text-muted)]">
            Lecture pratique: decision, cheval, mise et raisons. Un pari reste
            risque; PMU Gagnant sert d&apos;aide au tri, pas de garantie de gain.
          </p>
        </section>

        <RaceHeroSection
          courseInfo={courseInfo}
          selectedDate={selectedDate}
          minutesUntilStart={data.minutesUntilStart}
          paywallRequired={paywallRequired}
          isFinished={isFinished}
          refreshPriority={data.refreshPriority ?? null}
          meteo={data.meteo ?? null}
          lisibilite={roleLisibilite}
        />

        {roles.length > 0 ? (
          <section>
            <SectionKicker>4 rôles clés</SectionKicker>
            <CourseRoles
              roles={roles}
              lisibilite={roleLisibilite}
              course={courseInfo}
              officialArrival={isFinished ? officialArrival : []}
            />
          </section>
        ) : null}

        {!isFinished ? (
          <section>
            <SectionKicker>Avis expert - top 5</SectionKicker>
            <AvisExpert
              predictions={data.avisExpert ?? []}
              isPremium={!paywallRequired}
            />
          </section>
        ) : null}

        {(data.liveCotes ?? []).length > 0 ? (
          <section>
            <SectionKicker>Évolution des cotes</SectionKicker>
            <LiveCotesChart
              series={data.liveCotes ?? []}
              pepiteNum={pepiteRole?.cheval_num ?? null}
            />
          </section>
        ) : null}

        <section>
          <SectionKicker>Pour les experts</SectionKicker>
          <ParticipantsTable
            participants={participants}
            favoriNum={pronostic?.favoris?.[0] ?? null}
            pepiteNum={data.analysis?.pepiteDuJour?.numPmu ?? null}
            estPlat={courseInfo.discipline?.toUpperCase() === "PLAT"}
            courseFinished={isFinished}
            officialArrival={officialArrival}
          />
        </section>
      </div>
    </>
  );
}

export default function RaceDetailsPage() {
  const params = useParams<{ reunion: string; course: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<RaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const reunion = params?.reunion ?? "";
  const course = params?.course ?? "";
  const selectedDate = searchParams.get("date");
  const backHref = selectedDate ? `/?date=${selectedDate}` : "/";
  const currentCourseNumber = Number.parseInt(course, 10);

  function navigateToSiblingCourse(direction: "next" | "previous") {
    if (!reunion || !Number.isFinite(currentCourseNumber)) {
      return;
    }

    const nextCourse =
      direction === "next"
        ? currentCourseNumber + 1
        : Math.max(1, currentCourseNumber - 1);

    if (nextCourse === currentCourseNumber) {
      return;
    }

    const dateQuery = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
    router.push(`/course/${encodeURIComponent(reunion)}/${nextCourse}${dateQuery}`);
  }

  function handleTouchEnd(clientX: number | null | undefined) {
    if (touchStartX === null || typeof clientX !== "number") {
      setTouchStartX(null);
      return;
    }

    const delta = touchStartX - clientX;
    setTouchStartX(null);

    if (Math.abs(delta) < 70) {
      return;
    }

    navigateToSiblingCourse(delta > 0 ? "next" : "previous");
  }

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
    <main
      className="mx-auto flex w-full max-w-[64rem] flex-col gap-6 px-4 py-5 md:px-6"
      onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="app-button-secondary inline-flex">
          Retour aux courses
        </Link>

        {paywallRequired ? (
          <Link href="/premium" className="app-button-primary inline-flex">
            Débloquer le ticket
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
