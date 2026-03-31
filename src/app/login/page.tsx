"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function getFriendlyAuthError(message: string) {
  if (message.includes("Invalid login")) {
    return "Email ou mot de passe incorrect.";
  }

  if (message.includes("already registered")) {
    return "Cet email est deja utilise. Connecte-toi a la place.";
  }

  if (message.includes("Password should be")) {
    return "Le mot de passe doit contenir au moins 6 caracteres.";
  }

  if (message.includes("Invalid API key")) {
    return "La cle publique Supabase de production est invalide. Remplace NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel par la vraie anon key de Supabase puis redeploie.";
  }

  if (message.includes("fetch") || message.includes("Failed to fetch")) {
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
  const [error, setError] = useState("");

  const redirectTo = searchParams.get("redirect") || "/";
  const premiumIntent = useMemo(() => redirectTo.includes("mes-paris"), [redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }

      router.push(redirectTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";

      if (message.includes("already registered")) {
        setIsSignUp(false);
      }

      setError(getFriendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top left, var(--pmu-primary-fade), transparent 28%), radial-gradient(circle at top right, var(--pmu-primary-soft), transparent 26%), linear-gradient(180deg, var(--pmu-bg) 0%, var(--pmu-bg-mid) 100%)`,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "color-mix(in srgb, var(--pmu-bg) 92%, transparent)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid var(--pmu-border)",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{
            position: "absolute",
            left: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--pmu-text) 12%, transparent)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--pmu-text)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ color: "var(--pmu-primary)", fontWeight: 800, fontSize: 22 }}>PMU Gagnant</div>
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", maxWidth: 148 }}>
          <ThemeToggle compact className="!w-auto !px-3" />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          padding: "24px 0 96px",
          alignItems: "start",
        }}
      >
        <section
          style={{
            borderRadius: 32,
            padding: 28,
            background: `radial-gradient(circle at top right, var(--pmu-primary-soft), transparent 35%), linear-gradient(135deg, var(--pmu-surface), var(--pmu-bg-mid))`,
            color: "var(--pmu-text)",
            border: "1px solid var(--pmu-border)",
            boxShadow: "var(--pmu-shadow)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--pmu-primary)",
              marginBottom: 10,
            }}
          >
            {premiumIntent ? "Acces premium" : "Compte PMU AI"}
          </div>
          <div style={{ fontSize: 34, lineHeight: "36px", fontWeight: 900, letterSpacing: "-1px", marginBottom: 12 }}>
            {premiumIntent
              ? "Connecte-toi pour debloquer les pronostics complets."
              : "Connecte-toi pour suivre tes paris et ton bilan reel."}
          </div>
          <div style={{ fontSize: 15, lineHeight: "24px", color: "var(--pmu-text-soft)", maxWidth: 640, opacity: 0.92 }}>
            {premiumIntent
              ? "Le premium sert a filtrer les courses, ne garder que les spots utiles et afficher des tickets vraiment exploitables."
              : "Ton compte centralise la bankroll, les tickets, le suivi de performance et l'acces a l'offre premium."}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 20,
            }}
          >
            {[
              ["Value bets", "Seulement quand le moteur detecte un edge reel contre le marche."],
              ["Mises Kelly", "Mise conseillee claire, capee bankroll, directement exploitable."],
              ["Tickets optimises", "Simple, couple, trio et combinaisons seulement si elles sont justifiees."],
              ["Suivi reel", "Backtest 90 jours, ROI, historique et bilan concret de l'algo."],
            ].map(([title, text]) => (
              <div
                key={title}
                style={{
                  borderRadius: 22,
                  padding: 16,
                  background: "var(--pmu-surface-2)",
                  border: "1px solid var(--pmu-border)",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, lineHeight: "19px", color: "var(--pmu-text-muted)" }}>{text}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 18,
              borderRadius: 22,
              padding: 18,
              background: "var(--pmu-surface-2)",
              border: "1px solid var(--pmu-border)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--pmu-primary)",
                marginBottom: 8,
              }}
            >
              Promesse
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: "24px" }}>
              {
                "L'objectif n'est pas de te faire jouer plus. L'objectif est de t'aider a jouer moins, mais mieux."
              }
            </div>
          </div>
        </section>

        <section
          style={{
            borderRadius: 30,
            background: "var(--pmu-surface)",
            border: "1px solid var(--pmu-border)",
            boxShadow: "var(--pmu-shadow)",
            padding: 26,
            overflow: "hidden",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                fontSize: 40,
                marginBottom: 10,
                fontWeight: 900,
                color: premiumIntent ? "var(--pmu-primary)" : "var(--pmu-text)",
              }}
            >
              {premiumIntent ? "PREMIUM" : "COMPTE"}
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: "var(--pmu-text)",
                marginBottom: 8,
                letterSpacing: "-0.8px",
              }}
            >
              {isSignUp ? "Creer un compte" : "Se connecter"}
            </h1>
            <p style={{ fontSize: 14, color: "var(--pmu-text-muted)", lineHeight: "21px" }}>
              {isSignUp
                ? premiumIntent
                  ? "Creer ton compte pour activer l'espace premium et suivre tes tickets."
                  : "Creer ton compte pour acceder a ton espace bankroll et au suivi de l'algo."
                : premiumIntent
                  ? "Connecte-toi pour passer a l'offre premium et debloquer les pronostics complets."
                  : "Connecte-toi pour retrouver tes tickets, ton solde et ton historique."}
            </p>
          </div>

          {!supabaseConfigured ? (
            <div
              style={{
                background: "color-mix(in srgb, var(--pmu-orange) 14%, transparent)",
                color: "var(--pmu-orange)",
                border: "1px solid color-mix(in srgb, var(--pmu-orange) 35%, transparent)",
                padding: "12px 16px",
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 16,
              }}
            >
              Ajoute les variables Supabase dans Vercel pour activer la connexion.
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--pmu-text-muted)",
                  marginBottom: 8,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
                style={{
                  width: "100%",
                  padding: "15px 16px",
                  borderRadius: 14,
                  border: "2px solid var(--pmu-border-strong)",
                  background: "var(--pmu-surface-2)",
                  color: "var(--pmu-text)",
                  fontSize: 16,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--pmu-primary)")}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--pmu-border-strong)";
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--pmu-text-muted)",
                  marginBottom: 8,
                }}
              >
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6 caracteres minimum"
                style={{
                  width: "100%",
                  padding: "15px 16px",
                  borderRadius: 14,
                  border: "2px solid var(--pmu-border-strong)",
                  background: "var(--pmu-surface-2)",
                  color: "var(--pmu-text)",
                  fontSize: 16,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--pmu-primary)")}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--pmu-border-strong)";
                }}
              />
            </div>

            {error ? (
              <div
                style={{
                  background: "color-mix(in srgb, var(--pmu-red) 12%, transparent)",
                  color: "var(--pmu-red)",
                  border: "1px solid color-mix(in srgb, var(--pmu-red) 35%, transparent)",
                  padding: "12px 16px",
                  borderRadius: 14,
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                  lineHeight: "20px",
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 14,
                border: "none",
                background: loading || !supabaseConfigured ? "var(--pmu-border-strong)" : "var(--pmu-primary)",
                color: loading || !supabaseConfigured ? "var(--pmu-text-muted)" : "var(--pmu-on-primary)",
                fontSize: 16,
                fontWeight: 800,
                cursor: loading || !supabaseConfigured ? "not-allowed" : "pointer",
              }}
            >
              {loading
                ? "Chargement..."
                : isSignUp
                  ? "Creer mon compte"
                  : premiumIntent
                    ? "Continuer vers l'offre premium"
                    : "Se connecter"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--pmu-text-muted)" }}>
            {isSignUp ? "Deja un compte ?" : "Pas encore de compte ?"}{" "}
            <span
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              style={{
                color: "var(--pmu-primary)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isSignUp ? "Se connecter" : "Creer un compte"}
            </span>
          </div>

          <div
            style={{
              marginTop: 20,
              borderRadius: 18,
              border: "1px solid var(--pmu-border)",
              background: premiumIntent ? "var(--pmu-primary-fade)" : "var(--pmu-surface-2)",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 24,
                marginBottom: 6,
                fontWeight: 900,
                color: premiumIntent ? "var(--pmu-primary)" : "var(--pmu-text)",
              }}
            >
              {isSignUp ? "BANKROLL" : "ACCES"}
            </div>
            <div
              style={{ fontSize: 14, fontWeight: 800, color: premiumIntent ? "var(--pmu-primary)" : "var(--pmu-text)" }}
            >
              {isSignUp ? "1 000 EUR offerts en bankroll fictive" : "Connexion rapide, puis acces a ton espace perso"}
            </div>
            <div style={{ fontSize: 12, color: "var(--pmu-text-muted)", marginTop: 4, lineHeight: "18px" }}>
              {isSignUp
                ? "Tu peux tester l'outil et les tickets sans risquer d'argent reel."
                : premiumIntent
                  ? "Une fois connecte, tu pourras gerer l'abonnement directement depuis Mes Paris."
                  : "Retrouve ton historique, ton solde, tes tickets et ton bilan."}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--pmu-bg)" }} />}>
      <LoginPageContent />
    </Suspense>
  );
}
