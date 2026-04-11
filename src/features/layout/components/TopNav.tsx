"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appNavigationItems,
  isNavigationItemActive,
} from "@/features/layout/config/navigation";
import { SidebarSearch } from "./SidebarSearch";

function HorseMark() {
  return (
    <span className="turf-logo-mark" aria-hidden>
      <svg viewBox="0 0 48 48" fill="none">
        <path
          className="turf-logo-mark__shadow"
          d="M9 28.8c3.2-8.3 10.4-13.6 21.5-16 1.5-.3 3 .5 3.7 1.9l1.4 3 3.4 1.1-2.7 3.8-4.1-.7-1.5 5.5 4.8 6.5-4.2 1.1-5.4-5.6-5.1 1.1-1.1 6.6h-4.2l.6-8.1-4.7 3.5-2.4-3.7Z"
        />
        <path
          className="turf-logo-mark__horse"
          d="M9 28.8c3.2-8.3 10.4-13.6 21.5-16 1.5-.3 3 .5 3.7 1.9l1.4 3 3.4 1.1-2.7 3.8-4.1-.7-1.5 5.5 4.8 6.5-4.2 1.1-5.4-5.6-5.1 1.1-1.1 6.6h-4.2l.6-8.1-4.7 3.5-2.4-3.7Z"
        />
      </svg>
    </span>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const visibleItems = ["/", "/bilan", "/resultats", "/mes-paris"]
    .map((href) => appNavigationItems.find((item) => item.href === href))
    .filter((item): item is (typeof appNavigationItems)[number] => Boolean(item));

  return (
    <header className="turf-topbar">
      <div className="turf-topbar__inner">
        <Link href="/" className="turf-brand" aria-label="PMU Gagnant">
          <HorseMark />
          <span className="min-w-0">
            <span className="turf-brand__name">
              Turf<span>Edge</span>
            </span>
            <span className="turf-brand__tagline">L&apos;intelligence du terrain</span>
          </span>
        </Link>

        <nav className="turf-nav" aria-label="Navigation principale">
          {visibleItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href, item.external);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : undefined}
              >
                {item.href === "/"
                  ? "Programme"
                  : item.href === "/bilan"
                    ? "Performances"
                    : item.href === "/resultats"
                      ? "Historique"
                      : "Mon compte"}
              </Link>
            );
          })}
        </nav>

        <div className="turf-topbar__actions">
          <Link href="/premium" className="turf-premium-link">
            Premium
          </Link>
        </div>
      </div>
      <div className="turf-search-strip">
        <div className="turf-search-strip__inner">
          <div className="turf-search-strip__label">
            <span>Recherche directe</span>
            <small>No, cheval, jockey, driver, entraineur</small>
          </div>
          <SidebarSearch
            className="turf-search-strip__field"
            placeholder="Tape un no, cheval, jockey, driver ou entraineur"
          />
        </div>
      </div>
    </header>
  );
}
