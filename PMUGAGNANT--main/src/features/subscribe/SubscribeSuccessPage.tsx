"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

interface StatusResponse {
  activated?: unknown;
  error?: unknown;
}

interface InviteResponse {
  inviteUrl?: unknown;
  error?: unknown;
}

type PageState = "loading" | "active" | "error";

const PERKS = [
  { icon: "🎯", label: "Cheval conseillé", desc: "Le bon numéro à jouer sur chaque course" },
  { icon: "💶", label: "Mise Kelly", desc: "La mise exacte pour protéger ta bankroll" },
  { icon: "🔔", label: "Alertes T-30", desc: "Notifications avant chaque départ fort" },
  { icon: "📈", label: "Bilan ROI complet", desc: "Toutes tes performances en un coup d'œil" },
];

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PageState>("loading");
  const [message, setMessage] = useState("Vérification du paiement Stripe...");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyPayment() {
      if (!hasSupabaseConfig()) {
        setState("error");
        setMessage(getSupabaseConfigError());
        return;
      }

      const sessionId = searchParams.get("session_id");
      if (!sessionId) {
        setState("error");
        setMessage("Session Stripe manquante.");
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push(`/login?redirect=${encodeURIComponent(`/subscribe/success?session_id=${sessionId}`)}`);
          return;
        }

        const statusResponse = await fetch(
          `/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const statusPayload = (await statusResponse.json()) as StatusResponse;

        if (!statusResponse.ok || statusPayload.activated !== true) {
          throw new Error(
            typeof statusPayload.error === "string" ? statusPayload.error : "Paiement non confirmé."
          );
        }

        const inviteResponse = await fetch("/api/telegram/private-invite", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const invitePayload = (await inviteResponse.json()) as InviteResponse;

        if (!cancelled) {
          setState("active");
          setMessage("Ton accès complet est actif.");
          if (inviteResponse.ok && typeof invitePayload.inviteUrl === "string") {
            setInviteUrl(invitePayload.inviteUrl);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Vérification du paiement impossible.");
        }
      }
    }

    void verifyPayment();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[58rem] flex-col justify-center px-4 py-12">

      {/* Status card */}
      <section className="app-page-hero overflow-hidden p-0">
        <div className="p-6 md:p-10">

          {state === "loading" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--pmu-border)] border-t-[var(--pmu-primary)]" />
              <p className="text-sm font-bold text-[var(--pmu-text-soft)]">{message}</p>
            </div>
          ) : state === "error" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="text-4xl">⚠️</span>
              <p className="app-kicker text-[var(--pmu-orange)]">Problème de vérification</p>
              <p className="text-sm text-[var(--pmu-text-soft)]">{message}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/dashboard" className="app-button-primary">Aller au dashboard</Link>
                <Link href="/premium" className="app-button-secondary">Retour Premium</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎉</span>
                <span className="turf-decision-badge" data-tone="success">Accès PRO activé</span>
              </div>
              <p className="app-kicker mt-4">Bienvenue dans le club PMU Gagnant PRO</p>
              <h1 className="mt-2 text-4xl font-black leading-tight text-[var(--pmu-text)] md:text-5xl">
                Tu es prêt à jouer juste.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--pmu-text-soft)]">
                Tous tes accès sont débloqués. Chaque matin, TurfEdge prépare tes sélections avec mise et gain potentiel.
              </p>

              {/* Perks grid */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PERKS.map((perk) => (
                  <div key={perk.label} className="flex items-start gap-3 rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                    <span className="text-xl">{perk.icon}</span>
                    <div>
                      <p className="text-sm font-black text-[var(--pmu-text)]">{perk.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--pmu-text-soft)]">{perk.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {inviteUrl ? (
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="app-button-primary min-h-12 w-full justify-center sm:w-auto"
                  >
                    📱 Rejoindre le Telegram privé
                  </a>
                ) : null}
                <Link href="/" className="app-button-primary min-h-12 w-full justify-center sm:w-auto">
                  Voir les courses du jour
                </Link>
                <Link href="/dashboard" className="app-button-secondary min-h-12 w-full justify-center sm:w-auto">
                  Ouvrir le dashboard
                </Link>
              </div>

              {state === "active" && !inviteUrl ? (
                <div className="mt-4 rounded-xl border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] px-4 py-3">
                  <p className="text-sm font-bold text-[var(--pmu-text)]">
                    💬 L&apos;invitation Telegram sera disponible dès la configuration du bot privé.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
