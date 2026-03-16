"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

const GREEN = "#00843D";
const DARK = "#1A1A1A";

export default function LoginPage() {
  const router = useRouter();
  const supabaseConfigured = hasSupabaseConfig();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        // Auto sign-in after signup (no email verification)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      // Redirect to previous page or home
      const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/";
      router.push(redirectTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      if (message.includes("Invalid login")) {
        setError("Email ou mot de passe incorrect");
      } else if (message.includes("already registered")) {
        setError("Cet email est déjà utilisé. Connectez-vous.");
        setIsSignUp(false);
      } else if (message.includes("Password should be")) {
        setError("Le mot de passe doit contenir au moins 6 caractères");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F5F5F5",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: DARK,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
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
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ color: GREEN, fontWeight: 700, fontSize: 22 }}>PMU AI</div>
      </div>

      {/* Form */}
      <div style={{ padding: "40px 24px" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#127943;</div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: DARK,
              marginBottom: 8,
            }}
          >
            {isSignUp ? "Créer un compte" : "Se connecter"}
          </h1>
          <p style={{ fontSize: 14, color: "#888" }}>
            {isSignUp
              ? "Inscrivez-vous pour placer des paris fictifs"
              : "Connectez-vous pour accéder à vos paris"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!supabaseConfigured && (
            <div
              style={{
                background: "#FFF3CD",
                color: "#856404",
                padding: "12px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 16,
              }}
            >
              Ajoutez vos variables Supabase dans Vercel pour activer la connexion.
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#555",
                marginBottom: 6,
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
                padding: "14px 16px",
                borderRadius: 12,
                border: "2px solid #E0E0E0",
                fontSize: 16,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = GREEN)}
              onBlur={(e) => (e.target.style.borderColor = "#E0E0E0")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#555",
                marginBottom: 6,
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
              placeholder="6 caractères minimum"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "2px solid #E0E0E0",
                fontSize: 16,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = GREEN)}
              onBlur={(e) => (e.target.style.borderColor = "#E0E0E0")}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#FFEBEE",
                color: "#C62828",
                padding: "12px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !supabaseConfigured}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: "none",
              background: loading || !supabaseConfigured ? "#999" : GREEN,
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: loading || !supabaseConfigured ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading
              ? "Chargement..."
              : isSignUp
              ? "Créer mon compte"
              : "Se connecter"}
          </button>
        </form>

        {/* Toggle */}
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 14,
            color: "#888",
          }}
        >
          {isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <span
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            style={{
              color: GREEN,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isSignUp ? "Se connecter" : "Créer un compte"}
          </span>
        </div>

        {/* Info solde */}
        {isSignUp && (
          <div
            style={{
              marginTop: 24,
              background: "#E8F5E9",
              borderRadius: 12,
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>&#128176;</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: GREEN }}>
              1 000€ offerts
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Solde fictif pour commencer à parier (argent fictif)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
