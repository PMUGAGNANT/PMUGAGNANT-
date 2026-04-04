"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import { type ReferralSnapshot } from "@/lib/referral";

type ReferralCardState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReferralSnapshot };

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function ReferralCard() {
  const [state, setState] = useState<ReferralCardState>({ status: "loading" });
  const [copied, setCopied] = useState<"" | "code" | "link">("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasSupabaseConfig()) {
        setState({ status: "guest" });
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (!session) {
          setState({ status: "guest" });
          return;
        }

        const response = await fetch("/api/referral", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        if (response.status === 401) {
          setState({ status: "guest" });
          return;
        }

        const payload = (await response.json()) as Partial<ReferralSnapshot> & {
          success?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Impossible de charger le parrainage.");
        }

        setState({
          status: "ready",
          data: {
            referral_code: payload.referral_code ?? "",
            referral_count: payload.referral_count ?? 0,
            referral_premium_days: payload.referral_premium_days ?? 0,
            share_url: payload.share_url ?? "",
          },
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Impossible de charger le parrainage.",
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(""), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const shareLinks = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    const shareText = encodeURIComponent(
      `PMU Gagnant offre 7 jours Premium gratuits avec mon code ${state.data.referral_code}. ${state.data.share_url}`
    );

    return {
      whatsapp: `https://wa.me/?text=${shareText}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(state.data.share_url)}&text=${encodeURIComponent(
        `Rejoins PMU Gagnant avec mon code ${state.data.referral_code}`
      )}`,
    };
  }, [state]);

  if (state.status === "loading") {
    return (
      <section className="app-card p-5 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-52 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
          <div className="h-12 w-44 rounded-2xl bg-[color-mix(in_srgb,var(--pmu-text-muted)_16%,transparent)]" />
          <div className="h-10 w-full rounded-2xl bg-[color-mix(in_srgb,var(--pmu-text-muted)_12%,transparent)]" />
        </div>
      </section>
    );
  }

  if (state.status === "guest") {
    return (
      <section className="app-card p-5 md:p-6">
        <p className="app-kicker">Parrainage</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
          🎁 Invitez un ami, gagnez 7 jours Premium
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          Votre ami reçoit aussi 7 jours gratuits. Connectez-vous pour obtenir votre code de partage.
        </p>
        <Link href="/login" className="app-button-primary mt-5 inline-flex">
          Se connecter
        </Link>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="app-card p-5 md:p-6">
        <p className="app-kicker">Parrainage</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[var(--pmu-text)]">
          Parrainage indisponible
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{state.message}</p>
      </section>
    );
  }

  const { data } = state;

  return (
    <section className="app-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="app-kicker">Parrainage</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
            🎁 Invitez un ami, gagnez 7 jours Premium
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--pmu-text-soft)]">
            Votre ami reçoit aussi 7 jours gratuits.
          </p>
        </div>

        <div className="rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--pmu-text-soft)]">
          {data.referral_count} amis parrainés • {data.referral_premium_days} jours Premium gagnés
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[auto,1fr]">
        <div className="rounded-[24px] border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-fade)] px-5 py-4">
          <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-primary)]">
            Votre code
          </div>
          <div className="mt-3 font-mono text-3xl font-black tracking-[0.18em] text-[var(--pmu-text)]">
            {data.referral_code}
          </div>
          <button
            type="button"
            className="app-button-secondary mt-4"
            onClick={() => {
              void copyText(data.referral_code).then(() => setCopied("code"));
            }}
          >
            {copied === "code" ? "Copié !" : "Copier"}
          </button>
        </div>

        <div className="rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
          <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-text-muted)]">
            Lien de partage
          </div>
          <div className="mt-3 break-all rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-bg)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text)]">
            {data.share_url}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={shareLinks?.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="app-button-secondary"
            >
              WhatsApp
            </a>
            <a
              href={shareLinks?.telegram}
              target="_blank"
              rel="noreferrer"
              className="app-button-secondary"
            >
              Telegram
            </a>
            <button
              type="button"
              className="app-button-primary"
              onClick={() => {
                void copyText(data.share_url).then(() => setCopied("link"));
              }}
            >
              {copied === "link" ? "Lien copié !" : "Copier le lien"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
