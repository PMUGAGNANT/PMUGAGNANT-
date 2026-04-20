"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    title: "Ouvre une course",
    body: "Le dashboard classe les courses du jour et te montre celles qui méritent ton attention.",
    target: "Dashboard",
    tips: ["Repère le badge Analyse prête.", "Ouvre d'abord le Quinté ou le meilleur score."],
  },
  {
    label: "Etape 2",
    title: "Vois le verdict",
    body: "La fiche affiche immédiatement JOUER, SURVEILLER ou PASSER avec le cheval, la cote et la mise.",
    target: "Fiche Course",
    tips: ["Lis le bandeau Verdict IA.", "La mise suit Kelly 25% sur 100€."],
  },
  {
    label: "Etape 3",
    title: "Joue ou passe",
    body: "Tu restes discipliné: tu joues seulement les edges positifs et tu suis tout dans Performances.",
    target: "Performances",
    tips: ["Active l'alerte T-30.", "Passe PRO pour voir les sélections masquées."],
  },
];

export default function OnboardingModal() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const disabled = pathname === "/login" || pathname.startsWith("/admin");

  useEffect(() => {
    if (disabled) {
      return undefined;
    }

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
  }, [disabled]);

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

  if (disabled || !visible) {
    return null;
  }

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-[#0A0E1A]/75 backdrop-blur-md" />
      <section className="app-card w-full max-w-xl overflow-hidden p-0" role="dialog" aria-modal="true">
        <div className="flex gap-1.5 px-6 pt-6">
          {STEPS.map((item, index) => (
            <div
              key={item.title}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                index <= step ? "bg-[var(--pmu-primary)]" : "bg-[var(--pmu-surface-2)]"
              }`}
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
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="app-button-primary justify-center px-6 py-3 text-sm">
                Suivant
              </button>
            ) : (
              <Link
                href="/dashboard?openBest=1"
                onClick={close}
                className="app-button-primary justify-center px-6 py-3 text-sm"
              >
                J&apos;ai compris, montrez-moi une course
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
