"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReferralInput } from "@/components/ui/ReferralInput";
import { applyReferralCode } from "@/lib/referral-client";
import { normalizeReferralCode } from "@/lib/referral";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

const BENEFITS = [
  "Google en 1 clic",
  "Ticket prioritaire du jour",
  "Dashboard simplifie",
];

function getFriendlyAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login")) {
    return "Email ou mot de passe incorrect.";
  }

  if (normalizedMessage.includes("already registered")) {
    return "Cet email est deja utilise. Connecte-toi a la place.";
  }

  if (
    normalizedMessage.includes("password should be") ||
    normalizedMessage.includes("password should contain")
  ) {
    return "Le mot de passe doit contenir au moins 6 caracteres.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Compte cree. Confirme ton email, puis connecte-toi.";
  }

  if (normalizedMessage.includes("invalid api key")) {
    return "La cle publique Supabase de production est invalide. Remplace NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel, puis redeploie.";
  }

  if (normalizedMessage.includes("fetch") || normalizedMessage.includes("failed to fetch")) {
    return "Impossible de joindre Supabase. Verifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sur Vercel.";
  }

  return message;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabaseConfigured = hasSupabaseConfig();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = useMemo(
    () => getSafeRedirectPath(searchParams.get("redirect"), "/dashboard"),
    [searchParams]
  );
  const referralCode = useMemo(
    () => normalizeReferralCode(searchParams.get("ref")),
    [searchParams]
  );

  useEffect(() => {
    if (searchParams.get("mode") === "signup") {
      setIsSignUp(true);
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (signUpError) throw signUpError;

        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
        if (signInError) throw signInError;

        if (referralCode && signInData.session?.access_token) {
          try {
            await applyReferralCode(referralCode, signInData.session.access_token);
          } catch {
            // Le parrainage ne doit pas bloquer la creation du compte.
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (authError: unknown) {
      const message =
        authError instanceof Error ? authError.message : "Une erreur est survenue";

      if (message.toLowerCase().includes("already registered")) {
        setIsSignUp(false);
      }

      setError(getFriendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");

    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setOauthLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectUrl = new URL(redirectTo, window.location.origin).toString();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (oauthError) throw oauthError;
    } catch (authError: unknown) {
      const message =
        authError instanceof Error ? authError.message : "Connexion Google impossible";
      setError(getFriendlyAuthError(message));
      setOauthLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--pmu-bg)] text-[var(--pmu-text)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="PMU Gagnant">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--pmu-primary)] font-black text-black">
            PG
          </span>
          <span>
            <span className="block font-[var(--font-display)] text-2xl font-black leading-none">
              PMU<span className="text-[var(--pmu-primary)]">Gagnant</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
              Acces securise
            </span>
          </span>
        </Link>
        <Link href="/" className="app-button-secondary min-h-11">
          Retour
        </Link>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 pb-12 pt-6 lg:grid-cols-[0.95fr,1.05fr] lg:items-start">
        <aside className="app-page-hero p-6 md:p-8">
          <p className="app-kicker">Compte PMU Gagnant</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-black leading-[0.96] md:text-6xl">
            Ouvre ton cockpit en quelques secondes.
          </h1>
          <p className="mt-5 text-base leading-7 text-[var(--pmu-text-soft)]">
            Inscription simple, puis acces direct au ticket prioritaire du jour
            et aux courses rangees par fenetres.
          </p>
          <div className="mt-6 grid gap-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="app-card-muted flex items-center gap-3 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--pmu-primary)] text-sm font-black text-black">
                  OK
                </span>
                <span className="font-black text-[var(--pmu-text)]">{benefit}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="app-card p-6 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="app-kicker">{isSignUp ? "Inscription" : "Connexion"}</p>
              <h2 className="mt-2 text-3xl font-black leading-none">
                {isSignUp ? "Creer mon compte" : "Se connecter"}
              </h2>
            </div>
            <div className="flex rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError("");
                }}
                className={`rounded-md px-4 py-2 text-sm font-black transition ${
                  !isSignUp
                    ? "bg-[var(--pmu-primary)] text-black"
                    : "text-[var(--pmu-text-soft)]"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError("");
                }}
                className={`rounded-md px-4 py-2 text-sm font-black transition ${
                  isSignUp
                    ? "bg-[var(--pmu-primary)] text-black"
                    : "text-[var(--pmu-text-soft)]"
                }`}
              >
                Inscription
              </button>
            </div>
          </div>

          {!supabaseConfigured ? (
            <div className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--pmu-orange)_32%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_10%,transparent)] px-4 py-4 text-sm leading-7 text-[var(--pmu-orange)]">
              Ajoute les variables Supabase dans Vercel pour activer la connexion.
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void handleGoogleSignIn();
            }}
            disabled={oauthLoading || loading || !supabaseConfigured}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--pmu-border-strong)] bg-white px-4 py-4 text-base font-black text-[#0B1020] shadow-[var(--pmu-shadow-sm)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3F4F6] text-base">
              G
            </span>
            {oauthLoading ? "Ouverture Google..." : "Continuer avec Google"}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
            <span className="h-px flex-1 bg-[var(--pmu-border)]" />
            <span>ou email</span>
            <span className="h-px flex-1 bg-[var(--pmu-border)]" />
          </div>

          <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--pmu-text-soft)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="votre@email.com"
                className="app-input"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--pmu-text-soft)]">
                Mot de passe
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                placeholder="6 caracteres minimum"
                className="app-input"
              />
            </label>

            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_10%,transparent)] px-4 py-4 text-sm font-semibold leading-7 text-[var(--pmu-red)]"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Chargement..."
                : isSignUp
                  ? "Creer mon compte"
                  : "Entrer dans le dashboard"}
            </button>
          </form>

          {referralCode ? <ReferralInput defaultCode={referralCode} /> : null}

          <p className="mt-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
            {isSignUp ? "Deja inscrit ?" : "Pas encore inscrit ?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp((value) => !value);
                setError("");
              }}
              className="font-black text-[var(--pmu-primary)]"
            >
              {isSignUp ? "Se connecter" : "Creer un compte gratuit"}
            </button>
          </p>
        </section>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--pmu-bg)]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
