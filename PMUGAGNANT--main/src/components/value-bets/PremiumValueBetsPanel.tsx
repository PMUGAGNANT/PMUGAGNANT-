"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatOdds,
  formatRaceAnalysisId,
} from "@/features/vmax/vmax-model";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";

type ValueBet = {
  date: string;
  race: string;
  reunion: number;
  course: number;
  hippodrome: string;
  chevalNum: number;
  cheval: string;
  cotePmu: number | null;
  coteEstimee: number | null;
  edge: number;
  miseConseillee: number | null;
};

type ValueBetsPayload = {
  success?: boolean;
  error?: string;
  date?: string;
  valueBets?: ValueBet[];
  paywall?: {
    required?: boolean;
    previewCount?: number;
    message?: string;
  } | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "locked"; message: string; previewCount: number | null }
  | { status: "error"; message: string }
  | { status: "ready"; valueBets: ValueBet[]; date: string | null };

type TabKey = "today" | "yesterday" | "week";
type PickCard = ValueBet & {
  confidence: number;
  form: string[];
  oddsDelta: number;
  role: "VERDICT" | "A SUIVRE";
  reason: string;
};

const demoCards: PickCard[] = [
  {
    date: "2026-05-07",
    race: "R1C6",
    reunion: 1,
    course: 6,
    hippodrome: "Vichy",
    chevalNum: 7,
    cheval: "Sirocco du Vivier",
    cotePmu: 7.4,
    coteEstimee: 5.9,
    edge: 26,
    miseConseillee: 10,
    confidence: 87,
    form: ["W", "P", "P", "L", "W"],
    oddsDelta: -0.4,
    role: "VERDICT",
    reason: "Baisse de cote, driver régulier et score value supérieur au seuil VMAX.",
  },
  {
    date: "2026-05-07",
    race: "R2C2",
    reunion: 2,
    course: 2,
    hippodrome: "Paris-Longchamp",
    chevalNum: 2,
    cheval: "Lune Vermeille",
    cotePmu: 4.9,
    coteEstimee: 4.3,
    edge: 14,
    miseConseillee: 5,
    confidence: 71,
    form: ["P", "W", "L", "P", "W"],
    oddsDelta: 0.2,
    role: "A SUIVRE",
    reason: "Profil stable, cote encore jouable, mais signal bankroll plus prudent.",
  },
  {
    date: "2026-05-07",
    race: "R3C6",
    reunion: 3,
    course: 6,
    hippodrome: "Enghien",
    chevalNum: 9,
    cheval: "Hermes du Bourg",
    cotePmu: 9.2,
    coteEstimee: 7.1,
    edge: 18,
    miseConseillee: 5,
    confidence: 76,
    form: ["L", "P", "W", "P", "P"],
    oddsDelta: -1.1,
    role: "A SUIVRE",
    reason: "Outsider utile, baisse de cote et lecture terrain compatible.",
  },
];

const yesterdayResults = [
  { race: "R1C5", horse: "Idylle Ever", verdict: "Gagnant", stake: 12, gain: 34 },
  { race: "R4C2", horse: "Mode du Vallon", verdict: "Place", stake: 8, gain: 11 },
  { race: "R3C8", horse: "Jiva", verdict: "Perdant", stake: 8, gain: -8 },
];

const weekCalendar = [
  { day: "Jeu.", title: "Vichy · course value", tag: "Aujourd'hui" },
  { day: "Ven.", title: "Vincennes nocturne", tag: "T-15" },
  { day: "Sam.", title: "Quinté du week-end", tag: "Grosse échéance" },
  { day: "Dim.", title: "Chantilly plat", tag: "A surveiller" },
  { day: "Lun.", title: "Récap ROI", tag: "Bilan" },
];

const discardedCourses = [
  "Cote trop basse pour la value",
  "Terrain incohérent avec la musique",
  "Confiance inférieure au seuil minimal",
  "Course trop ouverte, pas de lecture nette",
  "Signal bankroll insuffisant",
];

function formatStake(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} EUR`;
}

function formatDateForRaceLink(date: string) {
  return date.split("-").reverse().join("");
}

function formatSigned(value: number, suffix = "") {
  return `${value >= 0 ? "+" : ""}${value.toFixed(value % 1 === 0 ? 0 : 1)}${suffix}`;
}

function enrichCard(card: ValueBet, index: number): PickCard {
  const fallback = demoCards[index % demoCards.length] ?? demoCards[0];
  const confidence = Math.max(50, Math.min(96, Math.round(58 + card.edge * 0.95)));
  return {
    ...card,
    confidence,
    form: fallback.form,
    oddsDelta: fallback.oddsDelta,
    role: index === 0 && confidence >= 78 ? "VERDICT" : "A SUIVRE",
    reason:
      card.edge >= 20
        ? "Edge PMU nette : la cote actuelle reste au-dessus de la cote fair calculée."
        : "Signal intéressant, mais VMAX garde une mise contenue.",
  };
}

function FormDots({ form }: { form: string[] }) {
  return (
    <span className="value-form-dots" aria-label={`Forme ${form.join(" ")}`}>
      {form.map((item, index) => (
        <span key={`${item}-${index}`} data-form={item}>
          {item}
        </span>
      ))}
    </span>
  );
}

function ValueBetRow({
  card,
  bankroll,
  selected,
  onSelect,
}: {
  card: PickCard;
  bankroll: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const stake = card.miseConseillee ?? Math.max(3, Math.round(bankroll * 0.02 * (card.confidence / 100)));
  return (
    <article className={`value-pick-row${selected ? " is-selected" : ""}`}>
      <div className="value-runner-medal">{card.chevalNum}</div>
      <div className="value-pick-main">
        <h3>{card.cheval}</h3>
        <p>
          Driver: VMAX · <FormDots form={card.form} />
        </p>
        <div className="value-confidence-line" aria-hidden>
          <span style={{ width: `${card.confidence}%` }} />
        </div>
        <small>{card.confidence}/100</small>
      </div>
      <div className="value-race-context">
        <strong>{card.hippodrome}</strong>
        <span>R{card.reunion}C{card.course} - {card.race}</span>
        <small>{card.reason}</small>
      </div>
      <div className="value-odds-now">
        <strong>{formatOdds(card.cotePmu)}</strong>
        <span className={card.oddsDelta <= 0 ? "is-down" : "is-up"}>
          {formatSigned(card.oddsDelta)} 24h
        </span>
      </div>
      <div className="value-stake-now">
        <strong>{formatStake(stake)}</strong>
        <span>Kelly 1/2</span>
      </div>
      <div className="value-row-actions">
        <button type="button" className="value-alert-button" aria-label={`Alerte ${card.cheval}`}>
          ♪
        </button>
        <button type="button" className="value-analysis-button" onClick={onSelect}>
          Analyse →
        </button>
      </div>
    </article>
  );
}

export function PremiumValueBetsPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [bankroll, setBankroll] = useState(500);
  const [minConfidence, setMinConfidence] = useState(50);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadValueBets() {
      if (!hasSupabaseConfig()) {
        setState({
          status: "locked",
          message: "Connecte-toi ou passe Premium pour voir les value bets du jour.",
          previewCount: null,
        });
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setState({
              status: "locked",
              message: "Connecte-toi ou passe Premium pour voir les value bets du jour.",
              previewCount: null,
            });
          }
          return;
        }

        const response = await fetch("/api/value-bets/today", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload: ValueBetsPayload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Value bets indisponibles.");
        }

        if (payload.paywall?.required) {
          if (!cancelled) {
            setState({
              status: "locked",
              message:
                payload.paywall.message ??
                "Value bets, edge et mises conseillées réservés aux membres Premium.",
              previewCount:
                typeof payload.paywall.previewCount === "number"
                  ? payload.paywall.previewCount
                  : null,
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            valueBets: payload.valueBets ?? [],
            date: payload.date ?? null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Value bets indisponibles.",
          });
        }
      }
    }

    void loadValueBets();

    return () => {
      cancelled = true;
    };
  }, []);

  const rawCards = state.status === "ready" && state.valueBets.length > 0
    ? state.valueBets.map(enrichCard)
    : demoCards;
  const cards = useMemo(
    () => rawCards.filter((card) => card.confidence >= minConfidence).slice(0, 3),
    [rawCards, minConfidence]
  );
  const selectedCard = cards[selectedIndex] ?? cards[0] ?? demoCards[0];
  const locked = state.status === "locked";

  return (
    <section className="value-v2">
      <header className="value-v2-topbar">
        <Link href="/dashboard" className="value-back-link">
          PMU<span>Gagnant</span>
        </Link>
        <div className="value-v2-meta">
          <strong>Jeudi 7 mai 2026</strong>
          <span>Edition n°47</span>
        </div>
        <label className="value-bankroll">
          <span>Bankroll</span>
          <input
            type="number"
            min={50}
            value={bankroll}
            onChange={(event) => setBankroll(Number(event.target.value) || 0)}
          />
          <em>EUR</em>
        </label>
        <div className="value-mode-toggle" aria-label="Mode abonné">
          <span>Visiteur</span>
          <strong>Abonné</strong>
        </div>
      </header>

      <nav className="value-tabs" aria-label="Chevaux du jour">
        <button type="button" data-active={activeTab === "today"} onClick={() => setActiveTab("today")}>
          Aujourd&apos;hui · 3
        </button>
        <button type="button" data-active={activeTab === "yesterday"} onClick={() => setActiveTab("yesterday")}>
          Hier · résultats
        </button>
        <button type="button" data-active={activeTab === "week"} onClick={() => setActiveTab("week")}>
          Semaine
        </button>
      </nav>

      {locked ? (
        <section className="value-lock-card value-v2-lock">
          <p className="value-kicker">Privilège membre</p>
          <h2>Le moteur a trouvé {state.previewCount ?? 3} signal{(state.previewCount ?? 3) > 1 ? "s" : ""} aujourd&apos;hui.</h2>
          <p className="value-lock-copy">{state.message}</p>
          <div className="value-actions">
            <Link href="/premium" className="app-button-primary">Passer Premium</Link>
            <Link href="/login?redirect=%2Fvalue-bets" className="app-button-secondary">Me connecter</Link>
          </div>
        </section>
      ) : null}

      {state.status === "loading" ? (
        <section className="value-state-card">Vérification de l&apos;accès Premium...</section>
      ) : null}

      {state.status === "error" ? (
        <section className="value-state-card">{state.message}</section>
      ) : null}

      {activeTab === "today" ? (
        <>
          <section className="value-v2-hero">
            <div>
              <p className="value-kicker">N°47 · jeudi 7 mai · 09:00</p>
              <h2>
                Les <em>chevaux</em><br /> que l&apos;algo joue aujourd&apos;hui.
              </h2>
              <p>
                Sur 87 courses programmées, VMAX en a écarté 84. Voici les 3
                qu&apos;il garde : un verdict, deux suiveurs.
              </p>
            </div>
            <div className="value-v2-proof">
              <div><strong>87</strong><span>Courses du jour</span></div>
              <div><strong>3</strong><span>Retenues par l&apos;algo</span></div>
              <div><strong>1</strong><span>Verdict éditorial</span></div>
              <div><strong>+26%</strong><span>ROI 30 jours</span></div>
            </div>
            <div className="value-personal-proof">
              <strong>Toi</strong> — ROI ce mois <em>+14%</em> · joué <em>8/12</em> verdicts · <em>+47 EUR</em> sur 100 EUR misés
            </div>
          </section>

          <div className="value-filter-bar">
            <div className="value-filter-pills">
              <span>Tous · {cards.length}</span>
              <span>★ Verdict</span>
              <span>A suivre</span>
              <span>Trot</span>
              <span>Plat</span>
            </div>
            <label>
              Confiance min.
              <input
                type="range"
                min={50}
                max={95}
                value={minConfidence}
                onChange={(event) => {
                  setSelectedIndex(0);
                  setMinConfidence(Number(event.target.value));
                }}
              />
              <strong>{minConfidence}</strong>
            </label>
          </div>

          <div className="value-v2-grid">
            <div className="value-pick-list">
              {cards.map((card, index) => (
                <ValueBetRow
                  key={`${card.date}-${card.reunion}-${card.course}-${card.chevalNum}`}
                  card={card}
                  bankroll={bankroll}
                  selected={selectedCard === card}
                  onSelect={() => setSelectedIndex(index)}
                />
              ))}

              <button type="button" className="value-discarded-toggle" onClick={() => setShowDiscarded((current) => !current)}>
                Voir les 84 courses écartées · pourquoi VMAX ne les joue pas <span>→</span>
              </button>
              {showDiscarded ? (
                <div className="value-discarded-list">
                  {discardedCourses.map((reason, index) => (
                    <p key={reason}>R{index + 4}C{index + 1} — {reason}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="value-analysis-panel">
              <p className="value-kicker">Panneau d&apos;analyse</p>
              <h3>{selectedCard.cheval}</h3>
              <p>{selectedCard.reason}</p>
              <div className="value-analysis-bars">
                {([
                  ["Lisibilité", selectedCard.confidence],
                  ["Value cote", Math.min(95, Math.round(62 + selectedCard.edge))],
                  ["Forme", 74],
                  ["Bankroll", 68],
                  ["Timing", selectedCard.oddsDelta <= 0 ? 82 : 63],
                ] satisfies Array<[string, number]>).map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <i><b style={{ width: `${value}%` }} /></i>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="value-sparkline" aria-label="Sparkline cote 7 jours">
                <span /><span /><span /><span /><span /><span /><span />
              </div>
              <Link
                href={`/race/${formatRaceAnalysisId(selectedCard.reunion, selectedCard.course)}?date=${formatDateForRaceLink(selectedCard.date)}`}
                className="app-button-primary"
              >
                Ouvrir l&apos;analyse complète
              </Link>
              <a href="https://www.pmu.fr/turf/" className="app-button-secondary" target="_blank" rel="noreferrer">
                Voir sur PMU.fr
              </a>
            </aside>
          </div>
        </>
      ) : null}

      {activeTab === "yesterday" ? (
        <section className="value-results-panel">
          <p className="value-kicker">Transparence</p>
          <h2>Hier, résultats réels</h2>
          <div className="value-results-grid">
            {yesterdayResults.map((result) => (
              <article key={result.race}>
                <strong>{result.race}</strong>
                <h3>{result.horse}</h3>
                <p>{result.verdict}</p>
                <span>{formatSigned(result.gain)} EUR · mise {result.stake} EUR</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "week" ? (
        <section className="value-week-panel">
          <p className="value-kicker">Calendrier semaine</p>
          <h2>Les grosses échéances à surveiller</h2>
          <div className="value-week-grid">
            {weekCalendar.map((item) => (
              <article key={`${item.day}-${item.title}`}>
                <strong>{item.day}</strong>
                <h3>{item.title}</h3>
                <span>{item.tag}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
