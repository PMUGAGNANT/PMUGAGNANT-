"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

const GREEN = "#00843D";
const DARK = "#1A1A1A";

interface Bet {
  id: string;
  date_str: string;
  reunion: number;
  course: number;
  hippodrome: string;
  heure_depart: string;
  cheval_num: number;
  cheval_nom: string;
  type_pari: string;
  mise: number;
  cote: number;
  statut: string;
  gain: number | null;
  created_at: string;
}

function formatEuros(value: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} EUR`;
}

export default function MesParisPage() {
  const router = useRouter();
  const supabaseConfigured = hasSupabaseConfig();
  const [bets, setBets] = useState<Bet[]>([]);
  const [solde, setSolde] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [error, setError] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("FREE");

  const fetchBets = useCallback(async () => {
    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login?redirect=/mes-paris");
      return;
    }

    setUser({ email: session.user.email });

    try {
      const res = await fetch("/api/bets", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBets(data.bets);
        setSolde(data.solde);
        setIsSubscribed(Boolean(data.isSubscribed));
        setSubscriptionStatus(data.subscriptionStatus ?? "FREE");
      }
    } catch {
      setError("Impossible de charger l'espace paris.");
    } finally {
      setLoading(false);
    }
  }, [router, supabaseConfigured]);

  useEffect(() => {
    void fetchBets();
  }, [fetchBets]);

  async function handleSettle() {
    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setSettling(true);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSettling(false);
      return;
    }

    try {
      await fetch("/api/bets/settle", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await fetchBets();
    } catch {
      setError("La verification des resultats a echoue.");
    } finally {
      setSettling(false);
    }
  }

  async function handleLogout() {
    if (!supabaseConfigured) {
      router.push("/");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleBilling(action: "checkout" | "portal") {
    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setBillingLoading(true);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login?redirect=/mes-paris");
      return;
    }

    try {
      const response = await fetch(
        action === "checkout" ? "/api/stripe/checkout" : "/api/stripe/portal",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Billing indisponible");
      }
      window.location.href = payload.url;
    } catch (billingError) {
      setError(billingError instanceof Error ? billingError.message : "Billing indisponible");
    } finally {
      setBillingLoading(false);
    }
  }

  const pendingCount = bets.filter((b) => b.statut === "EN_ATTENTE").length;
  const wonCount = bets.filter((b) => b.statut === "GAGNE").length;
  const placedCount = bets.filter((b) => b.statut === "PLACE").length;
  const totalGain = bets.filter((b) => b.gain !== null).reduce((sum, b) => sum + (b.gain || 0), 0);

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    EN_ATTENTE: { bg: "#FFF8E1", color: "#F57F17", label: "En attente" },
    GAGNE: { bg: "#E8F5E9", color: GREEN, label: "Gagne" },
    PLACE: { bg: "#E3F2FD", color: "#1565C0", label: "Place" },
    PERDU: { bg: "#FFEBEE", color: "#C62828", label: "Perdu" },
  };

  return (
    <div
      style={{
        width: "min(1180px, calc(100% - 24px))",
        margin: "0 auto",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,132,61,0.12), transparent 24%), linear-gradient(180deg, #F6F8F9 0%, #EDF2F3 100%)",
        paddingBottom: 96,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(18, 22, 26, 0.88)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: 68,
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
        <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 20, letterSpacing: "-0.3px" }}>
          Mes Paris
        </div>
        <div
          onClick={handleLogout}
          style={{
            position: "absolute",
            right: 16,
            color: "rgba(255,255,255,0.68)",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Deconnexion
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Chargement...</div>
      ) : error ? (
        <div
          style={{
            margin: "18px 0",
            background: "#FFF3CD",
            color: "#856404",
            padding: 16,
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : (
        <>
          <section
            style={{
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 30%), linear-gradient(135deg, #0a8f4d, #066737)",
              borderRadius: 30,
              margin: "18px 0 16px",
              padding: 28,
              color: "#fff",
              boxShadow: "0 24px 48px rgba(0,132,61,0.24)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "grid",
              gap: 18,
              gridTemplateColumns: "minmax(0,1.4fr) minmax(240px,0.9fr)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, opacity: 0.84, marginBottom: 6 }}>{user?.email}</div>
              <div style={{ fontSize: 46, fontWeight: 900, marginBottom: 8, letterSpacing: "-1.2px" }}>
                {formatEuros(solde)}
              </div>
              <div style={{ fontSize: 14, opacity: 0.92, fontWeight: 600 }}>
                {bets.length} paris · {wonCount} gagnes · {placedCount} places
              </div>
            </div>
            <div
              style={{
                borderRadius: 24,
                background: "rgba(0,0,0,0.16)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: 18,
                display: "grid",
                gap: 12,
                alignContent: "start",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  opacity: 0.72,
                }}
              >
                Abonnement
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  width: "fit-content",
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.16)",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {isSubscribed ? `Abonnement ${subscriptionStatus}` : "Compte gratuit"}
              </div>
              <button
                onClick={() => handleBilling(isSubscribed ? "portal" : "checkout")}
                disabled={billingLoading}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "12px 16px",
                  background: "#FFFFFF",
                  color: DARK,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {billingLoading
                  ? "Ouverture..."
                  : isSubscribed
                    ? "Gerer l'abonnement"
                    : "Debloquer les pronostics premium"}
              </button>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {[
              { label: "En attente", value: pendingCount, color: "#F57F17" },
              { label: "Gagnes", value: wonCount, color: GREEN },
              { label: "Places", value: placedCount, color: "#1565C0" },
              {
                label: "P/L",
                value: totalGain >= 0 ? `+${formatEuros(totalGain)}` : formatEuros(totalGain),
                color: totalGain >= 0 ? GREEN : "#C62828",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,251,0.92))",
                  borderRadius: 22,
                  padding: "16px 12px",
                  textAlign: "center",
                  boxShadow: "0 14px 28px rgba(15,23,42,0.07)",
                  border: "1px solid rgba(15,23,42,0.05)",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color, letterSpacing: "-0.4px" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </section>

          {pendingCount > 0 ? (
            <div style={{ marginBottom: 18 }}>
              <button
                onClick={handleSettle}
                disabled={settling}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 18,
                  border: "none",
                  background: settling ? "#999" : "#FF9800",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: settling ? "not-allowed" : "pointer",
                  boxShadow: "0 16px 28px rgba(255,152,0,0.24)",
                }}
              >
                {settling ? "Verification..." : `Verifier les resultats (${pendingCount} en attente)`}
              </button>
            </div>
          ) : null}

          <section style={{ padding: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginBottom: 14 }}>
              Historique
            </div>

            {bets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  color: "#888",
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(15,23,42,0.05)",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>&#127922;</div>
                <div style={{ fontWeight: 700 }}>Aucun pari</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Ouvre une course pour poser ton premier ticket.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 12,
                }}
              >
                {bets.map((bet) => {
                  const cfg = statusConfig[bet.statut] || statusConfig.EN_ATTENTE;
                  return (
                    <div
                      key={bet.id}
                      style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,251,0.92))",
                        borderRadius: 22,
                        padding: 18,
                        boxShadow: "0 14px 28px rgba(15,23,42,0.07)",
                        border: "1px solid rgba(15,23,42,0.05)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ fontSize: 13, color: "#6B7280" }}>
                          R{bet.reunion}C{bet.course} · {bet.hippodrome}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: cfg.bg,
                            color: cfg.color,
                            padding: "5px 10px",
                            borderRadius: 20,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 16,
                            background: GREEN,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: 15,
                            flexShrink: 0,
                          }}
                        >
                          {bet.cheval_num}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: DARK }}>{bet.cheval_nom}</div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                            {bet.type_pari} · Cote {bet.cote} · Mise {formatEuros(bet.mise)}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 12,
                          color: "#6B7280",
                        }}
                      >
                        <span>{bet.heure_depart} · {bet.date_str}</span>
                        {bet.gain !== null ? (
                          <strong style={{ color: bet.gain >= 0 ? GREEN : "#C62828", fontSize: 15 }}>
                            {bet.gain >= 0 ? "+" : ""}
                            {formatEuros(bet.gain)}
                          </strong>
                        ) : (
                          <span>Resultat en attente</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 1180,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(18px)",
          borderTop: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 -14px 30px rgba(15,23,42,0.08)",
          height: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            paddingTop: 8,
          }}
        >
          <span style={{ fontSize: 22 }}>&#127943;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#999" }}>Courses</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            paddingTop: 8,
            position: "relative",
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: GREEN, position: "absolute", top: 0 }} />
          <span style={{ fontSize: 22 }}>&#128176;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: GREEN }}>Mes Paris</span>
        </div>
        <div
          onClick={() => router.push("/bilan")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            paddingTop: 8,
          }}
        >
          <span style={{ fontSize: 22 }}>&#128202;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#999" }}>Bilan</span>
        </div>
      </div>
    </div>
  );
}
