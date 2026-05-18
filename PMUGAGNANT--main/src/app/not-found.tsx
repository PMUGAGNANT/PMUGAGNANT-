import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--pmu-bg)] px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--pmu-surface)] text-3xl">
        🏇
      </div>
      <div className="space-y-2">
        <p className="app-kicker">Erreur 404</p>
        <h1 className="text-2xl font-black text-[var(--pmu-text)]">Page introuvable</h1>
        <p className="text-sm text-[var(--pmu-text-soft)]">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="app-button-primary">
          Retour à l&apos;accueil
        </Link>
        <Link href="/dashboard" className="app-button-secondary">
          Voir le programme du jour
        </Link>
      </div>
    </div>
  );
}
