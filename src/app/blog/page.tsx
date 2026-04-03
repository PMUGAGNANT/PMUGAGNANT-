import Link from "next/link";
import type { Metadata } from "next";

import { blogPosts } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog turf & pronostics | PMU Gagnant",
  description:
    "Articles courts pour mieux lire un programme PMU, comprendre le Quinté et jouer avec méthode.",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00.000Z"));
}

export default function BlogIndexPage() {
  const sorted = [...blogPosts].sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-6">
      <header>
        <p className="app-kicker">Blog</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-text)] md:text-4xl">
          Méthode, lecture de course et discipline
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
          Articles courts et utiles pour comprendre le PMU, lire une course et jouer avec plus de cadre. Aucune
          promesse de gain, seulement de la pédagogie.
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {sorted.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="app-card block p-5 transition hover:border-[color-mix(in_srgb,var(--pmu-primary)_45%,transparent)] hover:shadow-[var(--pmu-glow)]"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--pmu-text-muted)]">
                {formatDate(post.dateIso)} · Lecture {post.readMinutes} min
              </p>
              <h2 className="mt-2 text-xl font-black text-[var(--pmu-text)]">{post.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{post.description}</p>
              <p className="mt-3 text-sm font-bold text-[var(--pmu-primary)]">Lire l’article</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
