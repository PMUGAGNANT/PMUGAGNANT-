"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pmu-onboarding-done";

interface Step {
  label: string;
  title: string;
  body: string;
  target: string;
  tips: string[];
}

const STEPS: Step[] = [
  {
    label: "Etape 1",
    title: "TurfEdge lit le programme PMU",
    body: "Chaque course est transformee en decision simple : JOUER, SURVEILLER ou PASSER.",
    target: "Page Courses",
    tips: ["Ouvre d'abord les cartes vertes.", "Les courses rouges protegent ta bankroll."],
  },
  {
    label: "Etape 2",
    title: "Tu ouvres la fiche course",
    body: "La fiche detaillee affiche le cheval retenu, la cote, le score algo, la confiance et les partants.",
    target: "Fiche Course",
    tips: ["Regarde la mise conseillee.", "Lis les raisons avant de jouer."],
  },
  {
    label: "Etape 3",
    title: "Tu suis le ticket et le bilan",
    body: "Un clic sur Je joue ce ticket enregistre le pari. Le bilan suit ensuite mise, gain et ROI.",
    target: "Mes paris + Bilan",
    tips: ["Active les alertes T-30.", "Passe premium pour tout debloquer."],
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
      <section className="app-card w-full max-w-xl overflow-hidden p-0" role="dialog" aria-modal="true">
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

        <div className="px-6 pb-6 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="app-kicker">Comment ca marche en 3 etapes</p>
            <span className="rounded-full bg-[var(--pmu-primary-fade)] px-3 py-1 text-xs font-black text-[var(--pmu-primary)]">
              {current.label}
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-black leading-tight text-[var(--pmu-text)]">
            {current.title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
            {current.body}
          </p>

          <div className="mt-5 rounded-[8px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
              Section expliquee
            </p>
            <p className="mt-1 text-xl font-black text-[var(--pmu-text)]">{current.target}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {current.tips.map((tip) => (
                <p key={tip} className="rounded-[8px] bg-white px-3 py-2 text-sm font-semibold text-[var(--pmu-text-soft)]">
                  {tip}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--pmu-border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
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
            <span className="text-xs font-semibold text-[var(--pmu-text-muted)]">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/login" onClick={close} className="app-button-secondary justify-center px-5 py-3 text-sm">
              Creer un compte
            </Link>
            <button type="button" onClick={next} className="app-button-primary justify-center px-6 py-3 text-sm">
              {step < STEPS.length - 1 ? "Suivant" : "C'est parti"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
