import type { ReactNode } from "react";

export type AppNavigationItem = {
  href: string;
  label: string;
  description: string;
  Icon: () => ReactNode;
  external?: boolean;
  meta?: string;
  showOnMobile?: boolean;
  mobileLabel?: string;
};

function IconCourses() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconParis() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3h18V7a2 2 0 00-2-2H5zM3 12h18v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z" />
    </svg>
  );
}

function IconBilan() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconBlog() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function IconResultats() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20V10m5 10V4m5 16v-7M4 20h16" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 4L3.8 10.6a1 1 0 00.06 1.9l4.84 1.5 1.5 4.84a1 1 0 001.9.06L20 3.98A.75.75 0 0021 4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.72 13.28L20.5 4.5" />
    </svg>
  );
}

function IconPremium() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.6-4.8 2.6.9-5.3L4.2 8.7l5.4-.8L12 3z" />
    </svg>
  );
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    href: "/",
    label: "Courses",
    description: "Radar, priorites et programme du jour",
    Icon: IconCourses,
    showOnMobile: true,
  },
  {
    href: "/mes-paris",
    label: "Mes paris",
    mobileLabel: "Paris",
    description: "Suivi personnel, tickets et bankroll",
    Icon: IconParis,
    showOnMobile: true,
  },
  {
    href: "/bilan",
    label: "Bilan",
    description: "ROI, segments et performance moteur",
    Icon: IconBilan,
    showOnMobile: true,
  },
  {
    href: "/resultats",
    label: "Resultats",
    description: "Historique, preuves et courses terminees",
    Icon: IconResultats,
    showOnMobile: true,
  },
  {
    href: "https://t.me/pmupredictionbot?start=pmugagnant",
    label: "Telegram",
    description: "Alertes rapides et bot compagnon",
    Icon: IconTelegram,
    external: true,
    meta: "Bot",
    showOnMobile: false,
  },
  {
    href: "/blog",
    label: "Blog",
    description: "Methodes, guides et contenu d'acquisition",
    Icon: IconBlog,
    showOnMobile: false,
  },
  {
    href: "/premium",
    label: "Premium",
    description: "Offre, acces complet et conversion",
    Icon: IconPremium,
    showOnMobile: true,
  },
];

export const mobileNavigationItems = appNavigationItems.filter(
  (item) => item.showOnMobile
);

export function isNavigationItemActive(
  pathname: string,
  href: string,
  external = false
) {
  if (external) {
    return false;
  }

  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
