"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/", label: "Courses" },
  { href: "/mes-paris", label: "Paris" },
  { href: "/resultats", label: "Stats" },
  { href: "/bilan", label: "Bilan" },
  { href: "/premium", label: "Premium" },
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
        <ThemeToggle compact className="w-fit self-center px-4" />
        <nav className="rounded-[1.8rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-bg)_90%,transparent)] p-2 shadow-[var(--pmu-shadow)] backdrop-blur-xl">
          <div className="grid grid-cols-5 gap-2">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 min-w-[3rem] flex-col items-center justify-center gap-1 rounded-[1.2rem] px-2 py-3 text-[11px] font-semibold transition ${
                    active
                      ? "bg-[color-mix(in_srgb,var(--pmu-primary)_12%,var(--pmu-surface))] text-[var(--pmu-text)] shadow-[var(--pmu-glow-soft)]"
                      : "text-[var(--pmu-text-muted)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      active ? "bg-[var(--pmu-primary)]" : "bg-[var(--pmu-border-strong)]"
                    }`}
                  />
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
