"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AdminDashboardData, AdminPerformanceGroup } from "@/lib/admin-dashboard";

type AdminResponse =
  | { success: true; dashboard: AdminDashboardData }
  | { success: false; error: string };

const STORAGE_KEY = "turfedge-admin-password";

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function resultClass(result: string) {
  if (result === "GAGNANT") return "bg-emerald-600 text-white";
  if (result === "PLACE") return "bg-lime-100 text-lime-800";
  if (result === "PERDU") return "bg-rose-100 text-rose-700";
  return "bg-stone-100 text-stone-600";
}

function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "green" | "gold";
}) {
  const toneClass =
    tone === "green"
      ? "from-emerald-600 to-emerald-500 text-white"
      : tone === "gold"
        ? "from-amber-300 to-yellow-500 text-stone-950"
        : "from-white to-stone-50 text-stone-950";

  return (
    <article className={`rounded-[8px] bg-gradient-to-br ${toneClass} p-5 shadow-[0_18px_50px_rgba(16,24,40,0.10)]`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm font-medium opacity-75">{hint}</p>
    </article>
  );
}

function GroupTable({ title, rows }: { title: string; rows: AdminPerformanceGroup[] }) {
  return (
    <section className="rounded-[8px] border border-stone-200 bg-white p-5 shadow-[0_16px_45px_rgba(16,24,40,0.08)]">
      <h2 className="text-lg font-black text-stone-950">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-stone-500">
            <tr>
              <th className="py-3 pr-4">Segment</th>
              <th className="py-3 pr-4">Paris</th>
              <th className="py-3 pr-4">Reussite</th>
              <th className="py-3 pr-4">ROI</th>
              <th className="py-3 pr-4">Gain net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 text-stone-500" colSpan={5}>
                  Pas encore assez de donnees notees.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label}>
                  <td className="py-3 pr-4 font-bold text-stone-950">{row.label}</td>
                  <td className="py-3 pr-4 text-stone-700">{row.bets}</td>
                  <td className="py-3 pr-4 text-stone-700">{row.hitRate.toFixed(1)}%</td>
                  <td className="py-3 pr-4 font-bold text-emerald-700">{formatPercent(row.roi)}</td>
                  <td className="py-3 pr-4 font-bold text-stone-950">{formatMoney(row.netGain)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard(secret: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dashboard", {
        headers: {
          "x-admin-password": secret,
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as AdminResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Erreur admin." : payload.error);
      }

      window.sessionStorage.setItem(STORAGE_KEY, secret);
      setDashboard(payload.dashboard);
    } catch (loadError) {
      setDashboard(null);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le cockpit.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPassword(saved);
      void loadDashboard(saved);
    }
  }, []);

  const bestRaceText = useMemo(() => {
    if (!dashboard?.bestRace) {
      return "En attente de resultats";
    }

    return `${dashboard.bestRace.raceLabel} ${dashboard.bestRace.hippodrome}`;
  }, [dashboard]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDashboard(password.trim());
  }

  if (!dashboard) {
    return (
      <main className="min-h-screen bg-[#fbfaf6] px-4 py-10 text-stone-950 sm:px-6">
        <section className="mx-auto flex min-h-[72vh] max-w-xl flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Admin TurfEdge</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Cockpit prive.
          </h1>
          <p className="mt-4 text-base font-medium leading-7 text-stone-600">
            Connecte-toi pour suivre les utilisateurs, les abonnes premium, les revenus Stripe
            et la notation automatique des pronostics.
          </p>
          <form onSubmit={onSubmit} className="mt-8 rounded-[8px] border border-stone-200 bg-white p-5 shadow-[0_18px_55px_rgba(16,24,40,0.10)]">
            <label className="text-sm font-bold text-stone-700" htmlFor="admin-password">
              Mot de passe admin
            </label>
            <input
              id="admin-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-[8px] border border-stone-300 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              placeholder="ADMIN_PASSWORD"
            />
            {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <button
              type="submit"
              disabled={loading || password.trim().length === 0}
              className="mt-5 w-full rounded-[8px] bg-emerald-700 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_35px_rgba(4,120,87,0.22)] transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Chargement..." : "Ouvrir le cockpit"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf6] px-4 py-8 text-stone-950 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Admin TurfEdge</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Pilotage business et algo
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-stone-600">
              Donnees live: abonnements, revenus, ROI, notation des courses terminees et historique
              par type de course et hippodrome.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard(password)}
            className="rounded-[8px] border border-stone-300 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-stone-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500"
          >
            Rafraichir
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Utilisateurs" value={String(dashboard.users.totalUsers)} hint={`${dashboard.users.premiumSubscribers} abonnes premium`} />
          <KpiCard label="Revenus Stripe" value={dashboard.stripe.formattedRevenue} hint={`${dashboard.stripe.chargesCount} paiements analyses`} tone="gold" />
          <KpiCard label="ROI 30 jours" value={formatPercent(dashboard.performance.roi)} hint={`${formatMoney(dashboard.performance.netGain)} de gain net`} tone="green" />
          <KpiCard label="Reussite algo" value={`${dashboard.performance.successRate.toFixed(1)}%`} hint={`${dashboard.performance.validatedBets} paris notes`} />
        </div>

        {!dashboard.stripe.available && dashboard.stripe.error ? (
          <div className="mt-5 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Stripe: {dashboard.stripe.error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[8px] border border-stone-200 bg-white p-5 shadow-[0_16px_45px_rgba(16,24,40,0.08)]">
            <h2 className="text-lg font-black text-stone-950">Performance temps reel</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {dashboard.rangeSummaries.map((summary) => (
                <div key={summary.label} className="rounded-[8px] bg-stone-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">{summary.label}</p>
                  <p className="mt-2 text-2xl font-black text-emerald-700">{formatPercent(summary.roi)}</p>
                  <p className="mt-1 text-sm font-semibold text-stone-600">
                    {formatMoney(summary.netGain)} sur {summary.bets} paris
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[8px] border border-stone-200 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Meilleure course</p>
                <p className="mt-2 text-lg font-black text-stone-950">{bestRaceText}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {dashboard.bestRace ? formatMoney(dashboard.bestRace.netGain) : "Aucun gain note"}
                </p>
              </div>
              <div className="rounded-[8px] border border-stone-200 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Calibration</p>
                <p className="mt-2 text-lg font-black text-stone-950">{dashboard.performance.calibrationError.toFixed(1)} pts</p>
                <p className="mt-1 text-sm font-semibold text-stone-600">Ecart proba vs reel</p>
              </div>
              <div className="rounded-[8px] border border-stone-200 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">En attente</p>
                <p className="mt-2 text-lg font-black text-stone-950">{dashboard.performance.pendingBets}</p>
                <p className="mt-1 text-sm font-semibold text-stone-600">Paris a noter</p>
              </div>
            </div>
          </section>

          <section className="rounded-[8px] border border-stone-200 bg-white p-5 shadow-[0_16px_45px_rgba(16,24,40,0.08)]">
            <h2 className="text-lg font-black text-stone-950">Dernieres predictions</h2>
            <div className="mt-4 space-y-3">
              {dashboard.latestPredictions.slice(0, 6).map((prediction) => (
                <article key={prediction.id} className="rounded-[8px] border border-stone-100 bg-stone-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-stone-950">{prediction.cheval}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {prediction.date} - {prediction.raceLabel} - {prediction.hippodrome}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${resultClass(prediction.result)}`}>
                      {prediction.result}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm font-bold">
                    <span>Confiance {prediction.confidence.toFixed(1)}/10</span>
                    <span>{formatMoney(prediction.netGain)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <GroupTable title="Par type de pari" rows={dashboard.byBetType} />
          <GroupTable title="Par type de course" rows={dashboard.byCourseType} />
          <GroupTable title="Par hippodrome" rows={dashboard.byHippodrome} />
        </div>

        <section className="mt-6 rounded-[8px] border border-stone-200 bg-white p-5 shadow-[0_16px_45px_rgba(16,24,40,0.08)]">
          <h2 className="text-lg font-black text-stone-950">Historique des dernieres predictions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-stone-500">
                <tr>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Course</th>
                  <th className="py-3 pr-4">Pronostic</th>
                  <th className="py-3 pr-4">Pari</th>
                  <th className="py-3 pr-4">Mise</th>
                  <th className="py-3 pr-4">Gain</th>
                  <th className="py-3 pr-4">Resultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dashboard.latestPredictions.map((prediction) => (
                  <tr key={prediction.id}>
                    <td className="py-3 pr-4 font-semibold text-stone-600">{prediction.date}</td>
                    <td className="py-3 pr-4 font-bold text-stone-950">{prediction.raceLabel} {prediction.hippodrome}</td>
                    <td className="py-3 pr-4 font-bold text-stone-950">{prediction.cheval}</td>
                    <td className="py-3 pr-4 text-stone-700">{prediction.betType ?? "-"}</td>
                    <td className="py-3 pr-4 text-stone-700">{formatMoney(prediction.stake)}</td>
                    <td className="py-3 pr-4 font-bold text-stone-950">{formatMoney(prediction.gain)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${resultClass(prediction.result)}`}>
                        {prediction.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs font-semibold text-stone-500">
            Derniere course notee: {dashboard.performance.lastSettledDate ?? "aucune"} - genere le {new Date(dashboard.generatedAt).toLocaleString("fr-FR")}
          </p>
        </section>
      </section>
    </main>
  );
}
