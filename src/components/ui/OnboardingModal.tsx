"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pmu-onboarding-done";

interface Step {
  emoji: string;
  title: string;
  body: string;
  highlight?: string;
}

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "Bienvenue sur PMU Gagnant",
    body: "Notre intelligence artificielle analyse des centaines de courses PMU chaque jour. Elle ne garde que les 3 à 5 meilleures opportunités pour vous.",
    highlight: "Vous n'avez rien à calculer. On fait le travail pour vous.",
  },
  {
    emoji: "🚦",
    title: "Comprendre nos signaux",
    body: "Chaque course est évaluée avec un code couleur simple :\n\n🟢 Coup sûr — Notre meilleure opportunité\n🟡 Bonne opportunité — Intéressant, à jouer avec prudence\n🔵 À surveiller — On attend le signal final\n⚪ Course à éviter — Trop de risque",
  },
  {
    emoji: "🐴",
    title: "Placé ou Gagnant ?",
    body: "Nous recommandons principalement des paris « Placé » : votre cheval doit finir dans les 3 premiers. C'est moins risqué.\n\nLe pari « Gagnant » est réservé aux signaux les plus forts : votre cheval doit finir 1er.",
    highlight: "Conseil : commencez toujours par le Placé si vous débutez.",
  },
  {
    emoji: "💰",
    title: "La règle d'or",
    body: "Ne misez jamais plus que ce que vous êtes prêt à perdre. Notre moteur est performant mais aucun système n'est infaillible.\n\nConseil : fixez-vous un budget mensuel et ne le dépassez jamais.",
    highlight: "Les performances passées ne garantissent pas les résultats futurs.",
  },
];

export function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(STORAGE_KEY);
      if (!done) {
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      /* SSR / localStorage indisponible */
    }
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* silent */
    }
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      close();
    }
  }, [step, close]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--pmu-border-strong)]"
        style={{
          background:
            "linear-gradient(168deg, var(--pmu-surface-highlight) 0%, var(--pmu-surface) 100%)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{
                background:
                  i <= step
                    ? "var(--pmu-primary)"
                    : "var(--pmu-surface-highlight)",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-5">
          <div className="text-center">
            <span className="text-5xl">{current.emoji}</span>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
              {current.title}
            </h2>
          </div>

          <div className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--pmu-text-soft)]">
            {current.body.split("\n").map((line, i) =>
              line.trim() === "" ? (
                <br key={i} />
              ) : (
                <p key={i}>{line}</p>
              )
            )}
          </div>

          {current.highlight && (
            <div
              className="mt-4 rounded-xl px-4 py-3 text-sm font-bold"
              style={{
                background: "var(--pmu-primary-fade)",
                color: "var(--pmu-primary)",
                border: "1px solid var(--pmu-primary-soft)",
              }}
            >
              {current.highlight}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-[var(--pmu-border)] px-6 py-4">
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={prev}
                className="text-sm font-bold text-[var(--pmu-text-muted)] transition hover:text-[var(--pmu-text)]"
              >
                ← Retour
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="text-sm font-bold text-[var(--pmu-text-muted)] transition hover:text-[var(--pmu-text)]"
              >
                Passer
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={next}
            className="app-button-primary px-6 py-3 text-sm"
          >
            {step < STEPS.length - 1 ? "Suivant →" : "C'est parti ! 🚀"}
          </button>
        </div>

        {/* Step indicator */}
        <p className="pb-4 text-center text-xs font-semibold text-[var(--pmu-text-muted)]">
          {step + 1} / {STEPS.length}
        </p>
      </div>
    </div>
  );
}
