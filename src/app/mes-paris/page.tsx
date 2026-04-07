"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
const BLUE = "var(--pmu-accent-blue)";
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

interface PerformanceBucket {
  label: string;
  bets: number;
  stake: number;
  profit: number;
  roi: number;
  hitRate: number;
}

interface ProfitPoint {
  label: string;
  profit: number;
  cumulativeProfit: number;
}

type BankrollProfile = "prudent" | "equilibre" | "offensif";

interface BankrollSettings {
  bankrollBase: number;
  maxBetsPerDay: number;
  stopLoss: number;
  stakeCapPct: number;
  profile: BankrollProfile;
}

const BANKROLL_STORAGE_KEY = "pmu-bankroll-settings";

const BANKROLL_PROFILE_LABELS: Record<BankrollProfile, string> = {
  prudent: "Prudent",
  equilibre: "Equilibre",
  offensif: "Offensif",
};

const BANKROLL_PROFILE_HINTS: Record<BankrollProfile, string> = {
  prudent: "Expose moins de capital et privilegie les tickets les plus propres.",
  equilibre: "Le meilleur compromis entre discipline et opportunites jouables.",
  offensif: "Accepte plus de variance pour exploiter davantage les edges du moteur.",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeBankrollSettings(value: Partial<BankrollSettings> | null | undefined): BankrollSettings {
  return {
    bankrollBase: clamp(Math.round(value?.bankrollBase ?? 1000), 50, 200000),
    maxBetsPerDay: clamp(Math.round(value?.maxBetsPerDay ?? 3), 1, 12),
    stopLoss: clamp(Math.round(value?.stopLoss ?? 40), 5, 5000),
    stakeCapPct: clamp(Number(value?.stakeCapPct ?? 4), 1, 20),
    profile: value?.profile === "prudent" || value?.profile === "offensif" ? value.profile : "equilibre",
  };
}

function getDefaultBankrollSettings(): BankrollSettings {
  return normalizeBankrollSettings(null);
}

function getProfileStakeMultiplier(profile: BankrollProfile) {
  if (profile === "prudent") return 0.75;
  if (profile === "offensif") return 1.2;
  return 1;
}

function getProfileRiskLabel(profile: BankrollProfile) {
  if (profile === "prudent") return "Risque contenu";
  if (profile === "offensif") return "Risque plus agressif";
  return "Risque maitrise";
}

function formatEuros(value: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} EUR`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatSignedEuros(value: number) {
  return `${value >= 0 ? "+" : ""}${formatEuros(value)}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}

function toTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildPerformanceBuckets(bets: Bet[], getLabel: (bet: Bet) => string): PerformanceBucket[] {
  const grouped = new Map<
    string,
    {
      bets: number;
      settled: number;
      wins: number;
      stake: number;
      profit: number;
    }
  >();

  for (const bet of bets) {
    const rawLabel = getLabel(bet).trim();
    const label = rawLabel.length > 0 ? rawLabel : "Autre";
    const current = grouped.get(label) ?? {
      bets: 0,
      settled: 0,
      wins: 0,
      stake: 0,
      profit: 0,
    };

    current.bets += 1;
    current.stake += bet.mise;

    if (bet.gain !== null) {
      current.settled += 1;
      current.profit += bet.gain;
      if (bet.gain > 0) {
        current.wins += 1;
      }
    }

    grouped.set(label, current);
  }

  return Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      bets: value.bets,
      stake: value.stake,
      profit: value.profit,
      roi: value.stake > 0 ? (value.profit / value.stake) * 100 : 0,
      hitRate: value.settled > 0 ? (value.wins / value.settled) * 100 : 0,
    }))
    .sort((left, right) => {
      if (right.profit !== left.profit) {
        return right.profit - left.profit;
      }
      return right.bets - left.bets;
    });
}

function buildProfitTimeline(bets: Bet[], maxPoints: number): ProfitPoint[] {
  const settled = bets
    .filter((bet) => bet.gain !== null)
    .slice()
    .sort((left, right) => toTimestamp(left.created_at) - toTimestamp(right.created_at));

  if (settled.length === 0) {
    return [];
  }

  const points = settled.slice(-maxPoints);
  let cumulativeProfit = 0;

  return points.map((bet) => {
    cumulativeProfit += bet.gain ?? 0;
    return {
      label: `${bet.date_str.slice(0, 2)}/${bet.date_str.slice(2, 4)}`,
      profit: bet.gain ?? 0,
      cumulativeProfit,
    };
  });
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
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("FREE");
  const [billingNotice, setBillingNotice] = useState<{
    tone: "success" | "warning" | "loading";
    title: string;
    message: string;
  } | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [autoCheckoutStarted, setAutoCheckoutStarted] = useState(false);
  const [showBottomNav, setShowBottomNav] = useState(false);
  const autoCheckoutRequested = searchParams.get("billing") === "checkout";
  const [bankrollSettings, setBankrollSettings] = useState<BankrollSettings>(() =>
    getDefaultBankrollSettings()
  );

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
          subscriptionStatus?: string;
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
        setIsSubscribed(Boolean(payload.isSubscribed));
        setSubscriptionStatus(payload.subscriptionStatus ?? "FREE");
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
    try {
      const raw = window.localStorage.getItem(BANKROLL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<BankrollSettings>;
      setBankrollSettings(normalizeBankrollSettings(parsed));
    } catch {
      setBankrollSettings(getDefaultBankrollSettings());
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BANKROLL_STORAGE_KEY,
        JSON.stringify(bankrollSettings)
      );
    } catch {
      // Ignore local persistence failures on the client.
    }
  }, [bankrollSettings]);

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

    if (isSubscribed) {
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
    isSubscribed,
    loading,
    router,
    user,
  ]);

  const pendingCount = bets.filter((b) => b.statut === "EN_ATTENTE").length;
  const wonCount = bets.filter((b) => b.statut === "GAGNE").length;
  const placedCount = bets.filter((b) => b.statut === "PLACE").length;
  const totalGain = bets.filter((b) => b.gain !== null).reduce((sum, b) => sum + (b.gain || 0), 0);
  const settledBets = bets.filter((b) => b.gain !== null);
  const totalStake = bets.reduce((sum, bet) => sum + bet.mise, 0);
  const pendingStake = bets
    .filter((bet) => bet.statut === "EN_ATTENTE")
    .reduce((sum, bet) => sum + bet.mise, 0);
  const realisedProfit = settledBets.reduce((sum, bet) => sum + (bet.gain ?? 0), 0);
  const roi =
    totalStake > 0 ? (realisedProfit / totalStake) * 100 : 0;
  const averageStake =
    bets.length > 0 ? totalStake / bets.length : 0;
  const recommendedMaxStake = Math.max(
    1,
    Math.round(
      bankrollSettings.bankrollBase *
        (bankrollSettings.stakeCapPct / 100) *
        getProfileStakeMultiplier(bankrollSettings.profile)
    )
  );
  const remainingStopLoss = bankrollSettings.stopLoss + Math.min(realisedProfit, 0);
  const stopLossReached = realisedProfit < 0 && Math.abs(realisedProfit) >= bankrollSettings.stopLoss;
  const remainingBetSlots = Math.max(0, bankrollSettings.maxBetsPerDay - pendingCount);
  const bankrollHealthLabel =
    stopLossReached
      ? "Stop loss atteint"
      : pendingStake > recommendedMaxStake * 2
        ? "Exposition tendue"
      : realisedProfit >= 0
          ? "Discipline saine"
          : "Sous surveillance";

  const recentSettledBets = useMemo(
    () =>
      settledBets
        .slice()
        .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
        .slice(0, 8),
    [settledBets]
  );
  const recentForm = useMemo(
    () =>
      recentSettledBets.map((bet) => ({
        key: bet.id,
        label: bet.statut === "GAGNE" ? "G" : bet.statut === "PLACE" ? "P" : "L",
        tone: bet.gain !== null && bet.gain > 0 ? GREEN : "var(--pmu-red)",
      })),
    [recentSettledBets]
  );
  const trackPerformance = useMemo(
    () => buildPerformanceBuckets(settledBets, (bet) => bet.hippodrome).slice(0, 3),
    [settledBets]
  );
  const betTypePerformance = useMemo(
    () => buildPerformanceBuckets(settledBets, (bet) => bet.type_pari).slice(0, 3),
    [settledBets]
  );
  const profitTimeline = useMemo(() => buildProfitTimeline(bets, 10), [bets]);
  const timelineMaxAbs = useMemo(
    () => Math.max(...profitTimeline.map((point) => Math.abs(point.cumulativeProfit)), 1),
    [profitTimeline]
  );
  const bestTrack = trackPerformance[0] ?? null;
  const weakestTrack = trackPerformance.length > 1 ? trackPerformance[trackPerformance.length - 1] : null;
  const bestBetType = betTypePerformance[0] ?? null;
  const latestSettledBet = recentSettledBets[0] ?? null;

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
                {isSubscribed ? `Abonnement ${subscriptionStatus}` : "Compte gratuit"}
              </div>
              <div style={{ fontSize: 12, lineHeight: "18px", color: "color-mix(in srgb, var(--pmu-text) 78%, transparent)" }}>
                {isSubscribed
                  ? "Ton espace premium est actif : pronostics complets, mises et tickets détaillés."
                  : "Passe en premium pour débloquer les opportunités value filtrées, les mises Kelly et les tickets optimisés."}
              </div>
              <button
                onClick={() => handleBilling(isSubscribed ? "portal" : "checkout")}
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
                  : isSubscribed
                    ? "Gérer l’abonnement"
                    : "Débloquer les pronostics premium"}
              </button>
              {!isSubscribed ? (
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
              {!isSubscribed ? (
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
              gridTemplateColumns: "minmax(0,1.15fr) minmax(280px,0.85fr)",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                background: CARD,
                borderRadius: 24,
                padding: 20,
                boxShadow: "var(--pmu-shadow)",
                border: `1px solid ${BORDER}`,
                display: "grid",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "var(--pmu-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800, marginBottom: 8 }}>
                  Mode bankroll discipline
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: DARK, letterSpacing: "-0.8px", marginBottom: 6 }}>
                  Pilotage du risque en direct
                </div>
                <div style={{ fontSize: 14, lineHeight: "21px", color: "var(--pmu-text-muted)" }}>
                  Regle ton bankroll, ton stop loss et ton exposition max pour rester selectif meme
                  quand plusieurs tickets paraissent jouables.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pmu-text-muted)" }}>
                    Bankroll de reference
                  </span>
                  <input
                    type="number"
                    min={50}
                    max={200000}
                    value={bankrollSettings.bankrollBase}
                    onChange={(event) =>
                      setBankrollSettings((current) =>
                        normalizeBankrollSettings({
                          ...current,
                          bankrollBase: Number(event.target.value),
                        })
                      )
                    }
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: `1px solid ${BORDER}`,
                      background: "var(--pmu-surface-2)",
                      color: DARK,
                      padding: "12px 14px",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pmu-text-muted)" }}>
                    Max paris / jour
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={bankrollSettings.maxBetsPerDay}
                    onChange={(event) =>
                      setBankrollSettings((current) =>
                        normalizeBankrollSettings({
                          ...current,
                          maxBetsPerDay: Number(event.target.value),
                        })
                      )
                    }
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: `1px solid ${BORDER}`,
                      background: "var(--pmu-surface-2)",
                      color: DARK,
                      padding: "12px 14px",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pmu-text-muted)" }}>
                    Stop loss journalier
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={5000}
                    value={bankrollSettings.stopLoss}
                    onChange={(event) =>
                      setBankrollSettings((current) =>
                        normalizeBankrollSettings({
                          ...current,
                          stopLoss: Number(event.target.value),
                        })
                      )
                    }
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: `1px solid ${BORDER}`,
                      background: "var(--pmu-surface-2)",
                      color: DARK,
                      padding: "12px 14px",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pmu-text-muted)" }}>
                    Exposition max / ticket
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    step={0.5}
                    value={bankrollSettings.stakeCapPct}
                    onChange={(event) =>
                      setBankrollSettings((current) =>
                        normalizeBankrollSettings({
                          ...current,
                          stakeCapPct: Number(event.target.value),
                        })
                      )
                    }
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: `1px solid ${BORDER}`,
                      background: "var(--pmu-surface-2)",
                      color: DARK,
                      padding: "12px 14px",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                </label>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["prudent", "equilibre", "offensif"] as BankrollProfile[]).map((profile) => {
                  const active = bankrollSettings.profile === profile;
                  return (
                    <button
                      key={profile}
                      type="button"
                      onClick={() =>
                        setBankrollSettings((current) =>
                          normalizeBankrollSettings({ ...current, profile })
                        )
                      }
                      style={{
                        border: `1px solid ${active ? GREEN : BORDER}`,
                        borderRadius: 999,
                        padding: "10px 14px",
                        background: active
                          ? "color-mix(in srgb, var(--pmu-primary) 15%, transparent)"
                          : "transparent",
                        color: active ? GREEN : DARK,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {BANKROLL_PROFILE_LABELS[profile]}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                {[
                  {
                    label: "Stake max recommande",
                    value: formatEuros(recommendedMaxStake),
                    tone: GREEN,
                    hint: `${formatPercent(bankrollSettings.stakeCapPct)} de bankroll ajuste par le profil`,
                  },
                  {
                    label: "Stop loss restant",
                    value: formatEuros(Math.max(0, remainingStopLoss)),
                    tone: stopLossReached ? "var(--pmu-red)" : "var(--pmu-orange)",
                    hint: stopLossReached ? "Pause recommandee sur la journee" : "Marge de perte encore acceptable",
                  },
                  {
                    label: "Slots de jeu restants",
                    value: `${remainingBetSlots}`,
                    tone: remainingBetSlots === 0 ? "var(--pmu-red)" : "var(--pmu-accent-blue)",
                    hint: `${pendingCount} ticket(s) en attente actuellement`,
                  },
                  {
                    label: "Mise moyenne",
                    value: bets.length > 0 ? formatEuros(Math.round(averageStake)) : "0 EUR",
                    tone: averageStake > recommendedMaxStake ? "var(--pmu-red)" : DARK,
                    hint: averageStake > recommendedMaxStake ? "Au-dessus de la discipline cible" : "Dans la zone discipline",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      background: "var(--pmu-surface-2)",
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--pmu-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: item.tone, letterSpacing: "-0.5px", marginBottom: 6 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: "18px", color: "var(--pmu-text-muted)" }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: CARD,
                borderRadius: 24,
                padding: 20,
                boxShadow: "var(--pmu-shadow)",
                border: `1px solid ${BORDER}`,
                display: "grid",
                gap: 14,
                alignContent: "start",
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "var(--pmu-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800, marginBottom: 8 }}>
                  Etat de sante
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: bankrollHealthLabel === "Discipline saine" ? GREEN : bankrollHealthLabel === "Exposition tendue" ? "var(--pmu-orange)" : "var(--pmu-red)" }}>
                  {bankrollHealthLabel}
                </div>
                <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--pmu-text-muted)", marginTop: 8 }}>
                  {BANKROLL_PROFILE_HINTS[bankrollSettings.profile]}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  {
                    title: "Exposition en cours",
                    body: pendingStake > recommendedMaxStake * 2
                      ? `Tu as ${formatEuros(pendingStake)} deja engages, soit une exposition elevee pour le profil ${BANKROLL_PROFILE_LABELS[bankrollSettings.profile].toLowerCase()}.`
                      : `Tu as ${formatEuros(pendingStake)} engages sur les tickets en attente, ce qui reste coherent avec ton cadre de jeu.`,
                    tone: pendingStake > recommendedMaxStake * 2 ? "var(--pmu-orange)" : GREEN,
                  },
                  {
                    title: "ROI courant",
                    body: totalStake > 0
                      ? `Le portefeuille affiche ${formatPercent(round1(roi))} de ROI realise sur ${formatEuros(totalStake)} de mise totale.`
                      : "Le ROI apparaitra une fois les premiers tickets enregistres et regles.",
                    tone: roi >= 0 ? GREEN : "var(--pmu-red)",
                  },
                  {
                    title: "Lecture de risque",
                    body: stopLossReached
                      ? "Le stop loss est touche. La meilleure decision est de stopper la journee plutot que de se refaire."
                      : `Profil ${BANKROLL_PROFILE_LABELS[bankrollSettings.profile]} actif: ${getProfileRiskLabel(bankrollSettings.profile)} avec cap ticket ${formatPercent(bankrollSettings.stakeCapPct)}.`,
                    tone: stopLossReached ? "var(--pmu-red)" : BLUE,
                  },
                ].map((insight) => (
                  <div
                    key={insight.title}
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: "var(--pmu-surface-2)",
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: insight.tone, marginBottom: 6 }}>
                      {insight.title}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--pmu-text-muted)" }}>
                      {insight.body}
                    </div>
                  </div>
                ))}
              </div>
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

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 0.9fr)",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                background: CARD,
                borderRadius: 26,
                border: `1px solid ${BORDER}`,
                boxShadow: "var(--pmu-shadow)",
                padding: 20,
                display: "grid",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: BLUE }}>
                    Lecture performance
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: DARK, marginTop: 4 }}>
                    Forme et angles forts
                  </div>
                </div>
                {recentForm.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {recentForm.map((item) => (
                      <span
                        key={item.key}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: `color-mix(in srgb, ${item.tone} 16%, transparent)`,
                          color: item.tone,
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                {[
                  {
                    label: "Meilleur hippodrome",
                    value: bestTrack ? bestTrack.label : "A definir",
                    hint: bestTrack ? `${formatSignedPercent(round1(bestTrack.roi))} de ROI sur ${bestTrack.bets} tickets` : "Pas assez d'historique regle",
                    tone: bestTrack && bestTrack.roi >= 0 ? GREEN : BLUE,
                  },
                  {
                    label: "Type le plus rentable",
                    value: bestBetType ? bestBetType.label : "A definir",
                    hint: bestBetType ? `${formatSignedPercent(round1(bestBetType.roi))} de ROI sur ${bestBetType.bets} tickets` : "Les paris regles apparaitront ici",
                    tone: bestBetType && bestBetType.roi >= 0 ? GREEN : BLUE,
                  },
                  {
                    label: "Dernier ticket regle",
                    value: latestSettledBet ? latestSettledBet.cheval_nom : "En attente",
                    hint: latestSettledBet ? `${latestSettledBet.type_pari} · ${formatSignedEuros(latestSettledBet.gain ?? 0)}` : "Aucun resultat disponible pour l'instant",
                    tone: latestSettledBet && (latestSettledBet.gain ?? 0) >= 0 ? GREEN : "var(--pmu-red)",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: 20,
                      padding: 16,
                      background: "var(--pmu-surface-2)",
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: item.tone, marginBottom: 8 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: DARK, marginBottom: 6 }}>{item.value}</div>
                    <div style={{ fontSize: 12, lineHeight: "18px", color: "var(--pmu-text-muted)" }}>{item.hint}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {[
                  {
                    title: "Top hippodromes",
                    rows: trackPerformance,
                    empty: "Les hippodromes les plus lisibles apparaitront ici.",
                  },
                  {
                    title: "Top types de pari",
                    rows: betTypePerformance,
                    empty: "Gagnant vs place deviendra plus lisible avec davantage de tickets regles.",
                  },
                ].map((block) => (
                  <div
                    key={block.title}
                    style={{
                      borderRadius: 20,
                      padding: 16,
                      background: "var(--pmu-surface-2)",
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: DARK, marginBottom: 10 }}>{block.title}</div>
                    {block.rows.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--pmu-text-muted)", lineHeight: "18px" }}>{block.empty}</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {block.rows.map((row) => (
                          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: DARK }}>{row.label}</div>
                              <div style={{ fontSize: 11, color: "var(--pmu-text-muted)" }}>
                                {row.bets} tickets · hit {formatPercent(round1(row.hitRate))}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 900, color: row.roi >= 0 ? GREEN : "var(--pmu-red)" }}>
                                {formatSignedPercent(round1(row.roi))}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--pmu-text-muted)" }}>{formatSignedEuros(row.profit)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: CARD,
                borderRadius: 26,
                border: `1px solid ${BORDER}`,
                boxShadow: "var(--pmu-shadow)",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: GREEN }}>
                  Courbe de gain
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: DARK, marginTop: 4 }}>
                  Profit realise recent
                </div>
              </div>

              {profitTimeline.length === 0 ? (
                <div
                  style={{
                    minHeight: 220,
                    borderRadius: 20,
                    border: `1px dashed ${BORDER}`,
                    background: "var(--pmu-surface-2)",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    color: "var(--pmu-text-muted)",
                    fontSize: 13,
                    lineHeight: "20px",
                    padding: 24,
                  }}
                >
                  La courbe apparaitra des que plusieurs tickets seront regles.
                </div>
              ) : (
                <div
                  style={{
                    minHeight: 220,
                    borderRadius: 20,
                    border: `1px solid ${BORDER}`,
                    background: "linear-gradient(180deg, color-mix(in srgb, var(--pmu-primary-soft) 35%, transparent), transparent 40%), var(--pmu-surface-2)",
                    padding: 16,
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 10,
                  }}
                >
                  {profitTimeline.map((point, index) => {
                    const height = `${Math.max((Math.abs(point.cumulativeProfit) / timelineMaxAbs) * 100, 14)}%`;
                    const positive = point.cumulativeProfit >= 0;

                    return (
                      <div
                        key={`${point.label}-${index}`}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 800, color: positive ? GREEN : "var(--pmu-red)" }}>
                          {formatSignedEuros(point.cumulativeProfit)}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 34,
                            height,
                            minHeight: 24,
                            borderRadius: 999,
                            background: positive
                              ? "linear-gradient(180deg, var(--pmu-primary-bright), var(--pmu-primary))"
                              : "linear-gradient(180deg, color-mix(in srgb, var(--pmu-red) 70%, white), var(--pmu-red))",
                            boxShadow: positive
                              ? "0 16px 28px color-mix(in srgb, var(--pmu-primary) 26%, transparent)"
                              : "0 16px 28px color-mix(in srgb, var(--pmu-red) 22%, transparent)",
                          }}
                        />
                        <div style={{ fontSize: 10, color: "var(--pmu-text-muted)", whiteSpace: "nowrap" }}>{point.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  bestTrack
                    ? `Le meilleur angle actuel est ${bestTrack.label} avec ${formatSignedPercent(round1(bestTrack.roi))} de ROI.`
                    : "Le meilleur angle apparaitra apres quelques tickets regles.",
                  weakestTrack && weakestTrack !== bestTrack
                    ? `Le point de vigilance actuel est ${weakestTrack.label}, moins rentable sur ton historique recent.`
                    : "Aucun angle faible net n'apparait encore dans l'historique.",
                ].map((sentence) => (
                  <div
                    key={sentence}
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: "var(--pmu-surface-2)",
                      border: `1px solid ${BORDER}`,
                      fontSize: 13,
                      lineHeight: "19px",
                      color: "var(--pmu-text-muted)",
                    }}
                  >
                    {sentence}
                  </div>
                ))}
              </div>
            </div>
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
