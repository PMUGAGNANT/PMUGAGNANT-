"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Courses", shortLabel: "Courses" },
  { href: "/mes-paris", label: "Mes Paris", shortLabel: "Paris" },
  { href: "/bilan", label: "Bilan", shortLabel: "Bilan" },
  { href: "/premium", label: "Profil", shortLabel: "Profil" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-surface fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[var(--pmu-border)] lg:flex">
      <div className="flex h-full w-full flex-col px-5 py-6">
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(13,148,136,0.25)] bg-[rgba(13,148,136,0.1)] text-lg font-bold text-[var(--pmu-primary)] shadow-[0_8px_24px_rgba(13,148,136,0.1)]">
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-[var(--pmu-text)]">PMU Gagnant</p>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.28em] text-[var(--pmu-text-muted)]">
              Pronostics IA
            </p>
          </div>
        </Link>

        <div className="mt-8 space-y-1">
          {(navItems ?? []).map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[rgba(13,148,136,0.1)] text-[var(--pmu-primary)]"
                    : "text-[var(--pmu-text-soft)] hover:bg-[var(--pmu-surface-2)] hover:text-[var(--pmu-text)]"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition ${
                    active ? "bg-[var(--pmu-primary)]" : "bg-transparent"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto app-card-muted p-4">
          <p className="app-kicker">Radar Jour</p>
          <p className="mt-2 text-sm font-semibold text-[var(--pmu-text)]">Lecture rapide des meilleures opportunités du jour.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-muted)]">
            Home publique, tickets premium et bilan réel dans une seule interface dense et lisible.
          </p>
        </div>
      </div>
    </aside>
  );
}
