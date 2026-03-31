import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/ui/AppShell";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "PMU Gagnant - Pronostics IA Courses Hippiques",
  description: "Algorithme IA pour identifier les meilleures courses PMU chaque jour",
  manifest: "/manifest.json",
  openGraph: {
    title: "PMU Gagnant - Pronostics IA Courses Hippiques",
    description: "Algorithme IA pour identifier les meilleures courses PMU chaque jour",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${manrope.className} min-h-screen text-[var(--pmu-text)] antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
