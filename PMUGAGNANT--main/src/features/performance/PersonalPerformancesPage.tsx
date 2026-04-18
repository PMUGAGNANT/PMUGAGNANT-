"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";
import type { Bet } from "@/features/account/lib/bets-model";

type BetsPayload = {
  success?: boolean;
  bets?: Bet[];
  isSubscribed?: boolean;
  error?: string;
};

function formatEuros(value: number) {
  return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function getBetProfit(bet: Bet) {
  if (bet.gain === null) {
    return 0;
  }

  return bet.gain - bet.mise;
}

function isSettled(bet: Bet) {
  return bet.statut !== "EN_ATTENTE";
}

function isInsideFreeWindow(bet: Bet) {
  const createdAt = new Date(bet.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  return createdAt.getTime() >= sevenDaysAgo;
}

export default function PersonalPerformancesPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBets() {
      if (!hasSupabaseConfig()) {
        setError(getSupabaseConfigError());
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("Connecte-toi pour voir ton historique personnel.");
          setLoading(false);
          return;
        }

        const response = await fetch("/api/bets", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload: BetsPayload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Historique indisponible.");
        }

        if (!cancelled) {
          setBets(payload.bets ?? []);
          setIsSubscribed(Boolean(payload.isSubscribed));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Historique indisponible.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBets();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleBets = useMemo(() => {
    const scoped = isSubscribed ? bets : bets.filter(isInsideFreeWindow);
    return scoped.slice(0, 30);
  }, [bets, isSubscribed]);
  const settled = visibleBets.filter(isSettled);
  const totalStake = settled.reduce((sum, bet) => sum + bet.mise, 0);
  const totalProfit = settled.reduce((sum, bet) => sum + getBetProfit(bet), 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  return (
    <main className="min-h-screen bg-[#0A0E1A] px-4 py-6 text-[#F6F2E8]">
      <section className="mx-auto grid max-w-[90rem] gap-5">
        <div className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5 shadow-2xl shadow-black/25 md:p-7">
          <p className="text-xs font-black uppercase text-[#D4AF37]">Historique personnel</p>
          <h1 className="mt-2 font-[var(--font-display)] text-6xl font-black leading-none text-[#F6F2E8]">
            Tes 30 derniers paris
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-400">
            Course, cheval joué, cote, mise, résultat et gain net au même endroit.
          </p>
          {!isSubscribed ? (
            <div className="mt-4 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4">
              <p className="font-black text-[#D4AF37]">
                Compte gratuit: historique limité aux 7 derniers jours.
              </p>
              <Link
                href="/premium"
                className="mt-3 inline-flex rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-black text-[#0A0E1A]"
              >
                Passer PRO
              </Link>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-lg border border-white/10 bg-[#101827] p-6 font-bold text-slate-400">
            Chargement de l&apos;historique...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[#FF4D5A]/35 bg-[#FF4D5A]/10 p-6 font-bold text-[#FCA5A5]">
            {error}
          </div>
        ) : (
          <section className="rounded-lg border border-white/10 bg-[#101827] shadow-2xl shadow-black/25">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="px-4 py-3 font-black">Course</th>
                    <th className="px-4 py-3 font-black">Cheval joué</th>
                    <th className="px-4 py-3 font-black">Cote</th>
                    <th className="px-4 py-3 font-black">Mise</th>
                    <th className="px-4 py-3 font-black">Résultat</th>
                    <th className="px-4 py-3 text-right font-black">Gain/Perte</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBets.map((bet) => {
                    const profit = getBetProfit(bet);
                    const won = profit > 0;
                    const lost = isSettled(bet) && profit < 0;

                    return (
                      <tr
                        key={bet.id}
                        className={`border-t border-white/10 ${
                          won ? "bg-[#00C851]/8" : lost ? "bg-[#FF4D5A]/8" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-black">R{bet.reunion}C{bet.course}</td>
                        <td className="px-4 py-3 font-bold">{bet.cheval_nom}</td>
                        <td className="px-4 py-3 font-[var(--font-display)] text-xl font-black text-[#D4AF37]">
                          {bet.cote.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 font-bold">{bet.mise}€</td>
                        <td className="px-4 py-3 font-bold">{bet.statut}</td>
                        <td className={`px-4 py-3 text-right font-black ${profit >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
                          {formatEuros(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/10 p-5 text-right font-[var(--font-display)] text-3xl font-black">
              Bilan: {formatEuros(totalProfit)} sur {visibleBets.length} paris (ROI: {roi >= 0 ? "+" : ""}
              {roi.toFixed(0)}%)
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
