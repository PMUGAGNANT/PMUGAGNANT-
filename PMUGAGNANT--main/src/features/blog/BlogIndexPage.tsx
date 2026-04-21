import Link from "next/link";
import type { Metadata } from "next";
import { blogPosts } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog turf et pronostics | TurfEdge",
  description:
    "Articles courts pour mieux lire un programme PMU, comprendre le Quinte et jouer avec methode.",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00.000Z`));
}

export default function BlogIndexPage() {
  const sorted = [...blogPosts].sort((left, right) =>
    left.dateIso < right.dateIso ? 1 : -1
  );

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.08fr,0.92fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                Blog
              </span>
              <span className="app-pill text-xs">Lecture utile</span>
              <span className="app-pill text-xs">Base turf</span>
            </div>

            <div>
              <p className="app-kicker">Pedagogie PMU</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                Methode, lecture de course et discipline.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                Des articles courts et utiles pour comprendre le PMU, lire une course
                et jouer avec plus de cadre. Aucune promesse de gain, seulement de la
                pedagogie claire.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Lecture du site</p>
              <p className="mt-3 text-xl font-black text-[var(--pmu-text)]">
                On explique le produit, le PMU et la logique du moteur sans jargon inutile.
              </p>
            </div>
            <div className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
              Chaque article sert a rendre l&apos;outil plus lisible: mieux comprendre la
              course, mieux choisir les tickets et rester plus discipline.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {sorted.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="app-card block p-5 md:p-6 transition hover:border-[color-mix(in_srgb,var(--pmu-primary)_45%,transparent)] hover:shadow-[var(--pmu-glow)]"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--pmu-text-muted)]">
              {formatDate(post.dateIso)} - Lecture {post.readMinutes} min
            </p>
            <h2 className="mt-3 text-2xl font-black leading-tight text-[var(--pmu-text)]">
              {post.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {post.description}
            </p>
            <p className="mt-4 text-sm font-black text-[var(--pmu-primary)]">
              Lire l&apos;article
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
