"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const PROMO_POINTS = [
  "Lecture claire des courses",
  "Signal premium en direct",
  "18 s de demonstration produit",
];

export function PromoVideoSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInViewport(visible);
        if (visible) {
          setShouldLoad(true);
        }
      },
      {
        root: null,
        threshold: 0.32,
        rootMargin: "140px 0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) {
      return;
    }

    if (isInViewport) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => undefined);
      }
      return;
    }

    video.pause();
  }, [isInViewport, shouldLoad]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--pmu-primary)_10%,transparent)] px-4 py-5 md:px-6 md:py-8 xl:px-8"
      style={{
        background:
          "radial-gradient(circle at 78% 20%, color-mix(in srgb, var(--pmu-primary-soft) 90%, transparent), transparent 24%), radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--pmu-primary-fade) 95%, transparent), transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--pmu-surface) 68%, transparent), color-mix(in srgb, var(--pmu-bg) 88%, transparent))",
        boxShadow:
          "var(--pmu-card-inset), var(--pmu-shadow-sm), 0 0 0 1px color-mix(in srgb, var(--pmu-primary) 8%, transparent), var(--pmu-glow-soft)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-10 right-[-8%] hidden w-[32rem] rounded-full blur-3xl lg:block"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--pmu-primary) 20%, transparent) 0%, transparent 68%)",
        }}
      />

      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,430px)] lg:gap-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary-soft)_55%,transparent)] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--pmu-primary)] shadow-[0_0_18px_var(--pmu-primary)]" />
            <span className="text-[0.7rem] font-black uppercase tracking-[0.22em] text-[var(--pmu-primary)]">
              D\u00c9COUVREZ L&apos;APPLICATION
            </span>
          </div>

          <h2 className="mt-5 max-w-3xl text-3xl font-black leading-[0.95] tracking-tight text-[var(--pmu-text)] md:text-5xl xl:text-[3.55rem]">
            L&apos;IA qui d\u00e9tecte les meilleures courses PMU
          </h2>

          <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
            Notre algorithme analyse des centaines de courses chaque jour. Vous ne voyez que les meilleures opportunit\u00e9s.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {PROMO_POINTS.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--pmu-border-strong)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_55%,transparent)] px-3 py-2 text-xs font-bold text-[var(--pmu-text-soft)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--pmu-primary)]" />
                <span>{item}</span>
              </span>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href="/login" className="app-button-primary">
              Essayer gratuitement →
            </Link>
            <div className="rounded-2xl border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_65%,transparent)] px-4 py-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--pmu-text-muted)]">
                Ce que vous voyez
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--pmu-text)]">
                Home, fiche course, lecture signal et navigation mobile
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold tracking-[0.04em] text-[var(--pmu-text-muted)]">
            Pas de carte bancaire requise • 1 pronostic gratuit par jour
          </p>
        </div>

        <div className="mx-auto w-full max-w-[360px] lg:mx-0 lg:justify-self-end">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-8 h-[82%] w-[82%] -translate-x-1/2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--pmu-primary) 28%, transparent) 0%, transparent 68%)",
              }}
            />

            <div
              className="relative overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] p-3 md:p-4"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--pmu-surface) 92%, transparent), color-mix(in srgb, var(--pmu-bg) 96%, transparent))",
                boxShadow:
                  "var(--pmu-shadow), 0 0 0 1px color-mix(in srgb, var(--pmu-primary) 15%, transparent), 0 0 70px color-mix(in srgb, var(--pmu-primary) 16%, transparent)",
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-0 h-28 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at center, color-mix(in srgb, var(--pmu-primary-soft) 95%, transparent) 0%, transparent 72%)",
                }}
              />

              <div className="relative overflow-hidden rounded-[1.55rem] border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] bg-black">
                {!isReady ? (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-10 animate-pulse"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.22)), radial-gradient(circle at 50% 14%, color-mix(in srgb, var(--pmu-primary-soft) 85%, transparent), transparent 30%)",
                    }}
                  />
                ) : null}

                <video
                  ref={videoRef}
                  className="relative z-0 h-auto w-full rounded-[1.55rem] object-cover"
                  src={shouldLoad ? "/promo.mp4" : undefined}
                  poster="/promo-poster.jpg"
                  aria-label="Vid\u00e9o promotionnelle de l'application PMU Gagnant"
                  autoPlay
                  controls
                  loop
                  muted={muted}
                  playsInline
                  preload="none"
                  onLoadedData={() => setIsReady(true)}
                />

                <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--pmu-bg)_78%,transparent)] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--pmu-primary)] shadow-[0_10px_26px_rgba(0,0,0,0.35)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--pmu-primary)] shadow-[0_0_14px_var(--pmu-primary)]" />
                  <span>Demo produit</span>
                </div>

                <button
                  type="button"
                  onClick={() => setMuted((current) => !current)}
                  aria-label={
                    muted
                      ? "Activer le son de la vid\u00e9o promotionnelle"
                      : "Couper le son de la vid\u00e9o promotionnelle"
                  }
                  aria-pressed={!muted}
                  className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] px-3 py-2 text-xs font-bold text-[var(--pmu-text)]"
                  style={{
                    background: "color-mix(in srgb, var(--pmu-bg) 78%, transparent)",
                    boxShadow: "0 10px 26px rgba(0, 0, 0, 0.35)",
                    backdropFilter: "blur(14px)",
                  }}
                >
                  <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
                  <span>{muted ? "Son coupe" : "Son actif"}</span>
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,transparent_0%,rgba(3,3,3,0.88)_100%)] px-4 pb-4 pt-14">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--pmu-primary)]">
                        PMU Gagnant en action
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--pmu-text)]">
                        Interface mobile, glow premium et lecture rapide du jour
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--pmu-bg)_72%,transparent)] px-3 py-2 text-right">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--pmu-text-muted)]">
                        Chargement
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--pmu-text)]">
                        {isReady ? "Pret" : "En attente"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_72%,transparent)] px-4 py-3">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--pmu-text-muted)]">
                    Format
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--pmu-text)]">Video portrait</p>
                </div>
                <div className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_72%,transparent)] px-4 py-3">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--pmu-text-muted)]">
                    Rendu
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--pmu-text)]">Glow vert naturel</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
