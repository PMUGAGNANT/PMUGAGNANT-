"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

const DISMISS_KEY = "pmu-push-dismissed-until";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64UrlToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function isDismissed() {
  try {
    const rawValue = window.localStorage.getItem(DISMISS_KEY);
    if (!rawValue) {
      return false;
    }

    const until = Number(rawValue);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
  } catch {
    // Ignore storage failures.
  }
}

export function PushNotificationPrompt() {
  const pathname = usePathname();
  const [state, setState] = useState<"hidden" | "idle" | "loading" | "success">("hidden");
  const [message, setMessage] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const disabled = pathname === "/login" || pathname.startsWith("/admin");

  const supported = useMemo(
    () =>
      Boolean(
        VAPID_PUBLIC_KEY &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          "serviceWorker" in navigator &&
          "PushManager" in window
      ),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener?.("change", syncPreference);

    return () => {
      mediaQuery.removeEventListener?.("change", syncPreference);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      if (disabled) {
        setState("hidden");
        return;
      }

      if (!VAPID_PUBLIC_KEY || !supported) {
        return;
      }

      if (Notification.permission === "denied") {
        setDismissed();
        return;
      }

      if (isDismissed()) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (cancelled) {
          return;
        }

        if (existingSubscription) {
          setState("hidden");
          return;
        }

        setState("idle");
      } catch {
        setState("idle");
      }
    }

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [disabled, supported]);

  async function handleEnable() {
    if (!VAPID_PUBLIC_KEY) {
      return;
    }

    setState("loading");
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setDismissed();
        setState("hidden");
        return;
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
        }));

      let authorization = "";
      if (hasSupabaseConfig()) {
        try {
          const supabase = getSupabaseBrowserClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          authorization = session?.access_token ? `Bearer ${session.access_token}` : "";
        } catch {
          authorization = "";
        }
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        throw new Error("Impossible d'activer les alertes.");
      }

      setMessage("✅ Alertes activées !");
      setState("success");
      window.setTimeout(() => setState("hidden"), 2400);
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "Impossible d'activer les alertes.");
    }
  }

  if (disabled || !VAPID_PUBLIC_KEY || !supported || state === "hidden") {
    return null;
  }

  return (
    <div
      className="fixed inset-x-4 bottom-24 z-[110] lg:left-auto lg:right-6 lg:w-[420px] lg:bottom-6"
      role="region"
      aria-label="Activer les alertes push"
    >
      <style>{`@keyframes pmuPushPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,255,136,0.0); } 50% { transform: scale(1.04); box-shadow: 0 0 0.85rem rgba(0,255,136,0.18); } }`}</style>
      <div
        className="app-card"
        style={{
          border: "1px solid color-mix(in srgb, var(--pmu-primary) 28%, transparent)",
          boxShadow: "var(--pmu-shadow), var(--pmu-glow)",
          padding: 18,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--pmu-primary-fade)",
              color: "var(--pmu-primary)",
              fontSize: 20,
              animation: prefersReducedMotion ? "none" : "pmuPushPulse 1.8s ease-in-out infinite",
            }}
          >
            🔔
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black text-[var(--pmu-text)]">
              Recevez les signaux en direct sur votre téléphone
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Sans installer d&apos;app — directement dans votre navigateur.
            </p>
          </div>
        </div>

        {message ? (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{
              background:
                state === "success"
                  ? "var(--pmu-primary-fade)"
                  : "color-mix(in srgb, var(--pmu-red) 10%, transparent)",
              color: state === "success" ? "var(--pmu-primary)" : "var(--pmu-red)",
              border:
                state === "success"
                  ? "1px solid color-mix(in srgb, var(--pmu-primary) 28%, transparent)"
                  : "1px solid color-mix(in srgb, var(--pmu-red) 28%, transparent)",
            }}
          >
            {message}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleEnable()}
            className="app-button-primary"
            disabled={state === "loading"}
            style={{ opacity: state === "loading" ? 0.72 : 1 }}
          >
            {state === "loading" ? "Activation..." : "Activer les alertes"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed();
              setState("hidden");
            }}
            className="app-button-secondary"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
