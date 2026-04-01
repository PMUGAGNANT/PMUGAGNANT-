import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { blogPosts, getPostBySlug } from "@/lib/blog-posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Article introuvable" };
  return {
    title: `${post.title} | PMU Gagnant`,
    description: post.description,
    keywords: post.keywords,
  };
}

function renderBody(md: string) {
  const blocks = md.trim().split(/\n\n+/);
  return blocks.map((block, i) => {
    const line = block.trim();
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-8 text-xl font-black text-[var(--pmu-text)] first:mt-0">
          {line.replace(/^##\s+/, "")}
        </h2>
      );
    }
    return (
      <p key={i} className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)] first:mt-0 whitespace-pre-wrap">
        {line}
      </p>
    );
  });
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <Link href="/blog" className="text-sm font-bold text-[var(--pmu-primary)] hover:underline">
        ← Blog
      </Link>
      <header className="mt-6">
        <p className="app-kicker">{post.keywords.join(" · ")}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-text)] md:text-4xl">{post.title}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{post.description}</p>
      </header>
      <div className="mt-8 border-t border-[var(--pmu-border)] pt-8">{renderBody(post.body)}</div>
    </article>
  );
}
