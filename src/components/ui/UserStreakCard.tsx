"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import { getBadgeProgress, type UserStreakSnapshot } from "@/lib/user-streak";

type LoadState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error"; message: string }
  | { status: "ready"; data: UserStreakSnapshot };

function StreakSkeleton() {
  return (
    <section className="app-card p-5 md:p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-44 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
        <div className="h-10 w-36 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_18%,transparent)]" />
        <div className="h-3 w-56 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
        <div className="h-2.5 w-full rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_12%,transparent)]" />
      </div>
    </section>
  );
}

function getBadgeTone(label: string) {
  if (label === "LEGENDE") {
    return {
      background: "color-mix(in srgb, #ffd54a 18%, transparent)",
      color: "#ffd54a",
      border: "color-mix(in srgb, #ffd54a 36%, transparent)",
    };
  }

  if (label === "EXPERT") {
    return {
      background: "color-mix(in srgb, #65d1ff 16%, transparent)",
      color: "#65d1ff",
      border: "color-mix(in srgb, #65d1ff 32%, transparent)",
    };
  }

  if (label === "CONFIRME") {
    return {
      background: "color-mix(in srgb, var(--pmu-primary) 16%, transparent)",
      color: "var(--pmu-primary)",
      border: "color-mix(in srgb, var(--pmu-primary) 30%, transparent)",
    };
  }

  if (label === "REGULIER") {
    return {
      background: "color-mix(in srgb, var(--pmu-orange) 14%, transparent)",
      color: "var(--pmu-orange)",
      border: "color-mix(in srgb, var(--pmu-orange) 28%, transparent)",
    };
  }

  return {
    background: "color-mix(in srgb, var(--pmu-text) 10%, transparent)",
    color: "var(--pmu-text)",
    border: "color-mix(in srgb, var(--pmu-text) 18%, transparent)",
  };
}

export function UserStreakCard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasSupabaseConfig()) {
        if (!cancelled) {
          setState({ status: "guest" });
        }
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

        const response = await fetch("/api/user-streak", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setState({ status: "guest" });
          return;
        }

        const payload = (await response.json()) as Partial<UserStreakSnapshot> & {
          success?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Impossible de charger votre serie.");
        }

        setState({
          status: "ready",
          data: {
            current_streak: payload.current_streak ?? 0,
            best_streak: payload.best_streak ?? 0,
            total_followed: payload.total_followed ?? 0,
            total_won: payload.total_won ?? 0,
            win_rate: payload.win_rate ?? 0,
            badge: payload.badge ?? "DEBUTANT",
            badge_emoji: payload.badge_emoji ?? "🌱",
            next_badge: payload.next_badge ?? null,
            next_badge_threshold: payload.next_badge_threshold ?? null,
          },
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Impossible de charger votre serie.",
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <StreakSkeleton />;
  }

  if (state.status === "guest") {
    return (
      <section className="app-card p-5 md:p-6">
        <p className="app-kicker">Progression perso</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
          Connectez-vous pour suivre vos resultats
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          Votre espace personnel peut suivre votre serie, vos signaux suivis et votre progression de joueur.
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
        <p className="app-kicker">Progression perso</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[var(--pmu-text)]">
          Serie indisponible
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{state.message}</p>
      </section>
    );
  }

  const { data } = state;
  const badgeTone = getBadgeTone(data.badge);
  const progress = getBadgeProgress(data.total_won, data.next_badge_threshold);
  const winsRemaining = data.next_badge_threshold
    ? Math.max(data.next_badge_threshold - data.total_won, 0)
    : 0;
  const serieLabel =
    data.current_streak > 0
      ? `${data.current_streak}${data.current_streak >= 3 ? " 🔥" : ""}`
      : "0";
  const footerMessage =
    data.next_badge && data.next_badge_threshold
      ? `Encore ${winsRemaining} gagnants pour devenir ${data.next_badge} !`
      : "Vous avez atteint le plus haut badge disponible.";

  const infoLine =
    data.total_followed <= 0
      ? "Donnees en cours de collecte"
      : `${data.total_followed} signaux suivis • ${data.total_won} gagnants (${Math.round(data.win_rate)}%)`;

  return (
    <section className="app-card p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="app-kicker">Progression perso</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
            Votre serie : {serieLabel}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--pmu-text-soft)]">{infoLine}</p>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black"
          style={{
            background: badgeTone.background,
            color: badgeTone.color,
            borderColor: badgeTone.border,
          }}
        >
          <span aria-hidden>{data.badge_emoji}</span>
          <span>{data.badge}</span>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pmu-surface-2)_76%,transparent)]">
        <div
          className="h-3 rounded-full bg-[linear-gradient(90deg,var(--pmu-primary-bright),var(--pmu-primary))] transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-[var(--pmu-text-soft)]">{footerMessage}</p>
        <p className="font-mono font-black text-[var(--pmu-primary)]">
          Best streak: {data.best_streak}
        </p>
      </div>
    </section>
  );
}
