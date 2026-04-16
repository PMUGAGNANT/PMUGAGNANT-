"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import {
  appNavigationItems,
  isNavigationItemActive,
} from "@/features/layout/config/navigation";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

import { SidebarProgramme } from "./SidebarProgramme";
import { SidebarQuinteCard } from "./SidebarQuinteCard";
import { SidebarSearch } from "./SidebarSearch";
import { ThemeToggle } from "./ThemeToggle";

function ScrollArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "up" ? "M5.5 12.5L10 8l4.5 4.5" : "M5.5 7.5L10 12l4.5-4.5"}
      />
    </svg>
  );
}

function navItemClass(active: boolean) {
  return `group relative flex items-start gap-3 rounded-[1.2rem] border px-3.5 py-3 transition ${
    active
      ? "border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary)_11%,var(--pmu-surface))] shadow-[var(--pmu-shadow-sm)]"
      : "border-[color-mix(in_srgb,var(--pmu-border)_72%,transparent)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] hover:border-[var(--pmu-border-strong)] hover:bg-[color-mix(in_srgb,var(--pmu-surface-highlight)_68%,var(--pmu-surface))]"
  }`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [connexionLabel, setConnexionLabel] = useState(() =>
    !hasSupabaseConfig() ? "Invite" : "Chargement..."
  );
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
    progress: 0,
    thumbSize: 100,
    hasOverflow: false,
  });

  const activeSection =
    appNavigationItems.find((item) =>
      isNavigationItemActive(pathname, item.href, item.external)
    )?.label ??
    "Pilotage";
  const isConnected =
    connexionLabel !== "Invite" &&
    connexionLabel !== "Non connecte" &&
    connexionLabel !== "Chargement...";

  const syncScrollState = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 0);
    const hasOverflow = maxScroll > 6;
    const progress =
      maxScroll > 0 ? Number((viewport.scrollTop / maxScroll).toFixed(3)) : 0;
    const thumbSize = hasOverflow
      ? Math.min(
          100,
          Math.max(
            20,
            Number(
              ((viewport.clientHeight / viewport.scrollHeight) * 100).toFixed(1)
            )
          )
        )
      : 100;

    setScrollState((current) => {
      if (
        current.canScrollUp === (viewport.scrollTop > 4) &&
        current.canScrollDown === (viewport.scrollTop < maxScroll - 4) &&
        current.progress === progress &&
        current.thumbSize === thumbSize &&
        current.hasOverflow === hasOverflow
      ) {
        return current;
      }

      return {
        canScrollUp: viewport.scrollTop > 4,
        canScrollDown: viewport.scrollTop < maxScroll - 4,
        progress,
        thumbSize,
        hasOverflow,
      };
    });
  }, []);

  const scrollSidebar = useCallback((direction: "up" | "down") => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const step = Math.max(220, viewport.clientHeight * 0.7);
    viewport.scrollBy({
      top: direction === "down" ? step : -step,
      behavior: "smooth",
    });
  }, []);

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

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => syncScrollState();
    handleScroll();

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => handleScroll())
        : null;

    resizeObserver?.observe(viewport);
    if (scrollContentRef.current) {
      resizeObserver?.observe(scrollContentRef.current);
    }

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver?.disconnect();
    };
  }, [pathname, syncScrollState]);

  const thumbTravel = Math.max(0, 100 - scrollState.thumbSize);
  const thumbOffset = scrollState.progress * thumbTravel;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--pmu-sidebar-width)] p-4 lg:flex">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-bg)_90%,transparent)] shadow-[var(--pmu-shadow)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--pmu-primary)_14%,transparent),transparent_34%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--pmu-accent-blue)_8%,transparent),transparent_28%)]" />

        <div className="relative flex h-full flex-col p-3.5">
          <div className="rounded-[1.55rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-3.5 shadow-[var(--pmu-shadow-sm)]">
            <div className="flex items-start justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-soft)] text-sm font-black text-[var(--pmu-primary)]">
                  PG
                </div>
                <div className="min-w-0">
                  <p className="app-brand-wordmark truncate text-[1.12rem] font-black text-[var(--pmu-text)]">
                    PMU Gagnant
                  </p>
                  <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--pmu-text-muted)]">
                    Control room V6
                  </p>
                </div>
              </Link>

              <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_88%,transparent)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--pmu-text-soft)]">
                {activeSection}
              </span>
            </div>

            <p className="mt-3 text-[13px] leading-5 text-[var(--pmu-text-soft)]">
              Trouver la bonne course, lire le signal principal et ouvrir le
              ticket utile sans perdre le fil.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_86%,transparent)] px-3 py-1.5 text-[10px] font-bold text-[var(--pmu-text-soft)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isConnected ? "bg-emerald-400" : "bg-[var(--pmu-border-strong)]"
                  }`}
                />
                {isConnected ? "Session active" : "Session locale"}
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_86%,transparent)] px-3 py-1.5 text-[10px] font-bold text-[var(--pmu-text-soft)]">
                Desktop nav
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/premium" className="app-button-primary text-xs">
                Voir l&apos;offre
              </Link>
              <Link href="/bilan" className="app-button-secondary text-xs">
                Voir le bilan
              </Link>
            </div>
          </div>

          <div className="relative mt-3.5 min-h-0 flex-1">
            <div
              ref={scrollViewportRef}
              className="pmu-scrollbar-hidden h-full overflow-y-auto pr-7"
            >
              <div ref={scrollContentRef} className="space-y-3.5 pb-2">
                <section className="rounded-[1.4rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
                      Recherche
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
                      Direct
                    </span>
                  </div>
                  <SidebarSearch />
                </section>

                <Suspense
                  fallback={
                    <div className="rounded-[1.55rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3.5">
                      <div className="space-y-3 animate-pulse">
                        <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_16%,transparent)]" />
                        <div className="h-12 rounded-[1rem] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)]" />
                        <div className="h-24 rounded-[1.2rem] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)]" />
                      </div>
                    </div>
                  }
                >
                  <SidebarQuinteCard />
                </Suspense>

                <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
                      Navigation
                    </p>
                    {scrollState.hasOverflow ? (
                      <span className="rounded-full border border-[var(--pmu-border)] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                        Scroll
                      </span>
                    ) : null}
                  </div>

                  <nav className="space-y-1.5">
            {appNavigationItems.map((item) => {
              const active = isNavigationItemActive(pathname, item.href, item.external);
                      const Icon = item.Icon;

                      if (item.external) {
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={navItemClass(false)}
                          >
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] text-[var(--pmu-text-soft)]">
                              <Icon />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-black text-[var(--pmu-text)]">
                                {item.label}
                                {item.meta ? (
                                  <span className="rounded-full border border-[var(--pmu-border)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                                    {item.meta}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block line-clamp-2 text-[11px] leading-[1.1rem] text-[var(--pmu-text-muted)]">
                                {item.description}
                              </span>
                            </span>
                          </a>
                        );
                      }

                      return (
                        <div key={item.href} className="space-y-2">
                          <Link href={item.href} className={navItemClass(active)}>
                            <span
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                active
                                  ? "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]"
                                  : "bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] text-[var(--pmu-text-soft)]"
                              }`}
                            >
                              <Icon />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-black text-[var(--pmu-text)]">
                                {item.label}
                              </span>
                              <span className="mt-1 block line-clamp-2 text-[11px] leading-[1.1rem] text-[var(--pmu-text-muted)]">
                                {item.description}
                              </span>
                            </span>
                            <span
                              className={`mt-1 h-2 w-2 rounded-full ${
                                active
                                  ? "bg-[var(--pmu-primary)]"
                                  : "bg-[var(--pmu-border-strong)]"
                              }`}
                            />
                          </Link>

                          {item.href === "/" ? (
                            <Suspense
                              fallback={
                                <div className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] p-3">
                                  <div className="h-11 animate-pulse rounded-[1rem] bg-[color-mix(in_srgb,var(--pmu-surface-highlight)_75%,var(--pmu-surface))]" />
                                </div>
                              }
                            >
                              <div className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] p-2.5">
                                <SidebarProgramme />
                              </div>
                            </Suspense>
                          ) : null}
                        </div>
                      );
                    })}
                  </nav>
                </section>

                <section className="grid gap-2 rounded-[1.4rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
                        Session
                      </p>
                      <p
                        className="mt-2 truncate text-sm font-bold text-[var(--pmu-text)]"
                        title={connexionLabel}
                      >
                        {connexionLabel}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_88%,transparent)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                      Supabase
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-[var(--pmu-text-muted)]">
                    Connexion, compte premium et bankroll gardes dans le meme
                    rail de pilotage.
                  </p>
                  <ThemeToggle />
                </section>
              </div>
            </div>

            {scrollState.hasOverflow ? (
              <>
                <div
                  className={`pointer-events-none absolute left-0 right-10 top-0 h-14 rounded-t-[1.25rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-bg)_96%,transparent)_0%,transparent_100%)] transition-opacity duration-200 ${
                    scrollState.canScrollUp ? "opacity-100" : "opacity-0"
                  }`}
                />
                <div
                  className={`pointer-events-none absolute bottom-0 left-0 right-10 h-16 rounded-b-[1.25rem] bg-[linear-gradient(0deg,color-mix(in_srgb,var(--pmu-bg)_96%,transparent)_0%,transparent_100%)] transition-opacity duration-200 ${
                    scrollState.canScrollDown ? "opacity-100" : "opacity-0"
                  }`}
                />
                <div className="absolute inset-y-0 right-0 flex w-8 flex-col items-center justify-between py-1">
                  <button
                    type="button"
                    onClick={() => scrollSidebar("up")}
                    disabled={!scrollState.canScrollUp}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_90%,transparent)] text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)] transition hover:-translate-y-px hover:border-[var(--pmu-border-strong)] disabled:cursor-default disabled:opacity-35 disabled:hover:translate-y-0"
                    aria-label="Monter dans la barre laterale"
                  >
                    <ScrollArrow direction="up" />
                  </button>

                  <div className="my-3 flex flex-1 items-center">
                    <div className="relative h-full w-1 rounded-full bg-[color-mix(in_srgb,var(--pmu-border)_74%,transparent)]">
                      <span
                        className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,var(--pmu-primary)_0%,var(--pmu-accent-blue)_100%)] shadow-[var(--pmu-shadow-sm)]"
                        style={{
                          top: `${thumbOffset}%`,
                          height: `${scrollState.thumbSize}%`,
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollSidebar("down")}
                    disabled={!scrollState.canScrollDown}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_90%,transparent)] text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)] transition hover:translate-y-px hover:border-[var(--pmu-border-strong)] disabled:cursor-default disabled:opacity-35 disabled:hover:translate-y-0"
                    aria-label="Descendre dans la barre laterale"
                  >
                    <ScrollArrow direction="down" />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
