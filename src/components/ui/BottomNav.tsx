"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

type MobileItem = {
  href: string;
  label: string;
  Icon: () => ReactNode;
};

function IconCourses() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconParis() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3h18V7a2 2 0 00-2-2H5zM3 12h18v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z" />
    </svg>
  );
}

function IconResultats() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20V10m5 10V4m5 16v-7M4 20h16" />
    </svg>
  );
}

function IconBilan() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconPremium() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.6-4.8 2.6.9-5.3L4.2 8.7l5.4-.8L12 3z" />
    </svg>
  );
}

const navItems: MobileItem[] = [
  { href: "/", label: "Courses", Icon: IconCourses },
  { href: "/mes-paris", label: "Paris", Icon: IconParis },
  { href: "/resultats", label: "Resultats", Icon: IconResultats },
  { href: "/bilan", label: "Bilan", Icon: IconBilan },
  { href: "/premium", label: "Premium", Icon: IconPremium },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 px-3 lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2">
        <ThemeToggle compact className="w-fit self-center" />
        <nav className="rounded-[1.8rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-bg)_86%,transparent)] p-2 shadow-[var(--pmu-shadow)] backdrop-blur-xl">
          <div className="grid grid-cols-5 gap-1.5">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.Icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 min-w-[3rem] flex-col items-center justify-center gap-1 rounded-[1.15rem] px-2 py-2.5 text-[10px] font-extrabold tracking-[0.01em] transition ${
                    active
                      ? "border border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary)_12%,var(--pmu-surface))] text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)]"
                      : "border border-transparent text-[var(--pmu-text-muted)]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      active
                        ? "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]"
                        : "bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] text-[var(--pmu-text-soft)]"
                    }`}
                  >
                    <Icon />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
