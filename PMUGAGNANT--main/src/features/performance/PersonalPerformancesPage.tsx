"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";
import { STATUS_CONFIG, type Bet } from "@/features/account/lib/bets-model";

type BetsPayload = {
  success?: boolean;
  bets?: Bet[];
  error?: string;
};

function formatMoney(value: number, signed = false) {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: string) {
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getBetProfit(bet: Bet) {
  if (bet.gain === null) {
    return null;
  }

  return bet.gain - bet.mise;
}

function getStatusLabel(status: string) {
  return STATUS_CONFIG[status]?.label ?? status;
}

export default function PersonalPerformancesPage() {
  const [bets, setBets] = useState<Bet[]>([]);
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

  const visibleBets = useMemo(() => bets.slice(0, 30), [bets]);
  const settled = visibleBets.filter((bet) => bet.gain !== null);
  const totalStake = settled.reduce((sum, bet) => sum + bet.mise, 0);
  const totalGain = settled.reduce((sum, bet) => sum + (bet.gain ?? 0), 0);
  const totalProfit = totalGain - totalStake;
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
  const wonCount = settled.filter((bet) => (getBetProfit(bet) ?? 0) > 0).length;
  const lostCount = settled.filter((bet) => (getBetProfit(bet) ?? 0) < 0).length;

  return (
    <main className="min-h-screen bg-[#0A0E1A] px-4 py-6 text-[#F6F2E8]">
      <section className="mx-auto grid max-w-[90rem] gap-5">
        <div className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5 shadow-2xl shadow-black/25 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-[#D4AF37]">
                Performances personnelles
              </p>
              <h1 className="mt-2 font-[var(--font-display)] text-5xl font-black leading-none text-[#F6F2E8] md:text-6xl">
                Tes 30 derniers paris
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-400">
                Course, cheval joue, cote, mise, resultat et gain/perte reel depuis Supabase.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-[#D4AF37]/35 px-4 py-2 text-sm font-black text-[#D4AF37]"
            >
              Retour dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-white/10 bg-[#101827] p-6 font-bold text-slate-400">
            Chargement de l&apos;historique...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[#FF4D5A]/35 bg-[#FF4D5A]/10 p-6 font-bold text-[#FCA5A5]">
            {error}
          </div>
        ) : visibleBets.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#101827] p-6">
            <p className="font-black text-[#F6F2E8]">Aucun pari enregistre.</p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              Ouvre une fiche course et clique sur &quot;Je joue ce ticket&quot; pour construire ton historique.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-[#101827] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Bilan net</p>
                <strong className={`mt-2 block font-[var(--font-display)] text-4xl font-black ${totalProfit >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
                  {formatMoney(totalProfit, true)}
                </strong>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#101827] p-4">
                <p className="text-xs font-black uppercase text-slate-400">ROI reel</p>
                <strong className={`mt-2 block font-[var(--font-display)] text-4xl font-black ${roi >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
                  {roi >= 0 ? "+" : ""}
                  {roi.toFixed(0)}%
                </strong>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#101827] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Paris regles</p>
                <strong className="mt-2 block font-[var(--font-display)] text-4xl font-black text-[#F6F2E8]">
                  {settled.length}/{visibleBets.length}
                </strong>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#101827] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Gagnes / perdus</p>
                <strong className="mt-2 block font-[var(--font-display)] text-4xl font-black text-[#D4AF37]">
                  {wonCount}/{lostCount}
                </strong>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#101827] shadow-2xl shadow-black/25">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[62rem] border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-400">
                      <th className="px-4 py-3 font-black">Date</th>
                      <th className="px-4 py-3 font-black">Course</th>
                      <th className="px-4 py-3 font-black">Cheval joue</th>
                      <th className="px-4 py-3 font-black">Pari</th>
                      <th className="px-4 py-3 font-black">Cote</th>
                      <th className="px-4 py-3 font-black">Mise</th>
                      <th className="px-4 py-3 font-black">Resultat</th>
                      <th className="px-4 py-3 text-right font-black">Gain/Perte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBets.map((bet) => {
                      const profit = getBetProfit(bet);
                      const won = profit !== null && profit > 0;
                      const lost = profit !== null && profit < 0;

                      return (
                        <tr
                          key={bet.id}
                          className={`border-t border-white/10 ${
                            won ? "bg-[#00C851]/8" : lost ? "bg-[#FF4D5A]/8" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-bold text-slate-400">
                            {formatDate(bet.date_str)}
                          </td>
                          <td className="px-4 py-3">
                            <strong className="block text-sm font-black">
                              R{bet.reunion}C{bet.course}
                            </strong>
                            <span className="text-xs font-bold text-slate-500">
                              {bet.hippodrome} · {bet.heure_depart}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold">{bet.cheval_nom}</td>
                          <td className="px-4 py-3 text-sm font-black text-slate-300">
                            {bet.type_pari}
                          </td>
                          <td className="px-4 py-3 font-[var(--font-display)] text-xl font-black text-[#D4AF37]">
                            {bet.cote.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 font-bold">{formatMoney(bet.mise)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                                won
                                  ? "border-[#00C851]/30 bg-[#00C851]/10 text-[#00C851]"
                                  : lost
                                    ? "border-[#FF4D5A]/30 bg-[#FF4D5A]/10 text-[#FF4D5A]"
                                    : "border-white/10 bg-white/[0.04] text-slate-400"
                              }`}
                            >
                              {getStatusLabel(bet.statut)}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-black ${profit === null ? "text-slate-500" : profit >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
                            {profit === null ? "En attente" : formatMoney(profit, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 border-t border-white/10 p-5 text-sm font-bold text-slate-300 md:grid-cols-4">
                <p>Mise totale: <strong className="text-[#F6F2E8]">{formatMoney(totalStake)}</strong></p>
                <p>Gains retournes: <strong className="text-[#F6F2E8]">{formatMoney(totalGain)}</strong></p>
                <p>Bilan: <strong className={totalProfit >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}>{formatMoney(totalProfit, true)}</strong></p>
                <p>ROI: <strong className={roi >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}>{roi >= 0 ? "+" : ""}{roi.toFixed(0)}%</strong></p>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
