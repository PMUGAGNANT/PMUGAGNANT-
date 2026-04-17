"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isNavigationItemActive,
  mobileNavigationItems,
} from "@/features/layout/config/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 px-3 lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2">
        <nav className="rounded-lg border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_92%,transparent)] p-2 shadow-[var(--pmu-shadow)] backdrop-blur-xl">
          <div className="grid grid-cols-5 gap-1.5">
            {mobileNavigationItems.map((item) => {
              const active = isNavigationItemActive(pathname, item.href, item.external);
              const Icon = item.Icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 min-w-[3rem] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[10px] font-extrabold tracking-[0.01em] transition ${
                    active
                      ? "border border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary)_12%,var(--pmu-surface))] text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)]"
                      : "border border-transparent text-[var(--pmu-text-muted)]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      active
                        ? "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]"
                        : "bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] text-[var(--pmu-text-soft)]"
                    }`}
                  >
                    <Icon />
                  </span>
                  <span>{item.mobileLabel ?? item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
