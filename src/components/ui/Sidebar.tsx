"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

import { SidebarProgramme } from "./SidebarProgramme";
import { SidebarSearch } from "./SidebarSearch";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  Icon: () => ReactNode;
  external?: boolean;
  meta?: string;
};

function IconCourses() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconParis() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3h18V7a2 2 0 00-2-2H5zM3 12h18v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z"
      />
    </svg>
  );
}

function IconBilan() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function IconBlog() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 4L3.8 10.6a1 1 0 00.06 1.9l4.84 1.5 1.5 4.84a1 1 0 001.9.06L20 3.98A.75.75 0 0021 4z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.72 13.28L20.5 4.5" />
    </svg>
  );
}

function IconPremium() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/", label: "Courses", Icon: IconCourses },
  { href: "/mes-paris", label: "Mes paris", Icon: IconParis },
  { href: "/bilan", label: "Bilan", Icon: IconBilan },
  { href: "/resultats", label: "Resultats", Icon: IconResultats },
  {
    href: "https://t.me/pmupredictionbot?start=pmugagnant",
    label: "Telegram",
    Icon: IconTelegram,
    external: true,
    meta: "Bot",
  },
  { href: "/blog", label: "Blog", Icon: IconBlog },
  { href: "/premium", label: "Premium", Icon: IconPremium },
];

function isActive(pathname: string, href: string, external = false) {
  if (external) {
    return false;
  }

  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemClass(active: boolean) {
  return `group relative flex items-center gap-3 rounded-[1.15rem] border px-4 py-3 text-sm font-semibold transition ${
    active
      ? "border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary)_12%,var(--pmu-surface))] text-[var(--pmu-text)] shadow-[var(--pmu-glow-soft)]"
      : "border-transparent text-[var(--pmu-text-muted)] hover:border-[var(--pmu-border)] hover:bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] hover:text-[var(--pmu-text)]"
  }`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [connexionLabel, setConnexionLabel] = useState(() =>
    !hasSupabaseConfig() ? "Invite" : "Chargement...",
  );

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    function syncSession() {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        const email = session?.user?.email;
        setConnexionLabel(email ?? "Non connecte");
      });
    }

    syncSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      syncSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[19rem] p-4 lg:flex">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-bg)_86%,transparent)] shadow-[var(--pmu-shadow)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--pmu-primary)_16%,transparent),transparent_34%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--pmu-orange)_12%,transparent),transparent_24%)]" />
        <div className="relative flex h-full flex-col px-4 py-5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[1.5rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_78%,transparent)] px-3 py-3 transition hover:border-[var(--pmu-border-strong)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-soft)] text-sm font-black text-[var(--pmu-primary)]">
              PG
            </div>
            <div className="min-w-0">
              <p className="app-brand-wordmark truncate text-lg font-black text-[var(--pmu-text)]">PMU Gagnant</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
                Racing desk
              </p>
            </div>
          </Link>

          <div className="mt-4 rounded-[1.5rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_82%,transparent)] p-4">
            <p className="app-kicker text-[10px]">Table de lecture</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--pmu-text-soft)]">
              Une interface plus calme pour filtrer le programme, ouvrir la bonne course et garder la discipline visible.
            </p>
            <Link href="/premium" className="app-button-primary mt-4 inline-flex w-full text-sm">
              Voir le premium
            </Link>
          </div>

          <div className="mt-4">
            <SidebarSearch />
          </div>

          <div className="mt-5">
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
              Navigation
            </p>
            <nav className="mt-2 space-y-1.5">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href, item.external);
                const Icon = item.Icon;

                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={itemClass(active)}
                    >
                      <span className="h-2 w-2 rounded-full bg-[var(--pmu-border-strong)] transition group-hover:bg-[var(--pmu-primary)]" />
                      <Icon />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.meta ? (
                        <span className="rounded-full border border-[var(--pmu-border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--pmu-text-soft)]">
                          {item.meta}
                        </span>
                      ) : null}
                    </a>
                  );
                }

                return (
                  <div key={item.href} className="space-y-1.5">
                    <Link href={item.href} className={itemClass(active)}>
                      <span className={`h-2 w-2 rounded-full transition ${active ? "bg-[var(--pmu-primary)]" : "bg-[var(--pmu-border-strong)]"}`} />
                      <Icon />
                      <span className="flex-1">{item.label}</span>
                    </Link>

                    {item.href === "/" ? (
                      <Suspense
                        fallback={
                          <div className="ml-3 rounded-[1.25rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3">
                            <div className="h-10 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--pmu-surface-2)_78%,transparent)]" />
                          </div>
                        }
                      >
                        <div className="ml-3 rounded-[1.25rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-2.5">
                          <SidebarProgramme />
                        </div>
                      </Suspense>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto space-y-3 border-t border-[var(--pmu-border)] pt-4">
            <div className="rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_82%,transparent)] p-4">
              <p className="app-kicker text-[10px]">Session</p>
              <p className="mt-2 truncate text-sm font-semibold text-[var(--pmu-text)]" title={connexionLabel}>
                {connexionLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
                Connexion, bankroll et acces premium synchronises avec Supabase.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
