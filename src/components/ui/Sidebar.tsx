"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  Icon: () => ReactNode;
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

function IconProfil() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/", label: "Courses", Icon: IconCourses },
  { href: "/mes-paris", label: "Mes Paris", Icon: IconParis },
  { href: "/bilan", label: "Bilan", Icon: IconBilan },
  { href: "/premium", label: "Profil", Icon: IconProfil },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [connexionLabel, setConnexionLabel] = useState(() =>
    !hasSupabaseConfig() ? "Invité (sans compte)" : "…"
  );

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    function syncSession() {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        const email = session?.user?.email;
        setConnexionLabel(email ?? "Non connecté");
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--pmu-border)] bg-[var(--pmu-bg)] lg:flex">
      <div className="flex h-full w-full flex-col px-4 py-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-[var(--pmu-surface-2)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--pmu-primary)]/40 bg-[var(--pmu-primary-soft)] text-sm font-black text-[var(--pmu-primary)] shadow-[var(--pmu-glow)]">
            PG
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-[var(--pmu-text)]">PMU GAGNANT</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--pmu-text-muted)]">
              Pronostics IA
            </p>
          </div>
        </Link>

        <nav className="mt-8 space-y-1">
          {(navItems ?? []).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.Icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--pmu-surface-2)] text-[var(--pmu-primary)]"
                    : "text-[var(--pmu-text-muted)] hover:bg-[var(--pmu-surface-2)] hover:text-[var(--pmu-text)]"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-full transition ${
                    active ? "bg-[var(--pmu-primary)] shadow-[0_0_12px_var(--pmu-primary)]" : "bg-transparent"
                  }`}
                />
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-[var(--pmu-border)] pt-4">
          <ThemeToggle />
          <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
            <p className="app-kicker text-[10px]">Session</p>
            <p className="mt-2 truncate text-xs font-semibold text-[var(--pmu-text-muted)]" title={connexionLabel}>
              {connexionLabel}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
              Connexion utilisateur et accès premium synchronisés avec Supabase.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
