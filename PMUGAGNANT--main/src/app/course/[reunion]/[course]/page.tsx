import type { Metadata } from "next";

import RaceDetailsPage from "@/features/race/RaceDetailsPage";

type CoursePageProps = {
  params: Promise<{
    reunion: string;
    course: string;
  }>;
};

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { reunion, course } = await params;
  const raceCode = `R${reunion}C${course}`;

  return {
    title: `${raceCode} - Analyse TurfEdge`,
    description: `Analyse complète de la course ${raceCode} : score de confiance, cheval retenu, ticket conseillé et avis expert.`,
  };
}

export default RaceDetailsPage;
