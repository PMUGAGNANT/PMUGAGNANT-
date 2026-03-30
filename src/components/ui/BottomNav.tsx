"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Courses" },
  { href: "/mes-paris", label: "Paris" },
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
    <nav className="app-surface fixed inset-x-0 bottom-0 z-50 border-t border-[var(--pmu-border)] px-3 py-2 lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-semibold transition ${
                active
                  ? "bg-[rgba(0,255,136,0.12)] text-[var(--pmu-primary)]"
                  : "text-[var(--pmu-text-muted)]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${active ? "bg-[var(--pmu-primary)]" : "bg-[#111111]"}`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
