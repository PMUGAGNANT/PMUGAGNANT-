import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jeu responsable | TurfEdge",
  description:
    "Règles de prudence, rappel 18+ et limites d'utilisation des pronostics TurfEdge.",
};

const RULES = [
  "Joue uniquement avec une somme que tu acceptes de perdre.",
  "Ne cherche jamais à te refaire après une perte.",
  "Fixe une limite de mise avant d'ouvrir le programme.",
  "Fais une pause dès que le jeu devient une source de pression.",
  "Ne confonds pas score de confiance et certitude de résultat.",
];

export default function ResponsibleGamingPage() {
  return (
    <div className="mx-auto flex w-full max-w-[58rem] flex-col gap-6 px-4 py-6 md:px-6">
      <section className="app-page-hero p-6 md:p-8">
        <p className="app-kicker">Jeu responsable</p>
        <h1 className="mt-3 text-4xl font-black leading-[0.98] text-[var(--pmu-text)] md:text-5xl">
          TurfEdge aide à décider. TurfEdge ne garantit jamais un gain.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
          Les courses hippiques restent incertaines. Le moteur filtre, classe et
          explique les signaux, mais chaque pari peut être perdant. L&apos;accès au
          service est réservé aux personnes majeures.
        </p>
      </section>

      <section className="app-card p-6 md:p-7">
        <p className="app-kicker">Cadre de jeu</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
          Les règles à garder visibles
        </h2>
        <div className="mt-5 grid gap-3">
          {RULES.map((rule) => (
            <div key={rule} className="app-card-muted px-4 py-4 text-sm font-semibold leading-6 text-[var(--pmu-text-soft)]">
              {rule}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="app-card p-6">
          <p className="app-kicker">18+</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            Mineurs interdits
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
            Si tu n&apos;es pas majeur, tu ne dois pas utiliser TurfEdge pour
            préparer ou suivre des paris hippiques.
          </p>
        </article>

        <article className="app-card p-6">
          <p className="app-kicker">Aide</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            Quand le jeu prend trop de place
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
            En cas de doute, coupe les notifications, bloque les dépôts sur les
            sites de jeu et consulte les ressources officielles d&apos;aide aux
            joueurs.
          </p>
        </article>
      </section>

      <section className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
        TurfEdge n&apos;est pas un opérateur de paris. Les mises conseillées sont des
        repères de bankroll, pas des ordres de jeu.
        <Link href="/conditions" className="ml-1 font-bold text-[var(--pmu-primary)]">
          Lire les conditions.
        </Link>
      </section>
    </div>
  );
}
