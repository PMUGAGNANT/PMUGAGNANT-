"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function MesParisPage() {
  const router = useRouter();
  const supabaseConfigured = hasSupabaseConfig();
  const [bets, setBets] = useState<Bet[]>([]);
  const [solde, setSolde] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [error, setError] = useState("");

  const fetchBets = useCallback(async () => {
    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
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
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  async function handleSettle() {
    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setSettling(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
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
      // silent
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

  const pendingCount = bets.filter((b) => b.statut === "EN_ATTENTE").length;
  const wonCount = bets.filter((b) => b.statut === "GAGNE").length;
  const placedCount = bets.filter((b) => b.statut === "PLACE").length;
  const lostCount = bets.filter((b) => b.statut === "PERDU").length;
  const totalGain = bets
    .filter((b) => b.gain !== null)
    .reduce((sum, b) => sum + (b.gain || 0), 0);

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    EN_ATTENTE: { bg: "#FFF8E1", color: "#F57F17", label: "En attente" },
    GAGNE: { bg: "#E8F5E9", color: GREEN, label: "Gagné" },
    PLACE: { bg: "#E3F2FD", color: "#1565C0", label: "Placé" },
    PERDU: { bg: "#FFEBEE", color: "#C62828", label: "Perdu" },
  };

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F5F5F5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: DARK,
          height: 56,
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
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ color: GREEN, fontWeight: 700, fontSize: 18 }}>Mes Paris</div>
        <div
          onClick={handleLogout}
          style={{
            position: "absolute",
            right: 16,
            color: "#888",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Déconnexion
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Chargement...</div>
      ) : error ? (
        <div
          style={{
            margin: "16px",
            background: "#FFF3CD",
            color: "#856404",
            padding: "16px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : (
        <>
          {/* Profile card */}
          <div
            style={{
              background: "linear-gradient(135deg, #00843D, #006B31)",
              borderRadius: 16,
              margin: "12px 16px",
              padding: 20,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
              {user?.email}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>
              {solde}€
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {bets.length} paris · {wonCount} gagnés · {placedCount} placés
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 8,
              margin: "0 16px 16px",
            }}
          >
            {[
              { label: "En attente", value: pendingCount, color: "#F57F17" },
              { label: "Gagnés", value: wonCount, color: GREEN },
              { label: "Placés", value: placedCount, color: "#1565C0" },
              { label: "P/L", value: totalGain >= 0 ? `+${totalGain}€` : `${totalGain}€`, color: totalGain >= 0 ? GREEN : "#C62828" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "12px 8px",
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Settle button */}
          {pendingCount > 0 && (
            <div style={{ margin: "0 16px 16px" }}>
              <button
                onClick={handleSettle}
                disabled={settling}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "none",
                  background: settling ? "#999" : "#FF9800",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: settling ? "not-allowed" : "pointer",
                }}
              >
                {settling ? "Vérification..." : `Vérifier les résultats (${pendingCount} en attente)`}
              </button>
            </div>
          )}

          {/* Bets list */}
          <div style={{ padding: "0 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 12 }}>
              Historique
            </div>

            {bets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#888",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>&#127922;</div>
                <div style={{ fontWeight: 600 }}>Aucun pari</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Allez sur une course pour placer votre premier pari
                </div>
              </div>
            ) : (
              bets.map((bet) => {
                const cfg = statusConfig[bet.statut] || statusConfig.EN_ATTENTE;
                return (
                  <div
                    key={bet.id}
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 13, color: "#888" }}>
                        R{bet.reunion}C{bet.course} · {bet.hippodrome}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: cfg.bg,
                          color: cfg.color,
                          padding: "3px 10px",
                          borderRadius: 20,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: GREEN,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {bet.cheval_num}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: DARK }}>
                          {bet.cheval_nom}
                        </div>
                        <div style={{ fontSize: 12, color: "#888" }}>
                          {bet.type_pari} · Cote {bet.cote} · Mise {bet.mise}€
                        </div>
                      </div>
                    </div>

                    {bet.gain !== null && (
                      <div
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 16,
                          color: bet.gain >= 0 ? GREEN : "#C62828",
                        }}
                      >
                        {bet.gain >= 0 ? "+" : ""}
                        {bet.gain}€
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          zIndex: 50,
          background: "#fff",
          borderTop: "1px solid #eee",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", paddingTop: 8 }}
        >
          <span style={{ fontSize: 22 }}>&#127943;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#999" }}>Courses</span>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", paddingTop: 8, position: "relative" }}
        >
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: GREEN, position: "absolute", top: 0 }} />
          <span style={{ fontSize: 22 }}>&#128176;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: GREEN }}>Mes Paris</span>
        </div>
        <div
          onClick={() => router.push("/bilan")}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", paddingTop: 8 }}
        >
          <span style={{ fontSize: 22 }}>&#128202;</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#999" }}>Bilan</span>
        </div>
      </div>
    </div>
  );
}
