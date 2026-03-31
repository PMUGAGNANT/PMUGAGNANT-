"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

const GREEN = "#00FF88";
const DARK = "#FFFFFF";
const PAGE_BG = "#0A0A0A";
const CARD_DARK = "#111111";
const BORDER = "#1E1E1E";

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
        background:
          "radial-gradient(circle at top left, rgba(0,255,136,0.08), transparent 28%), radial-gradient(circle at top right, rgba(0,255,136,0.05), transparent 24%), linear-gradient(180deg, #0A0A0A 0%, #0d0d0d 100%)",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(10,10,10,0.92)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid #1E1E1E",
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
            background: "rgba(255,255,255,0.1)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ color: GREEN, fontWeight: 800, fontSize: 22 }}>PMU Gagnant</div>
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
            background:
              "radial-gradient(circle at top right, rgba(0,255,136,0.12), transparent 35%), linear-gradient(135deg, #111111, #0d0d0d)",
            color: "#fff",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 28px 58px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: GREEN, marginBottom: 10 }}>
            {premiumIntent ? "Acces premium" : "Compte PMU AI"}
          </div>
          <div style={{ fontSize: 34, lineHeight: "36px", fontWeight: 900, letterSpacing: "-1px", marginBottom: 12 }}>
            {premiumIntent
              ? "Connecte-toi pour debloquer les pronostics complets."
              : "Connecte-toi pour suivre tes paris et ton bilan reel."}
          </div>
          <div style={{ fontSize: 15, lineHeight: "24px", color: "rgba(255,255,255,0.76)", maxWidth: 640 }}>
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
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, lineHeight: "19px", color: "rgba(255,255,255,0.72)" }}>{text}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 18,
              borderRadius: 22,
              padding: 18,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: GREEN, marginBottom: 8 }}>
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
            background: CARD_DARK,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 22px 48px rgba(0,0,0,0.4)",
            padding: 26,
            overflow: "hidden",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ fontSize: 40, marginBottom: 10, fontWeight: 900, color: premiumIntent ? GREEN : DARK }}>
              {premiumIntent ? "PREMIUM" : "COMPTE"}
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: DARK,
                marginBottom: 8,
                letterSpacing: "-0.8px",
              }}
            >
              {isSignUp ? "Creer un compte" : "Se connecter"}
            </h1>
            <p style={{ fontSize: 14, color: "#888888", lineHeight: "21px" }}>
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
                background: "rgba(255,184,0,0.12)",
                color: "#FFB800",
                border: "1px solid rgba(255,184,0,0.35)",
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
                  color: "#888888",
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
                  border: "2px solid #333333",
                  background: "#161616",
                  color: "#FFFFFF",
                  fontSize: 16,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = GREEN)}
                onBlur={(e) => (e.target.style.borderColor = "#333333")}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#888888",
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
                  border: "2px solid #333333",
                  background: "#161616",
                  color: "#FFFFFF",
                  fontSize: 16,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = GREEN)}
                onBlur={(e) => (e.target.style.borderColor = "#333333")}
              />
            </div>

            {error ? (
              <div
                style={{
                  background: "rgba(255,68,68,0.12)",
                  color: "#FF4444",
                  border: "1px solid rgba(255,68,68,0.35)",
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
                background: loading || !supabaseConfigured ? "#444444" : GREEN,
                color: loading || !supabaseConfigured ? "#888888" : "#000000",
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

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#888888" }}>
            {isSignUp ? "Deja un compte ?" : "Pas encore de compte ?"}{" "}
            <span
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              style={{
                color: GREEN,
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
              border: `1px solid ${BORDER}`,
              background: premiumIntent ? "rgba(0,255,136,0.08)" : "#161616",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6, fontWeight: 900, color: premiumIntent ? GREEN : DARK }}>
              {isSignUp ? "BANKROLL" : "ACCES"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: premiumIntent ? GREEN : DARK }}>
              {isSignUp ? "1 000 EUR offerts en bankroll fictive" : "Connexion rapide, puis acces a ton espace perso"}
            </div>
            <div style={{ fontSize: 12, color: "#888888", marginTop: 4, lineHeight: "18px" }}>
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
    <Suspense fallback={<div style={{ minHeight: "100vh", background: PAGE_BG }} />}>
      <LoginPageContent />
    </Suspense>
  );
}
