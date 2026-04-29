"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";

type AccountState =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "connected";
      initials: string;
      isPro: boolean;
    };

type ProfileSubscription = {
  is_subscribed: boolean | null;
  subscription_status: string | null;
  premium_access_expires_at: string | null;
};

function getInitials(email: string | undefined) {
  if (!email) {
    return "JG";
  }

  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "JG";
}

function hasPremium(profile: ProfileSubscription | null) {
  if (!profile) {
    return false;
  }

  if (
    profile.is_subscribed ||
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing"
  ) {
    return true;
  }

  if (!profile.premium_access_expires_at) {
    return false;
  }

  const expiry = new Date(profile.premium_access_expires_at);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
}

export default function DashboardHeaderAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      if (!hasSupabaseConfig()) {
        setAccount({ status: "guest" });
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) {
          setAccount({ status: "guest" });
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_subscribed,subscription_status,premium_access_expires_at")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!cancelled) {
        setAccount({
          status: "connected",
          initials: getInitials(session.user.email),
          isPro: hasPremium(profile as ProfileSubscription | null),
        });
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  if (account.status === "loading") {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
        <span className="hidden aspect-square w-9 animate-pulse rounded-full bg-[#D4AF37]/25 sm:block" />
      </div>
    );
  }

  if (account.status === "guest") {
    return (
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/login?redirect=%2Fpremium"
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-300 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
        >
          S&apos;inscrire
        </Link>
        <Link
          href="/login?redirect=%2Fpremium"
          className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-black text-[#D4AF37]"
        >
          Passer PRO
        </Link>
      </div>
    );
  }

  async function signOut() {
    if (!hasSupabaseConfig()) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {!account.isPro ? (
        <Link
          href="/premium"
          className="hidden rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-black text-[#D4AF37] sm:inline-flex"
        >
          Passer PRO
        </Link>
      ) : null}
      <Link
        href={account.isPro ? "/mes-paris" : "/premium"}
        className="inline-flex items-center gap-2"
        aria-label={account.isPro ? "Espace PRO" : "Passer PRO"}
      >
        <span className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2 py-1 font-[var(--font-display)] text-sm font-black text-[#D4AF37]">
          {account.isPro ? "PRO" : "FREE"}
        </span>
        <span className="grid aspect-square w-9 place-items-center rounded-full bg-[#D4AF37] font-[var(--font-display)] font-black text-[#0A0E1A]">
          {account.initials}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
        className="hidden rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-300 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37] sm:inline-flex"
      >
        Deconnexion
      </button>
    </div>
  );
}
