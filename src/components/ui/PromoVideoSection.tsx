"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function PromoVideoSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);

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
        threshold: 0.35,
        rootMargin: "120px 0px",
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
      className="relative overflow-hidden rounded-[2rem] px-4 py-5 md:px-6 md:py-8"
      style={{
        background:
          "radial-gradient(circle at 78% 44%, color-mix(in srgb, var(--pmu-primary-soft) 85%, transparent), transparent 28%), radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--pmu-primary-fade) 85%, transparent), transparent 32%), transparent",
      }}
    >
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,420px)] lg:gap-10">
        <div className="max-w-2xl">
          <p className="app-kicker">DÉCOUVREZ L&apos;APPLICATION</p>
          <h2 className="mt-4 text-3xl font-black leading-[0.98] tracking-tight text-[var(--pmu-text)] md:text-5xl">
            L&apos;IA qui détecte les meilleures courses PMU
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
            Notre algorithme analyse des centaines de courses chaque jour. Vous ne voyez que les meilleures opportunités.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/login" className="app-button-primary">
              Essayer gratuitement →
            </Link>
          </div>

          <p className="mt-4 text-xs font-semibold tracking-[0.04em] text-[var(--pmu-text-muted)]">
            Pas de carte bancaire requise • 1 pronostic gratuit par jour
          </p>
        </div>

        <div className="mx-auto w-full max-w-[360px] lg:mx-0 lg:justify-self-end">
          <div
            className="app-card relative overflow-hidden rounded-[1.5rem] p-3 md:p-4"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--pmu-surface) 88%, transparent), color-mix(in srgb, var(--pmu-bg) 92%, transparent))",
              boxShadow:
                "var(--pmu-shadow), 0 0 0 1px color-mix(in srgb, var(--pmu-primary) 18%, transparent), var(--pmu-glow)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--pmu-primary-soft) 95%, transparent), transparent 32%), radial-gradient(circle at 50% 100%, color-mix(in srgb, var(--pmu-primary-fade) 90%, transparent), transparent 28%)",
              }}
            />

            <div className="relative overflow-hidden rounded-[1.35rem] border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] bg-black">
              <video
                ref={videoRef}
                className="h-auto w-full rounded-[1.35rem] object-cover"
                src={shouldLoad ? "/promo.mp4" : undefined}
                poster="/promo-poster.jpg"
                aria-label="Vidéo promotionnelle de l'application PMU Gagnant"
                autoPlay
                controls
                loop
                muted={muted}
                playsInline
                preload="none"
              />

              <button
                type="button"
                onClick={() => setMuted((current) => !current)}
                aria-label={muted ? "Activer le son de la vidéo promotionnelle" : "Couper le son de la vidéo promotionnelle"}
                aria-pressed={!muted}
                className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] px-3 py-2 text-xs font-bold text-[var(--pmu-text)]"
                style={{
                  background: "color-mix(in srgb, var(--pmu-bg) 78%, transparent)",
                  boxShadow: "0 10px 26px rgba(0, 0, 0, 0.35)",
                  backdropFilter: "blur(14px)",
                }}
              >
                <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
                <span>{muted ? "Son coupé" : "Son actif"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
