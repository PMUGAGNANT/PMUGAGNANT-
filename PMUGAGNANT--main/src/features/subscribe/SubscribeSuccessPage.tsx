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

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PageState>("loading");
  const [message, setMessage] = useState("Verification du paiement Stripe...");
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
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push(
            `/login?redirect=${encodeURIComponent(
              `/subscribe/success?session_id=${sessionId}`
            )}`
          );
          return;
        }

        const statusResponse = await fetch(
          `/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        const statusPayload = (await statusResponse.json()) as StatusResponse;

        if (!statusResponse.ok || statusPayload.activated !== true) {
          throw new Error(
            typeof statusPayload.error === "string"
              ? statusPayload.error
              : "Paiement non confirme."
          );
        }

        const inviteResponse = await fetch("/api/telegram/private-invite", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const invitePayload = (await inviteResponse.json()) as InviteResponse;

        if (!cancelled) {
          setState("active");
          setMessage("Ton acces complet est actif.");
          if (inviteResponse.ok && typeof invitePayload.inviteUrl === "string") {
            setInviteUrl(invitePayload.inviteUrl);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Verification du paiement impossible."
          );
        }
      }
    }

    void verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[58rem] flex-col justify-center px-4 py-12">
      <section className="app-page-hero p-6 md:p-10">
        <p className="app-kicker">Abonnement TurfEdge</p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-[var(--pmu-text)] md:text-6xl">
          {state === "active" ? "Bienvenue dans le club PRO." : "Activation en cours."}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--pmu-text-soft)]">
          {message}
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {["Pronostics complets", "Mises conseillees", "Telegram prive"].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4 text-sm font-black text-[var(--pmu-text)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {inviteUrl ? (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="app-button-primary min-h-12 w-full justify-center sm:w-auto"
            >
              Rejoindre le Telegram prive
            </a>
          ) : null}
          <Link
            href="/dashboard"
            className="app-button-secondary min-h-12 w-full justify-center sm:w-auto"
          >
            Ouvrir le dashboard
          </Link>
        </div>

        {state === "active" && !inviteUrl ? (
          <p className="mt-4 rounded-lg border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] px-4 py-3 text-sm font-bold text-[var(--pmu-text)]">
            Acces PRO active. L&apos;invitation Telegram privee sera disponible des que la
            variable TELEGRAM_PRIVATE_INVITE_LINK ou TELEGRAM_PRIVATE_CHAT_ID est configuree.
          </p>
        ) : null}
      </section>
    </main>
  );
}
