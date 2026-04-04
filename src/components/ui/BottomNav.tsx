"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/", label: "Courses" },
  { href: "/mes-paris", label: "Paris" },
  { href: "/resultats", label: "📊 Stats" },
  { href: "/bilan", label: "Bilan" },
  { href: "/premium", label: "Profil" },
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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 pb-2 pt-2 lg:hidden">
      <ThemeToggle compact className="mb-2 w-full max-w-sm mx-auto" />
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">
        {(navItems ?? []).map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 min-w-[3rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-semibold transition ${
                active ? "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]" : "text-[var(--pmu-text-muted)]"
              }`}
            >
              <span
                className={`h-0.5 w-6 rounded-full ${
                  active ? "bg-[var(--pmu-primary)] shadow-[0_0_8px_var(--pmu-primary)]" : "bg-[var(--pmu-border-strong)]"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
