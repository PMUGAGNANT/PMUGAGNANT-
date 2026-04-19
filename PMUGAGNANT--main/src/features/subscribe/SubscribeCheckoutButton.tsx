"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

interface SubscribeCheckoutButtonProps {
  label?: string;
  className?: string;
}

interface CheckoutResponse {
  url?: unknown;
  error?: unknown;
}

export default function SubscribeCheckoutButton({
  label = "S'abonner 9.99 EUR/mois",
  className = "app-button-primary min-h-12 w-full justify-center text-base",
}: SubscribeCheckoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!hasSupabaseConfig()) {
      setError(getSupabaseConfigError());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/login?redirect=${encodeURIComponent("/subscribe")}`);
        return;
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "subscribe",
          successPath: "/subscribe/success?subscription=success",
          cancelPath: "/subscribe?subscription=cancel",
        }),
      });
      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Paiement indisponible."
        );
      }

      window.location.href = payload.url;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Paiement indisponible."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? "Ouverture de Stripe..." : label}
      </button>
      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
