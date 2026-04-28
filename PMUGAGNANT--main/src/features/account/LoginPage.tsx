"use client";

import { Suspense, useMemo, useState } from "react";
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

const VALUE_POINTS = [
  {
    title: "Opportunites filtrees",
    text: "Tu ne vois pas un flot de courses. Tu accedes seulement aux spots que le moteur juge vraiment exploitables.",
  },
  {
    title: "Mises lisibles",
    text: "Le premium transforme l'analyse en ticket actionnable, avec une mise claire et un cadre bankroll simple.",
  },
  {
    title: "Suivi reel",
    text: "Ton espace perso garde le solde, les tickets, le bilan et l'etat de l'abonnement au meme endroit.",
  },
];

const TRUST_MARKERS = [
  "Pronostics complets",
  "Mes paris et bankroll",
  "Bilan du moteur",
  "Parrainage active",
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
    return "La cle publique Supabase de production est invalide. Remplace NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel par la vraie anon key de Supabase, puis redeploie.";
  }

  if (normalizedMessage.includes("fetch") || normalizedMessage.includes("failed to fetch")) {
    return "Impossible de joindre Supabase pour le moment. Verifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sur Vercel.";
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
    () => getSafeRedirectPath(searchParams.get("redirect"), "/"),
    [searchParams]
  );
  const premiumIntent = useMemo(
    () =>
      ["/mes-paris", "/premium", "/subscribe"].some((path) =>
        redirectTo.startsWith(path)
      ),
    [redirectTo]
  );
  const referralCode = useMemo(
    () => normalizeReferralCode(searchParams.get("ref")),
    [searchParams]
  );

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
        if (signUpError) {
          throw signUpError;
        }

        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
        if (signInError) {
          throw signInError;
        }

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
        if (signInError) {
          throw signInError;
        }
      }

      router.replace(redirectTo);
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

      if (oauthError) {
        throw oauthError;
      }
    } catch (authError: unknown) {
      const message =
        authError instanceof Error ? authError.message : "Connexion Google impossible";
      setError(getFriendlyAuthError(message));
      setOauthLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-[96rem] flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-3 md:mb-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] px-4 py-2 text-sm font-bold text-[var(--pmu-text-soft)] transition hover:border-[var(--pmu-border-strong)] hover:text-[var(--pmu-text)]"
          >
            <span aria-hidden>&larr;</span>
            Retour accueil
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-lg border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] px-4 py-2 text-sm font-black text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)] sm:inline-flex"
            >
              TurfEdge
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-6 xl:grid-cols-[1.08fr,0.92fr]">
          <section className="app-page-hero p-6 md:p-8">
            <div className="relative z-[1] flex h-full flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                  {premiumIntent ? "Acces premium" : "Compte perso"}
                </span>
                <span className="app-pill text-xs">
                  {isSignUp ? "Creation de compte" : "Connexion rapide"}
                </span>
                {referralCode ? <span className="app-pill text-xs">Code invite detecte</span> : null}
              </div>

              <div className="space-y-4">
                <p className="app-kicker">Point d&apos;entree</p>
                <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                  {premiumIntent
                    ? "Connecte-toi pour ouvrir le vrai niveau de lecture du moteur."
                    : "Ton espace perso pour suivre les tickets, le solde et la progression."}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                  {premiumIntent
                    ? "Le premium sert a filtrer le bruit, garder les spots propres et transformer l'analyse en ticket actionnable."
                    : "Le compte centralise la bankroll fictive, l'historique de paris, le bilan du moteur et les bonus de parrainage."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {VALUE_POINTS.map((item) => (
                  <article key={item.title} className="app-card-muted px-5 py-5">
                    <p className="app-kicker text-[10px]">Inclus</p>
                    <h2 className="mt-3 text-xl font-black leading-tight text-[var(--pmu-text)]">
                      {item.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                      {item.text}
                    </p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr,0.9fr]">
                <article className="app-card p-5 md:p-6">
                  <p className="app-kicker">Promesse produit</p>
                  <h2 className="mt-3 text-2xl font-black leading-[1.02] text-[var(--pmu-text)] md:text-3xl">
                    L&apos;objectif n&apos;est pas de jouer plus. L&apos;objectif est de mieux filtrer.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                    Tu recuperes un cadre simple: que jouer, quoi ignorer, comment miser
                    et comment suivre les resultats sans te disperser.
                  </p>
                </article>

                <article className="app-card p-5 md:p-6">
                  <p className="app-kicker">Ce que tu retrouves</p>
                  <div className="mt-4 grid gap-2">
                    {TRUST_MARKERS.map((item) => (
                      <div
                        key={item}
                        className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_90%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-soft)]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="app-card p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">
                  {premiumIntent ? "Acces securise" : "Espace personnel"}
                </p>
                <h2 className="mt-2 text-3xl font-black leading-[0.98] text-[var(--pmu-text)]">
                  {isSignUp ? "Creer un compte" : "Se connecter"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                  {isSignUp
                    ? "Ouvre ton compte pour activer l'espace personnel et debloquer les prochains ecrans."
                    : "Retrouve tes tickets, ton bilan, ta bankroll et l'acces a l'offre premium."}
                </p>
              </div>

              <div className="flex rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError("");
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    !isSignUp
                      ? "bg-[var(--pmu-primary)] text-[var(--pmu-on-primary)]"
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
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    isSignUp
                      ? "bg-[var(--pmu-primary)] text-[var(--pmu-on-primary)]"
                      : "text-[var(--pmu-text-soft)]"
                  }`}
                >
                  Inscription
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Acces",
                  value: premiumIntent ? "Premium" : "Compte",
                },
                {
                  label: "Redirection",
                  value: premiumIntent ? "Mes Paris" : "Accueil",
                },
                {
                  label: "Bonus",
                  value: referralCode ? "Code detecte" : "Optionnel",
                },
              ].map((item) => (
                <article key={item.label} className="app-stat-card px-4 py-4">
                  <p className="app-label">{item.label}</p>
                  <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            {!supabaseConfigured ? (
              <div className="mt-5 rounded-[1.2rem] border border-[color-mix(in_srgb,var(--pmu-orange)_32%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_10%,transparent)] px-4 py-4 text-sm leading-7 text-[var(--pmu-orange)]">
                Ajoute les variables Supabase dans Vercel pour activer la connexion.
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => {
                  void handleGoogleSignIn();
                }}
                disabled={oauthLoading || loading || !supabaseConfigured}
                className="flex w-full items-center justify-center gap-3 rounded-[1.2rem] border border-[var(--pmu-border-strong)] bg-white px-4 py-3 text-sm font-black text-[#0B1020] shadow-[var(--pmu-shadow-sm)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3F4F6] text-base">
                  G
                </span>
                {oauthLoading ? "Ouverture Google..." : "Continuer avec Google"}
              </button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                <span className="h-px flex-1 bg-[var(--pmu-border)]" />
                <span>ou avec email</span>
                <span className="h-px flex-1 bg-[var(--pmu-border)]" />
              </div>
            </div>

            <form onSubmit={handleSubmit} aria-busy={loading} className="mt-6 space-y-5">
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
                  className="rounded-[1.15rem] border border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_10%,transparent)] px-4 py-4 text-sm font-semibold leading-7 text-[var(--pmu-red)]"
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
                    : premiumIntent
                      ? "Continuer vers le premium"
                      : "Se connecter"}
              </button>
            </form>

            {referralCode ? <ReferralInput defaultCode={referralCode} /> : null}

            <div className="mt-6 rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] p-5">
              <p className="app-kicker">
                {isSignUp ? "Activation" : "Acces"}
              </p>
              <h3 className="mt-3 text-2xl font-black leading-[1.02] text-[var(--pmu-text)]">
                {isSignUp
                  ? "Une bankroll fictive de depart pour tester le moteur."
                  : "Connexion rapide puis ouverture de ton espace personnel."}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                {isSignUp
                  ? "Tu peux suivre les tickets, observer le moteur et utiliser le code parrainage sans risque reel."
                  : premiumIntent
                    ? "Une fois connecte, tu pourras activer ou gerer l'abonnement directement dans Mes Paris."
                    : "Tu recuperes ton historique, ton solde, le suivi de performance et les bonus disponibles."}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--pmu-text-soft)]">
              <span>
                {isSignUp ? "Deja un compte ?" : "Pas encore de compte ?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp((value) => !value);
                  setError("");
                }}
                className="font-black text-[var(--pmu-primary)]"
              >
                {isSignUp ? "Se connecter" : "Creer un compte"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[var(--pmu-bg)]" />}
    >
      <LoginPageContent />
    </Suspense>
  );
}
