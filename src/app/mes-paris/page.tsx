"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { asArray } from "@/lib/array-utils";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";
import { ReferralCard } from "@/components/ui/ReferralCard";
import { UserStreakCard } from "@/components/ui/UserStreakCard";

const GREEN = "var(--pmu-primary)";
const DARK = "var(--pmu-text)";
const CARD = "var(--pmu-surface)";
const BORDER = "var(--pmu-border)";

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

function formatBonusExpiry(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function MesParisFallback() {
  return (
    <div
      style={{
        width: "min(1180px, calc(100% - 20px))",
        margin: "0 auto",
        minHeight: "100vh",
        background: `radial-gradient(circle at top left, var(--pmu-primary-fade), transparent 30%), linear-gradient(180deg, var(--pmu-bg) 0%, var(--pmu-bg-mid) 100%)`,
      }}
    />
  );
}

function MesParisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabaseConfigured = hasSupabaseConfig();
  const [bets, setBets] = useState<Bet[]>([]);
  const [solde, setSolde] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [error, setError] = useState("");
  const [isStripeSubscribed, setIsStripeSubscribed] = useState(false);
  const [accessSource, setAccessSource] = useState<"FREE" | "PAID" | "BONUS">("FREE");
  const [subscriptionStatus, setSubscriptionStatus] = useState("FREE");
  const [premiumAccessExpiresAt, setPremiumAccessExpiresAt] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<{
    tone: "success" | "warning" | "loading";
    title: string;
    message: string;
  } | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [autoCheckoutStarted, setAutoCheckoutStarted] = useState(false);
  const [showBottomNav, setShowBottomNav] = useState(false);
  const autoCheckoutRequested = searchParams.get("billing") === "checkout";

  const fetchBets = useCallback(
    async (signal?: AbortSignal) => {
      if (!supabaseConfigured) {
        setError(getSupabaseConfigError());
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (signal?.aborted) {
          return;
        }

        if (!session) {
          const redirectTarget = autoCheckoutRequested ? "/mes-paris?billing=checkout" : "/mes-paris";
          router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
          return;
        }

        setUser({ email: session.user?.email ?? undefined });

        const res = await fetch("/api/bets", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal,
        });
        const payload: {
          success?: boolean;
          bets?: Bet[];
          solde?: number;
          isSubscribed?: boolean;
          isStripeSubscribed?: boolean;
          accessSource?: "FREE" | "PAID" | "BONUS";
          subscriptionStatus?: string;
          premiumAccessExpiresAt?: string | null;
          error?: string;
        } = await res.json();

        if (signal?.aborted) {
          return;
        }

        if (!res.ok || !payload.success) {
          throw new Error(payload.error ?? "Réponse paris invalide.");
        }

        setBets(asArray<Bet>(payload.bets));
        setSolde(typeof payload.solde === "number" && Number.isFinite(payload.solde) ? payload.solde : 1000);
        setIsStripeSubscribed(Boolean(payload.isStripeSubscribed));
        setAccessSource(payload.accessSource ?? "FREE");
        setSubscriptionStatus(payload.subscriptionStatus ?? "FREE");
        setPremiumAccessExpiresAt(
          typeof payload.premiumAccessExpiresAt === "string" ? payload.premiumAccessExpiresAt : null
        );
      } catch (loadError) {
        if (signal?.aborted) {
          return;
        }
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger l'espace paris.");
        setBets([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [autoCheckoutRequested, router, supabaseConfigured]
  );

  useEffect(() => {
    const ac = new AbortController();
    void fetchBets(ac.signal);
    return () => {
      ac.abort();
    };
  }, [fetchBets, fetchRevision]);

  useEffect(() => {
    function syncBottomNavVisibility() {
      setShowBottomNav(window.innerWidth < 1024);
    }

    syncBottomNavVisibility();
    window.addEventListener("resize", syncBottomNavVisibility);
    return () => {
      window.removeEventListener("resize", syncBottomNavVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function handleSubscriptionReturn() {
      const subscriptionFlag = searchParams.get("subscription");
      const sessionId = searchParams.get("session_id");

      if (subscriptionFlag === "cancel") {
        setBillingNotice({
          tone: "warning",
          title: "Paiement annulé",
          message: "Le paiement a été interrompu. Ton compte reste sur l’offre gratuite tant que l’abonnement n’est pas confirmé.",
        });
        router.replace("/mes-paris");
        return;
      }

      if (subscriptionFlag !== "success") {
        return;
      }

      setBillingNotice({
        tone: "loading",
        title: "Vérification du paiement",
        message: "Nous confirmons ton abonnement premium avec Stripe avant d’ouvrir l’accès complet.",
      });

      if (!sessionId || !supabaseConfigured) {
        if (!cancelled) {
          setBillingNotice({
            tone: "warning",
            title: "Retour paiement détecté",
            message: "Le paiement est revenu de Stripe, mais la confirmation automatique est incomplète. Recharge la page dans quelques secondes.",
          });
        }
        router.replace("/mes-paris");
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) {
            setBillingNotice({
              tone: "warning",
              title: "Connexion requise",
              message: "Reconnecte-toi pour finaliser l'activation de l'abonnement.",
            });
          }
          return;
        }

        const response = await fetch(`/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Confirmation Stripe impossible");
        }

        await fetchBets();
        router.replace("/mes-paris");

        if (!cancelled) {
          setBillingNotice(
            payload.activated
              ? {
                  tone: "success",
                  title: "Abonnement actif",
                  message: "Paiement confirmé. Ton abonnement premium est maintenant actif et tes accès ont bien été ouverts.",
                }
              : {
                  tone: "loading",
                  title: "Paiement reçu",
                  message: "Le paiement est revenu, mais l'activation finale est encore en cours. Recharge la page dans quelques secondes.",
                }
          );
        }
      } catch (confirmationError) {
        router.replace("/mes-paris");
        if (!cancelled) {
          setBillingNotice({
            tone: "warning",
            title: "Confirmation en attente",
            message:
              confirmationError instanceof Error
                ? confirmationError.message
                : "Le paiement est revenu de Stripe, mais la confirmation automatique a échoué.",
          });
        }
      }
    }

    void handleSubscriptionReturn();

    return () => {
      cancelled = true;
    };
  }, [fetchBets, router, searchParams, supabaseConfigured]);

  async function handleSettle() {
    if (!supabaseConfigured) {
      setError(getSupabaseConfigError());
      return;
    }

    setSettling(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSettling(false);
        return;
      }

      await fetch("/api/bets/settle", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await fetchBets();
    } catch {
      setError("La vérification des résultats a échoué.");
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

  const handleBilling = useCallback(
    async (action: "checkout" | "portal") => {
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
        const redirectTarget = action === "checkout" ? "/mes-paris?billing=checkout" : "/mes-paris";
        router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        setBillingLoading(false);
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
    },
    [router, supabaseConfigured]
  );

  useEffect(() => {
      if (!autoCheckoutRequested || autoCheckoutStarted || loading || billingLoading || !user) {
      return;
    }

    if (isStripeSubscribed) {
      router.replace("/mes-paris");
      return;
    }

    setBillingNotice({
      tone: "loading",
      title: "Ouverture du paiement",
      message: "Redirection vers Stripe pour activer l'abonnement premium.",
    });
    setAutoCheckoutStarted(true);
    void handleBilling("checkout");
  }, [
    autoCheckoutRequested,
    autoCheckoutStarted,
    billingLoading,
    handleBilling,
    isStripeSubscribed,
    loading,
    router,
    user,
  ]);

  const hasBonusAccess = accessSource === "BONUS";
  const bonusExpiryLabel = formatBonusExpiry(premiumAccessExpiresAt);

  const pendingCount = bets.filter((b) => b.statut === "EN_ATTENTE").length;
  const wonCount = bets.filter((b) => b.statut === "GAGNE").length;
  const placedCount = bets.filter((b) => b.statut === "PLACE").length;
  const totalGain = bets.filter((b) => b.gain !== null).reduce((sum, b) => sum + (b.gain || 0), 0);

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    EN_ATTENTE: {
      bg: "color-mix(in srgb, var(--pmu-orange) 15%, transparent)",
      color: "var(--pmu-orange)",
      label: "En attente",
    },
    GAGNE: { bg: "color-mix(in srgb, var(--pmu-primary) 15%, transparent)", color: GREEN, label: "Gagné" },
    PLACE: {
      bg: "color-mix(in srgb, var(--pmu-accent-blue) 20%, transparent)",
      color: "var(--pmu-accent-blue)",
      label: "Place",
    },
    PERDU: { bg: "color-mix(in srgb, var(--pmu-red) 15%, transparent)", color: "var(--pmu-red)", label: "Perdu" },
  };

  return (
    <div
      style={{
        width: "min(1180px, calc(100% - 20px))",
        margin: "0 auto",
        minHeight: "100vh",
        background: `radial-gradient(circle at top left, var(--pmu-primary-fade), transparent 30%), linear-gradient(180deg, var(--pmu-bg) 0%, var(--pmu-bg-mid) 100%)`,
        paddingBottom: showBottomNav ? 88 : 24,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "color-mix(in srgb, var(--pmu-bg) 92%, transparent)",
          backdropFilter: "blur(18px)",
          borderBottom: `1px solid ${BORDER}`,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{
            position: "absolute",
            left: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--pmu-text) 12%, transparent)",
          }}
        >
          <svg
            width="18"
            height="18"
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
        <div style={{ color: GREEN, fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>
          Mes Paris
        </div>
        <div
          onClick={handleLogout}
          style={{
            position: "absolute",
            right: 14,
            color: "color-mix(in srgb, var(--pmu-text) 68%, transparent)",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Déconnexion
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Chargement de vos paris"
          style={{ textAlign: "center", padding: 48, color: "var(--pmu-text-muted)" }}
        >
          Chargement...
        </div>
      ) : error ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            margin: "14px 0",
            background: "color-mix(in srgb, var(--pmu-orange) 12%, transparent)",
            color: "var(--pmu-orange)",
            border: "1px solid color-mix(in srgb, var(--pmu-orange) 35%, transparent)",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <p style={{ margin: 0, marginBottom: 12 }}>{error}</p>
          <button
            type="button"
            onClick={() => setFetchRevision((revision) => revision + 1)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "9px 16px",
              background: GREEN,
              color: "var(--pmu-on-primary)",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {billingNotice ? (
            <div
              style={{
                margin: "14px 0 0",
                padding: 16,
                borderRadius: 16,
                border: `1px solid ${
                  billingNotice.tone === "success"
                    ? "color-mix(in srgb, var(--pmu-primary) 35%, transparent)"
                    : billingNotice.tone === "loading"
                      ? "color-mix(in srgb, var(--pmu-accent-blue) 35%, transparent)"
                      : "color-mix(in srgb, var(--pmu-orange) 35%, transparent)"
                }`,
                background:
                  billingNotice.tone === "success"
                    ? "var(--pmu-primary-fade)"
                    : billingNotice.tone === "loading"
                      ? "color-mix(in srgb, var(--pmu-accent-blue) 10%, transparent)"
                      : "color-mix(in srgb, var(--pmu-orange) 8%, transparent)",
                boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color:
                    billingNotice.tone === "success"
                      ? GREEN
                      : billingNotice.tone === "loading"
                        ? "var(--pmu-accent-blue)"
                        : "var(--pmu-orange)",
                  marginBottom: 6,
                }}
              >
                {"Confirmation d'abonnement"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: DARK, marginBottom: 5 }}>
                {billingNotice.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: "19px", color: "var(--pmu-text-muted)" }}>
                {billingNotice.message}
              </div>
            </div>
          ) : null}

          <div style={{ marginBottom: 14 }}>
            <UserStreakCard />
          </div>

          <section
            style={{
              background: `radial-gradient(circle at top right, var(--pmu-primary-soft), transparent 35%), linear-gradient(135deg, color-mix(in srgb, var(--pmu-primary) 12%, var(--pmu-bg-mid)), var(--pmu-bg))`,
              borderRadius: 24,
              margin: "14px 0 12px",
              padding: 22,
              color: "var(--pmu-text)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.26)",
              border: "1px solid var(--pmu-border)",
              display: "grid",
              gap: 14,
              gridTemplateColumns: "minmax(0,1.4fr) minmax(240px,0.9fr)",
            }}
          >
            <div>
              <div style={{ fontSize: 11, opacity: 0.84, marginBottom: 4 }}>{user?.email}</div>
              <div style={{ fontSize: 38, fontWeight: 900, marginBottom: 6, letterSpacing: "-1px" }}>
                {formatEuros(solde)}
              </div>
              <div style={{ fontSize: 13, opacity: 0.92, fontWeight: 600 }}>
                {bets.length} paris · {wonCount} gagnés · {placedCount} placés
              </div>
            </div>
            <div
              style={{
                borderRadius: 18,
                background: "color-mix(in srgb, var(--pmu-surface-2) 84%, transparent)",
                border: "1px solid var(--pmu-border)",
                padding: 14,
                display: "grid",
                gap: 10,
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
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--pmu-text) 14%, transparent)",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {isStripeSubscribed
                  ? `Abonnement ${subscriptionStatus}`
                  : hasBonusAccess
                    ? "Accès bonus actif"
                    : "Compte gratuit"}
              </div>
              <div style={{ fontSize: 12, lineHeight: "18px", color: "color-mix(in srgb, var(--pmu-text) 78%, transparent)" }}>
                {isStripeSubscribed
                  ? "Ton espace premium est actif : pronostics complets, mises et tickets détaillés."
                  : hasBonusAccess
                    ? `Ton accès premium bonus est actif${bonusExpiryLabel ? ` jusqu'au ${bonusExpiryLabel}` : ""}. Tu peux déjà voir les pronostics complets, ou passer au mensuel quand tu veux.`
                  : "Passe en premium pour débloquer les opportunités value filtrées, les mises Kelly et les tickets optimisés."}
              </div>
              <button
                onClick={() => handleBilling(isStripeSubscribed ? "portal" : "checkout")}
                disabled={billingLoading}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "10px 14px",
                  background: GREEN,
                  color: "var(--pmu-on-primary)",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {billingLoading
                  ? "Ouverture..."
                  : isStripeSubscribed
                    ? "Gérer l’abonnement"
                    : hasBonusAccess
                      ? "Passer au premium mensuel"
                      : "Débloquer les pronostics premium"}
              </button>
              {!isStripeSubscribed ? (
                <button
                  onClick={() => router.push("/premium")}
                  style={{
                    border: "1px solid color-mix(in srgb, var(--pmu-text) 22%, transparent)",
                    borderRadius: 999,
                    padding: "10px 14px",
                    background: "transparent",
                    color: "var(--pmu-text)",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {"Voir le détail de l’offre"}
                </button>
              ) : null}
              {!isStripeSubscribed ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    "Top 5 complet",
                    "Opportunité value confirmée",
                    "Mise bankroll",
                    "Bilan réel du moteur",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        padding: "7px 9px",
                        borderRadius: 999,
                        background: "color-mix(in srgb, var(--pmu-text) 12%, transparent)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              { label: "En attente", value: pendingCount, color: "var(--pmu-orange)" },
              { label: "Gagnés", value: wonCount, color: GREEN },
              { label: "Places", value: placedCount, color: "var(--pmu-accent-blue)" },
              {
                label: "P/L",
                value: totalGain >= 0 ? `+${formatEuros(totalGain)}` : formatEuros(totalGain),
                color: totalGain >= 0 ? GREEN : "var(--pmu-red)",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: CARD,
                  borderRadius: 18,
                  padding: "14px 10px",
                  textAlign: "center",
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: item.color, letterSpacing: "-0.4px" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 10, color: "var(--pmu-text-muted)", marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </section>

          {pendingCount > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={handleSettle}
                disabled={settling}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 14,
                  border: "none",
                  background: settling ? "var(--pmu-border-strong)" : "var(--pmu-orange)",
                  color: settling ? "var(--pmu-text-muted)" : "var(--pmu-on-primary)",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: settling ? "not-allowed" : "pointer",
                  boxShadow: "0 12px 22px color-mix(in srgb, var(--pmu-orange) 20%, transparent)",
                }}
              >
                {settling ? "Vérification..." : `Vérifier les résultats (${pendingCount} en attente)`}
              </button>
            </div>
          ) : null}

          <section style={{ padding: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 12 }}>
              Historique
            </div>

            {bets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 18px",
                  color: "var(--pmu-text-muted)",
                  borderRadius: 18,
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>&#127922;</div>
                <div style={{ fontWeight: 700 }}>Aucun pari</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Ouvre une course pour poser ton premier ticket.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 10,
                }}
              >
                {bets.map((bet) => {
                  const cfg = statusConfig[bet.statut] || statusConfig.EN_ATTENTE;
                  return (
                    <div
                      key={bet.id}
                      style={{
                        background: CARD,
                        borderRadius: 18,
                        padding: 14,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontSize: 13, color: "var(--pmu-text-muted)" }}>
                          R{bet.reunion}C{bet.course} · {bet.hippodrome}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: cfg.bg,
                            color: cfg.color,
                            padding: "4px 9px",
                            borderRadius: 16,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: GREEN,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--pmu-on-primary)",
                            fontWeight: 800,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {bet.cheval_num}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>{bet.cheval_nom}</div>
                          <div style={{ fontSize: 12, color: "var(--pmu-text-muted)", marginTop: 2 }}>
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
                          color: "var(--pmu-text-muted)",
                        }}
                      >
                        <span>{bet.heure_depart} · {bet.date_str}</span>
                        {bet.gain !== null ? (
                          <strong style={{ color: bet.gain >= 0 ? GREEN : "var(--pmu-red)", fontSize: 14 }}>
                            {bet.gain >= 0 ? "+" : ""}
                            {formatEuros(bet.gain)}
                          </strong>
                        ) : (
                          <span>Résultat en attente</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div style={{ marginTop: 16 }}>
            <ReferralCard />
          </div>
        </>
      )}

      {showBottomNav ? (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 1180,
            zIndex: 50,
            background: "color-mix(in srgb, var(--pmu-bg) 95%, transparent)",
            backdropFilter: "blur(18px)",
            borderTop: `1px solid ${BORDER}`,
            boxShadow: "0 -10px 22px color-mix(in srgb, var(--pmu-text) 10%, transparent)",
            height: 62,
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
               paddingTop: 6,
            }}
          >
            <span style={{ fontSize: 22 }}>&#127943;</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pmu-text-muted)" }}>Courses</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
               paddingTop: 6,
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
               paddingTop: 6,
            }}
          >
            <span style={{ fontSize: 22 }}>&#128202;</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pmu-text-muted)" }}>Bilan</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MesParisPage() {
  return (
    <Suspense fallback={<MesParisFallback />}>
      <MesParisContent />
    </Suspense>
  );
}
