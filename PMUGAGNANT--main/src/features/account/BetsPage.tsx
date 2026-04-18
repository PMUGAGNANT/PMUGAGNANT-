"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { asArray } from "@/lib/array-utils";
import { BetHistoryCard } from "@/features/account/components/BetHistoryCard";
import { BillingNoticeCard } from "@/features/account/components/BillingNoticeCard";
import { AccountSummaryCard } from "@/features/account/components/AccountSummaryCard";
import {
  formatBonusExpiry,
  formatEuros,
  type Bet,
  type BillingNotice,
} from "@/features/account/lib/bets-model";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";
import { ReferralCard } from "@/components/ui/ReferralCard";
import { UserStreakCard } from "@/components/ui/UserStreakCard";

function MesParisFallback() {
  return <div className="min-h-[60vh] w-full rounded-[2rem] bg-transparent" />;
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
  const [premiumAccessExpiresAt, setPremiumAccessExpiresAt] = useState<string | null>(
    null
  );
  const [billingNotice, setBillingNotice] = useState<BillingNotice | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [autoCheckoutStarted, setAutoCheckoutStarted] = useState(false);

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

        const response = await fetch("/api/bets", {
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
        } = await response.json();

        if (signal?.aborted) {
          return;
        }

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Reponse paris invalide.");
        }

        setBets(asArray<Bet>(payload.bets));
        setSolde(
          typeof payload.solde === "number" && Number.isFinite(payload.solde)
            ? payload.solde
            : 1000
        );
        setIsStripeSubscribed(Boolean(payload.isStripeSubscribed));
        setAccessSource(payload.accessSource ?? "FREE");
        setSubscriptionStatus(payload.subscriptionStatus ?? "FREE");
        setPremiumAccessExpiresAt(
          typeof payload.premiumAccessExpiresAt === "string"
            ? payload.premiumAccessExpiresAt
            : null
        );
      } catch (loadError) {
        if (signal?.aborted) {
          return;
        }
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger l'espace paris."
        );
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
    const abortController = new AbortController();
    void fetchBets(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchBets, fetchRevision]);

  useEffect(() => {
    let cancelled = false;

    async function handleSubscriptionReturn() {
      const subscriptionFlag = searchParams.get("subscription");
      const sessionId = searchParams.get("session_id");

      if (subscriptionFlag === "cancel") {
        setBillingNotice({
          tone: "warning",
          title: "Paiement annule",
          message:
            "Le paiement a ete interrompu. Ton compte reste sur l'offre gratuite tant que l'abonnement n'est pas confirme.",
        });
        router.replace(searchParams.get("next") || "/dashboard");
        return;
      }

      if (subscriptionFlag !== "success") {
        return;
      }

      setBillingNotice({
        tone: "loading",
        title: "Verification du paiement",
        message:
          "Nous confirmons ton abonnement premium avec Stripe avant d'ouvrir l'acces complet.",
      });

      if (!sessionId || !supabaseConfigured) {
        if (!cancelled) {
          setBillingNotice({
            tone: "warning",
            title: "Retour paiement detecte",
            message:
              "Le paiement est revenu de Stripe, mais la confirmation automatique est incomplete. Recharge la page dans quelques secondes.",
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
              message:
                "Reconnecte-toi pour finaliser l'activation de l'abonnement.",
            });
          }
          return;
        }

        const response = await fetch(
          `/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
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
                  message:
                    "Paiement confirme. Ton abonnement premium est maintenant actif et tes acces ont bien ete ouverts.",
                }
              : {
                  tone: "loading",
                  title: "Paiement recu",
                  message:
                    "Le paiement est revenu, mais l'activation finale est encore en cours. Recharge la page dans quelques secondes.",
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
                : "Le paiement est revenu de Stripe, mais la confirmation automatique a echoue.",
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
        const redirectTarget = action === "checkout" ? "/premium" : "/mes-paris";
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
        setError(
          billingError instanceof Error ? billingError.message : "Billing indisponible"
        );
      } finally {
        setBillingLoading(false);
      }
    },
    [router, supabaseConfigured]
  );

  useEffect(() => {
    if (
      !autoCheckoutRequested ||
      autoCheckoutStarted ||
      loading ||
      billingLoading ||
      !user
    ) {
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
  const pendingCount = useMemo(
    () => bets.filter((bet) => bet.statut === "EN_ATTENTE").length,
    [bets]
  );
  const wonCount = useMemo(
    () => bets.filter((bet) => bet.statut === "GAGNE").length,
    [bets]
  );
  const placedCount = useMemo(
    () => bets.filter((bet) => bet.statut === "PLACE").length,
    [bets]
  );
  const totalGain = useMemo(
    () =>
      bets
        .filter((bet) => bet.gain !== null)
        .reduce((sum, bet) => sum + (bet.gain || 0), 0),
    [bets]
  );
  const accessBadge = isStripeSubscribed
    ? `Abonnement ${subscriptionStatus}`
    : hasBonusAccess
      ? "Acces bonus actif"
      : "Compte gratuit";

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.1fr,0.9fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                Mes Paris
              </span>
              <span className="app-pill text-xs">{accessBadge}</span>
              <span className="app-pill text-xs">{bets.length} tickets</span>
            </div>

            <div>
              <p className="app-kicker">Cockpit perso</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                Un seul espace pour la bankroll, les tickets et l&apos;acces premium.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                Tu retrouves ici le solde, l&apos;etat de l&apos;abonnement, les tickets
                en attente, l&apos;historique et les bonus de parrainage sans changer
                d&apos;ecran.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {pendingCount > 0 ? (
                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={settling}
                  className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {settling
                    ? "Verification..."
                    : `Verifier les resultats (${pendingCount})`}
                </button>
              ) : (
                <Link href="/" className="app-button-primary">
                  Revenir aux courses
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="app-button-secondary"
              >
                Deconnexion
              </button>
            </div>
          </div>

          <aside className="app-card p-5 md:p-6">
            <p className="app-kicker">Solde actuel</p>
            <div className="mt-4 text-[3.35rem] font-black leading-none text-[var(--pmu-text)]">
              {formatEuros(solde)}
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {user?.email ?? "Compte utilisateur"}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Tickets gagnes</p>
                <p className="mt-2 text-2xl font-black text-[var(--pmu-primary)]">
                  {wonCount}
                </p>
              </div>
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Tickets places</p>
                <p className="mt-2 text-2xl font-black text-[var(--pmu-orange)]">
                  {placedCount}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_90%,transparent)] p-4">
              <div className="inline-flex rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--pmu-text-soft)]">
                {accessBadge}
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                {isStripeSubscribed
                  ? "Ton espace premium est actif: pronostics complets, mises, tickets detailles et gestion Stripe."
                  : hasBonusAccess
                    ? `Ton acces bonus est actif${
                        bonusExpiryLabel ? ` jusqu'au ${bonusExpiryLabel}` : ""
                      }. Tu peux deja voir les pronostics complets ou passer au mensuel quand tu veux.`
                    : "Passe en premium pour debloquer les opportunites value filtrees, les mises Kelly et la lecture complete des tickets."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {isStripeSubscribed ? (
                  <button
                    type="button"
                    onClick={() => handleBilling("portal")}
                    disabled={billingLoading}
                    className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {billingLoading ? "Ouverture..." : "Gerer l'abonnement"}
                  </button>
                ) : (
                  <Link href="/premium" className="app-button-primary">
                    Passer PRO
                  </Link>
                )}
                {!isStripeSubscribed ? (
                  <Link href="/premium" className="app-button-secondary">
                    Voir l&apos;offre
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="app-card h-36 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
            />
          ))}
        </section>
      ) : error ? (
        <section className="app-card p-6 md:p-7">
          <p className="app-kicker">Mes Paris</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
            Impossible de charger l&apos;espace perso
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
            {error}
          </p>
          <button
            type="button"
            className="app-button-primary mt-5"
            onClick={() => setFetchRevision((revision) => revision + 1)}
          >
            Reessayer
          </button>
        </section>
      ) : (
        <>
          {billingNotice ? <BillingNoticeCard notice={billingNotice} /> : null}

          <section className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
            <UserStreakCard />

            <section className="grid gap-4 sm:grid-cols-2">
              <AccountSummaryCard label="En attente" value={pendingCount} tone="warn" />
              <AccountSummaryCard label="Gagnes" value={wonCount} tone="good" />
              <AccountSummaryCard label="Places" value={placedCount} tone="warn" />
              <AccountSummaryCard
                label="P/L"
                value={
                  totalGain >= 0
                    ? `+${formatEuros(totalGain)}`
                    : formatEuros(totalGain)
                }
                tone={totalGain >= 0 ? "good" : "bad"}
              />
            </section>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
            <section className="app-card p-5 md:p-6">
              <div className="app-section-heading">
                <div>
                  <p className="app-kicker">Lecture compte</p>
                  <h2 className="app-section-title">Etat de l&apos;espace personnel</h2>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Source d&apos;acces</p>
                  <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                    {accessSource}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Statut abonnement</p>
                  <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                    {subscriptionStatus}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Tickets joues</p>
                  <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                    {bets.length}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Bonus actif</p>
                  <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                    {hasBonusAccess
                      ? bonusExpiryLabel
                        ? `Jusqu'au ${bonusExpiryLabel}`
                        : "Oui"
                      : "Non"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] p-5">
                <p className="app-kicker">Cadre</p>
                <h3 className="mt-2 text-2xl font-black leading-[1.02] text-[var(--pmu-text)]">
                  Le compte sert a executer proprement, pas a empiler des tickets.
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                  Tu suis le solde, tu regles les tickets en attente, tu geres
                  l&apos;abonnement et tu gardes l&apos;historique au meme endroit.
                </p>
              </div>
            </section>

            <ReferralCard />
          </section>

          <section className="space-y-4">
            <div className="app-section-heading">
              <div>
                <p className="app-kicker">Historique</p>
                <h2 className="app-section-title">Tous les tickets gardes au propre</h2>
              </div>
            </div>

            {bets.length === 0 ? (
              <section className="app-card p-8 text-center">
                <p className="text-xl font-black text-[var(--pmu-text)]">
                  Aucun pari pour l&apos;instant
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                  Ouvre une course pour poser ton premier ticket et commencer ton suivi.
                </p>
                <Link href="/" className="app-button-primary mt-5 inline-flex">
                  Voir les courses
                </Link>
              </section>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {bets.map((bet) => (
                  <BetHistoryCard key={bet.id} bet={bet} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
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
