"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pmu-onboarding-done";

interface Step {
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: "🌅",
    title: "Le moteur lit toutes les courses chaque matin",
    body: "TurfEdge passe le programme au crible et garde les courses qui méritent vraiment ton attention.",
  },
  {
    emoji: "🎯",
    title: "Tu vois le score, le cheval retenu, et le signal",
    body: "Chaque fiche te donne une lecture simple : score, niveau de confiance, rôle du cheval et décision à prendre.",
  },
  {
    emoji: "🏁",
    title: "Tu cliques, tu joues, tu suis les résultats",
    body: "Ouvre la course, prépare ton ticket, puis retrouve les résultats et le suivi dans le même espace.",
  },
];

export function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(STORAGE_KEY);
      if (!done) {
        const timer = window.setTimeout(() => setVisible(true), 800);
        return () => window.clearTimeout(timer);
      }
    } catch {
      return undefined;
    }

    return undefined;
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage can be unavailable in private browsing.
    }
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    close();
  }, [close, step]);

  const prev = useCallback(() => {
    setStep((current) => Math.max(0, current - 1));
  }, []);

  if (!visible) {
    return null;
  }

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(24, 22, 15, 0.62)", backdropFilter: "blur(6px)" }}
    >
      <section className="app-card w-full max-w-lg overflow-hidden p-0" role="dialog" aria-modal="true">
        <div className="flex gap-1.5 px-6 pt-6">
          {STEPS.map((item, index) => (
            <div
              key={item.title}
              className="h-1 flex-1 rounded-full transition-colors duration-200"
              style={{
                background:
                  index <= step ? "var(--pmu-primary)" : "var(--pmu-surface-2)",
              }}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-5 text-center">
          <span className="text-5xl" aria-hidden>
            {current.emoji}
          </span>
          <p className="app-kicker mt-5">Première visite</p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-[var(--pmu-text)]">
            {current.title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
            {current.body}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--pmu-border)] px-6 py-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={prev}
              className="text-sm font-bold text-[var(--pmu-text-muted)] transition hover:text-[var(--pmu-text)]"
            >
              Retour
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

          <button type="button" onClick={next} className="app-button-primary px-6 py-3 text-sm">
            {step < STEPS.length - 1 ? "Suivant" : "C'est parti"}
          </button>
        </div>

        <p className="pb-4 text-center text-xs font-semibold text-[var(--pmu-text-muted)]">
          {step + 1} / {STEPS.length}
        </p>
      </section>
    </div>
  );
}
