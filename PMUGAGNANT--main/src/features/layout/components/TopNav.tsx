"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appNavigationItems,
  isNavigationItemActive,
} from "@/features/layout/config/navigation";
import { ThemeSwitchButton } from "@/components/ui/ThemeSwitchButton";
import { SidebarSearch } from "./SidebarSearch";

export function TopNav() {
  const pathname = usePathname();
  const visibleItems = ["/", "/bilan", "/resultats", "/mes-paris"]
    .map((href) => appNavigationItems.find((item) => item.href === href))
    .filter((item): item is (typeof appNavigationItems)[number] => Boolean(item));

  return (
    <header className="turf-topbar">
      <div className="turf-topbar__inner">
        <Link href="/" className="turf-brand" aria-label="PMU Gagnant">
          <span className="turf-logo-mark" aria-hidden>
            PG
          </span>
          <span className="min-w-0">
            <span className="turf-brand__name">
              PMU<span>Gagnant</span>
            </span>
            <span className="turf-brand__tagline">L&apos;IA qui trie les courses</span>
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
          <ThemeSwitchButton className="theme-switch-button--topbar" />
          <Link href="/premium" className="turf-premium-link">
            Passer premium
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
