import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/components/ui/AppShell";
import { ThemeMetaColor } from "@/components/ui/ThemeMetaColor";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
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
  maximumScale: 5,
  themeColor: "#060606",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${manrope.className} min-h-screen text-[var(--pmu-text)] antialiased`}>
        <a href="#main-content" className="pmu-skip-link">
          Aller au contenu
        </a>
        <Script id="pmu-theme-init" strategy="beforeInteractive">
          {`(function(){try{var k='pmu-theme';var v=localStorage.getItem(k);if(v==='warm'||v==='dark')document.documentElement.setAttribute('data-theme',v);}catch(e){}})();`}
        </Script>
        <ThemeProvider>
          <ThemeMetaColor />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
