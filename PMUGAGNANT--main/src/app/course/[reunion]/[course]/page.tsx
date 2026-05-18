import type { Metadata } from "next";

import RaceDetailsPage from "@/features/race/RaceDetailsPage";

type CoursePageProps = {
  params: Promise<{
    reunion: string;
    course: string;
  }>;
  searchParams: Promise<{ date?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: CoursePageProps): Promise<Metadata> {
  const { reunion, course } = await params;
  const { date } = await searchParams;
  const raceCode = `R${reunion}C${course}`;
  const dateLabel = date ? ` · ${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}` : "";

  return {
    title: `${raceCode} - Analyse TurfEdge${dateLabel}`,
    description: `Analyse complète de la course ${raceCode} : score de confiance, cheval conseillé, mise Kelly, ticket complet et avis expert PMU.`,
    openGraph: {
      title: `${raceCode} · Analyse TurfEdge`,
      description: `Score IA, cheval conseillé, mise Kelly et décision JOUER/PASSER pour la course ${raceCode}.`,
    },
    robots: { index: false, follow: true },
  };
}

export default RaceDetailsPage;
