import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/LandingPage";

export const metadata = {
  title: "PMU Gagnant — L'IA qui analyse les courses PMU à votre place",
  description:
    "PMU Gagnant lit le programme PMU à votre place. Le moteur VMAX score chaque cheval et vous remet un seul ticket par jour — celui où la value est mathématiquement défendable. ROI moyen +26% sur 30 jours.",
  openGraph: {
    title: "PMU Gagnant — L'IA qui analyse les courses PMU",
    description:
      "Un seul ticket par jour. Calculé. Défendable. ROI moyen +26% sur 30 jours.",
    url: "https://pmugagnant.com",
    siteName: "PMU Gagnant",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PMU Gagnant — L'IA qui analyse les courses PMU",
    description: "Un seul ticket par jour. ROI moyen +26% sur 30 jours.",
    images: ["/og-image.png"],
  },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Page server components cannot persist refreshed cookies.
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) redirect("/dashboard");
  }

  return <LandingPage />;
}
