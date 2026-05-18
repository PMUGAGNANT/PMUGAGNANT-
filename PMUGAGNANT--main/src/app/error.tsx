"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--pmu-bg)] px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--pmu-surface)] text-3xl">
        ⚠️
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-[var(--pmu-text)]">Une erreur est survenue</h1>
        <p className="text-sm text-[var(--pmu-text-soft)]">
          Le service est momentanément indisponible. Réessaie dans quelques instants.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--pmu-text-muted)]">Code : {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="app-button-primary"
        >
          Réessayer
        </button>
        <a href="/" className="app-button-secondary">
          Retour à l&apos;accueil
        </a>
      </div>
    </div>
  );
}
