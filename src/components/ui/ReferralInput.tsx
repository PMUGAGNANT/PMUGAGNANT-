"use client";

import { useEffect, useState } from "react";
import { applyReferralCode } from "@/lib/referral-client";
import { normalizeReferralCode } from "@/lib/referral";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type ReferralInputProps = {
  defaultCode?: string;
};

export function ReferralInput({ defaultCode = "" }: ReferralInputProps) {
  const [code, setCode] = useState(() => normalizeReferralCode(defaultCode));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    setCode(normalizeReferralCode(defaultCode));
  }, [defaultCode]);

  async function handleApply() {
    setMessage("");

    if (!hasSupabaseConfig()) {
      setTone("error");
      setMessage("Connexion indisponible pour le moment.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setTone("info");
      setMessage("Creez ou connectez votre compte, puis le code sera applique.");
      return;
    }

    setLoading(true);

    try {
      const successMessage = await applyReferralCode(code, session.access_token);
      setTone("success");
      setMessage(`🎉 ${successMessage}`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 18,
        borderRadius: 20,
        border: "1px solid var(--pmu-border)",
        background: "var(--pmu-surface-2)",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pmu-primary)" }}>
        Code parrainage
      </div>
      <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: "var(--pmu-text)" }}>
        Vous avez un code parrainage ?
      </div>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: "20px", color: "var(--pmu-text-muted)" }}>
        Entrez-le ici pour activer 7 jours Premium offerts.
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "minmax(0,1fr) auto" }}>
        <input
          value={code}
          onChange={(event) => setCode(normalizeReferralCode(event.target.value))}
          placeholder="ABC12345"
          maxLength={8}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid var(--pmu-border-strong)",
            background: "var(--pmu-bg)",
            color: "var(--pmu-text)",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        />
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={loading || code.length < 4}
          className="app-button-primary"
          style={{ whiteSpace: "nowrap", opacity: loading || code.length < 4 ? 0.7 : 1 }}
        >
          {loading ? "Validation..." : "Valider mon code"}
        </button>
      </div>

      {defaultCode ? (
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--pmu-primary)" }}>
          Code detecte automatiquement depuis votre lien d'invitation.
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 700,
            color:
              tone === "success"
                ? "var(--pmu-primary)"
                : tone === "error"
                  ? "var(--pmu-red)"
                  : "var(--pmu-text-soft)",
            background:
              tone === "success"
                ? "var(--pmu-primary-fade)"
                : tone === "error"
                  ? "color-mix(in srgb, var(--pmu-red) 10%, transparent)"
                  : "color-mix(in srgb, var(--pmu-text) 8%, transparent)",
            border:
              tone === "success"
                ? "1px solid color-mix(in srgb, var(--pmu-primary) 28%, transparent)"
                : tone === "error"
                  ? "1px solid color-mix(in srgb, var(--pmu-red) 28%, transparent)"
                  : "1px solid var(--pmu-border)",
          }}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
