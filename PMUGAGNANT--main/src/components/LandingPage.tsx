"use client";

import Link from "next/link";
import { useEffect } from "react";

type LandingWindow = Window & {
  setProfil?: (profil: string) => void;
  updateSim?: () => void;
  updateVmax?: () => void;
  faq?: (id: string) => void;
  ckDismiss?: (value: string) => void;
};

const topCourses = [
  { code: "R1C6", track: "Vichy", name: "Prix d'Echassieres", time: "15:05", score: 92 },
  { code: "R4C3", track: "Vincennes", name: "Prix Anna", time: "19:27", score: 88 },
  { code: "R3C5", track: "Chantilly", name: "Prix du Terrain", time: "17:45", score: 84 },
];

const proofItems = [
  "Analyse IA en temps reel",
  "1 ticket prioritaire par jour",
  "Alertes T-15min avant la course",
];

export default function LandingPage() {
  useEffect(() => {
    const w = window as LandingWindow;

    const track = (eventName: string, params: Record<string, unknown> = {}) => {
      const maybeGtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      const maybeFbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      maybeGtag?.("event", eventName, params);
      maybeFbq?.("trackCustom", eventName, params);
    };

    w.setProfil = (profil: string) => {
      document.querySelectorAll<HTMLElement>("[data-profil]").forEach((button) => {
        button.dataset.active = button.dataset.profil === profil ? "true" : "false";
      });
      const multipliers: Record<string, number> = { prudent: 0.65, equilibre: 1, offensif: 1.35 };
      const bankroll = document.querySelector<HTMLInputElement>("#sim-bankroll");
      const stake = document.querySelector<HTMLInputElement>("#sim-stake");
      if (stake) stake.value = String(Math.round(Number(bankroll?.value ?? 300) * 0.02 * (multipliers[profil] ?? 1)));
      w.updateSim?.();
      track("landing_profil_click", { profil });
    };

    w.updateSim = () => {
      const bankroll = Number(document.querySelector<HTMLInputElement>("#sim-bankroll")?.value ?? 300);
      const stake = Number(document.querySelector<HTMLInputElement>("#sim-stake")?.value ?? 8);
      const hit = Number(document.querySelector<HTMLInputElement>("#sim-hit")?.value ?? 42);
      const tickets = 30;
      const projected = Math.round((stake * tickets * (hit / 100) * 2.1 - stake * tickets) * 10) / 10;
      const roi = Math.round((projected / Math.max(1, stake * tickets)) * 100);
      document.querySelectorAll<HTMLElement>("[data-sim-bankroll]").forEach((el) => (el.textContent = `${bankroll} EUR`));
      document.querySelectorAll<HTMLElement>("[data-sim-stake]").forEach((el) => (el.textContent = `${stake} EUR`));
      document.querySelectorAll<HTMLElement>("[data-sim-hit]").forEach((el) => (el.textContent = `${hit}%`));
      document.querySelectorAll<HTMLElement>("[data-sim-roi]").forEach((el) => (el.textContent = `${roi >= 0 ? "+" : ""}${roi}%`));
      document.querySelectorAll<HTMLElement>("[data-sim-gain]").forEach((el) => (el.textContent = `${projected >= 0 ? "+" : ""}${projected} EUR`));
    };

    w.updateVmax = () => {
      const lisibilite = Number(document.querySelector<HTMLInputElement>("#vmax-lisibilite")?.value ?? 72);
      const value = Number(document.querySelector<HTMLInputElement>("#vmax-value")?.value ?? 68);
      const fiabilite = Number(document.querySelector<HTMLInputElement>("#vmax-fiabilite")?.value ?? 76);
      const score = Math.round((lisibilite * 0.4 + value * 0.3 + fiabilite * 0.3) / 10);
      document.querySelectorAll<HTMLElement>("[data-vmax-score]").forEach((el) => (el.textContent = `${score}/10`));
      document.querySelectorAll<HTMLElement>("[data-vmax-action]").forEach((el) => {
        el.textContent = score >= 8 ? "JOUER" : score >= 6 ? "SURVEILLER" : "PASSER";
      });
    };

    w.faq = (id: string) => {
      const item = document.getElementById(id);
      if (!item) return;
      item.dataset.open = item.dataset.open === "true" ? "false" : "true";
    };

    w.ckDismiss = (value: string) => {
      localStorage.setItem("pmu-cookie-consent", value);
      document.getElementById("cookie-banner")?.remove();
      track("cookie_consent", { value });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const finalValue = Number(target.dataset.countTo ?? 0);
          let current = 0;
          const step = Math.max(1, Math.ceil(finalValue / 42));
          const timer = window.setInterval(() => {
            current = Math.min(finalValue, current + step);
            target.textContent = target.dataset.suffix ? `${current}${target.dataset.suffix}` : String(current);
            if (current >= finalValue) window.clearInterval(timer);
          }, 24);
          observer.unobserve(target);
        });
      },
      { threshold: 0.35 }
    );

    document.querySelectorAll("[data-count-to]").forEach((el) => observer.observe(el));

    const countdown = window.setInterval(() => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(15, 5, 0, 0);
      if (target < now) target.setDate(target.getDate() + 1);
      const diff = Math.max(0, target.getTime() - now.getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      document.querySelectorAll<HTMLElement>("[data-countdown]").forEach((el) => {
        el.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      });
      document.querySelectorAll<HTMLElement>("[data-live-time]").forEach((el) => {
        el.textContent = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      });
    }, 1000);

    const notifications = [
      "R1C6 surveillee : signal value en hausse",
      "Ticket prioritaire pret pour les abonnes",
      "VMAX evite 4 courses sans edge",
    ];
    let notifIndex = 0;
    const notificationTimer = window.setInterval(() => {
      const container = document.getElementById("notification-container");
      if (!container) return;
      const node = document.createElement("div");
      node.className = "landing-toast";
      node.textContent = notifications[notifIndex % notifications.length];
      notifIndex += 1;
      container.appendChild(node);
      window.setTimeout(() => node.remove(), 5200);
    }, 6500);

    if (localStorage.getItem("pmu-cookie-consent")) {
      document.getElementById("cookie-banner")?.remove();
    }

    w.updateSim();
    w.updateVmax();
    track("landing_v4_view");

    return () => {
      window.clearInterval(countdown);
      window.clearInterval(notificationTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        :root {
          --landing-bg: #070807;
          --landing-panel: #101827;
          --landing-panel-soft: #172030;
          --landing-cream: #f5f0e8;
          --landing-muted: rgba(245, 240, 232, 0.64);
          --landing-gold: #d4af37;
          --landing-green: #00c851;
          --landing-border: rgba(212, 175, 55, 0.22);
        }
        .landing-v4 {
          min-height: 100vh;
          background:
            radial-gradient(circle at 78% 8%, rgba(0, 200, 81, 0.18), transparent 30rem),
            radial-gradient(circle at 12% 20%, rgba(212, 175, 55, 0.16), transparent 26rem),
            var(--landing-bg);
          color: var(--landing-cream);
          font-family: "DM Sans", sans-serif;
          overflow: hidden;
        }
        .landing-wrap { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
        .landing-nav { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 0; }
        .landing-brand { display: inline-flex; align-items: center; gap: 14px; text-decoration: none; color: var(--landing-cream); }
        .landing-mark { display: grid; width: 54px; height: 54px; place-items: center; border-radius: 14px; background: var(--landing-green); color: #04120b; font-weight: 900; }
        .landing-logo { font-family: "Cormorant Garamond", serif; font-size: 34px; line-height: 1; font-weight: 700; }
        .landing-logo span { color: var(--landing-green); font-style: italic; }
        .landing-subbrand { display: block; margin-top: 5px; color: var(--landing-muted); font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
        .landing-actions { display: flex; align-items: center; gap: 12px; }
        .landing-btn { display: inline-flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 10px; padding: 0 22px; border: 1px solid var(--landing-border); color: var(--landing-cream); font-weight: 800; text-decoration: none; transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
        .landing-btn:hover { transform: translateY(-2px); }
        .landing-btn-primary { background: linear-gradient(135deg, var(--landing-green), #31e981); color: #04120b; border-color: transparent; box-shadow: 0 18px 44px rgba(0, 200, 81, 0.22); }
        .landing-hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr); gap: 28px; align-items: stretch; padding: 62px 0 34px; }
        .landing-kicker { color: var(--landing-green); font-family: "DM Mono", monospace; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
        .landing-title { margin: 24px 0 0; max-width: 760px; font-family: "Cormorant Garamond", serif; font-size: clamp(58px, 8vw, 104px); font-weight: 600; letter-spacing: -0.03em; line-height: .9; }
        .landing-lead { max-width: 650px; margin: 28px 0 0; color: var(--landing-muted); font-size: 20px; line-height: 1.75; }
        .landing-hero-cta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 32px; }
        .landing-stat { margin-top: 34px; display: inline-grid; gap: 6px; border: 1px solid var(--landing-border); background: rgba(16, 24, 39, .7); border-radius: 14px; padding: 22px 28px; }
        .landing-stat strong { color: var(--landing-green); font-size: 76px; line-height: .88; font-weight: 900; letter-spacing: -0.05em; }
        .landing-preview { position: relative; min-height: 570px; border-radius: 18px; overflow: hidden; border: 1px solid var(--landing-border); background: linear-gradient(145deg, rgba(16,24,39,.96), rgba(4,8,14,.96)); box-shadow: 0 28px 90px rgba(0,0,0,.38); }
        .landing-preview::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(3, 10, 11, .88), rgba(3, 10, 11, .48)), url("/pmu-waiting-race.png") center/cover; opacity: .82; }
        .landing-ticket { position: absolute; left: 28px; right: 28px; bottom: 28px; border: 1px solid rgba(245,240,232,.12); border-radius: 14px; background: rgba(5, 9, 14, .76); backdrop-filter: blur(14px); padding: 24px; }
        .landing-ticket-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
        .landing-tile { border: 1px solid rgba(245,240,232,.1); border-radius: 12px; padding: 16px; background: rgba(16,24,39,.76); }
        .landing-tile span { color: rgba(245,240,232,.48); font-family: "DM Mono", monospace; font-size: 11px; text-transform: uppercase; }
        .landing-tile strong { display: block; margin-top: 8px; font-size: 24px; }
        .landing-section { padding: 52px 0; }
        .landing-section-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
        .landing-section h2 { margin: 0; font-family: "Cormorant Garamond", serif; font-size: clamp(38px, 5vw, 64px); line-height: .98; font-weight: 600; }
        .landing-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .landing-card { border: 1px solid var(--landing-border); border-radius: 14px; background: rgba(16,24,39,.74); padding: 24px; box-shadow: inset 0 1px 0 rgba(255,255,255,.04); }
        .landing-card h3 { margin: 0 0 12px; font-size: 20px; }
        .landing-card p { margin: 0; color: var(--landing-muted); line-height: 1.7; }
        .landing-ticker { display: flex; gap: 28px; overflow: hidden; border-block: 1px solid var(--landing-border); background: rgba(212,175,55,.08); padding: 13px 0; white-space: nowrap; }
        .landing-ticker-track { display: flex; min-width: max-content; gap: 28px; animation: landingTicker 26s linear infinite; }
        .landing-ticker span { color: var(--landing-gold); font-family: "DM Mono", monospace; font-weight: 700; }
        @keyframes landingTicker { to { transform: translateX(-50%); } }
        .landing-program { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; }
        .landing-race { display: grid; grid-template-columns: 74px minmax(0,1fr) 78px; align-items: center; gap: 14px; border-radius: 14px; padding: 16px; background: rgba(232,246,242,.96); color: #062f2a; margin-bottom: 12px; }
        .landing-race-code { display: grid; height: 58px; place-items: center; border-radius: 12px; background: #00594f; color: #fff; font-size: 24px; font-weight: 900; }
        .landing-race strong { display: block; font-size: 22px; }
        .landing-race em { color: #00594f; font-style: normal; font-weight: 900; }
        .landing-panel-light { background: #e8f6f2; color: #062f2a; }
        .landing-slider { width: 100%; accent-color: var(--landing-green); }
        .landing-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
        .landing-chip { border: 1px solid var(--landing-border); border-radius: 999px; background: transparent; color: var(--landing-cream); padding: 10px 16px; font-weight: 800; cursor: pointer; }
        .landing-chip[data-active="true"] { background: var(--landing-green); color: #04120b; border-color: transparent; }
        .landing-before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .landing-faq { border-top: 1px solid var(--landing-border); }
        .landing-faq-item { border-bottom: 1px solid var(--landing-border); padding: 20px 0; cursor: pointer; }
        .landing-faq-q { display: flex; justify-content: space-between; gap: 20px; font-weight: 900; }
        .landing-faq-a { display: none; margin-top: 12px; color: var(--landing-muted); line-height: 1.7; }
        .landing-faq-item[data-open="true"] .landing-faq-a { display: block; }
        .landing-final { text-align: center; border: 1px solid var(--landing-border); border-radius: 18px; background: linear-gradient(135deg, rgba(0,200,81,.12), rgba(212,175,55,.12)); padding: 64px 24px; }
        .landing-footer { border-top: 1px solid var(--landing-border); padding: 34px 0 48px; color: var(--landing-muted); }
        .landing-footer a { color: var(--landing-muted); margin-right: 18px; text-decoration: none; }
        #notification-container { position: fixed; right: 18px; top: 88px; z-index: 90; display: grid; gap: 10px; }
        .landing-toast { border-radius: 12px; background: rgba(16,24,39,.94); border: 1px solid var(--landing-border); color: var(--landing-cream); padding: 14px 16px; box-shadow: 0 18px 50px rgba(0,0,0,.35); animation: toastIn .28s ease; }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } }
        #cookie-banner { position: fixed; left: 18px; bottom: 18px; z-index: 95; max-width: 410px; border-radius: 16px; border: 1px solid var(--landing-border); background: rgba(16,24,39,.96); padding: 18px; box-shadow: 0 24px 70px rgba(0,0,0,.42); }
        .landing-cookie-actions { display: flex; gap: 10px; margin-top: 14px; }
        @media (max-width: 980px) {
          .landing-hero, .landing-program, .landing-before-after { grid-template-columns: 1fr; }
          .landing-grid-3 { grid-template-columns: 1fr; }
          .landing-preview { min-height: 520px; }
          .landing-actions { display: none; }
        }
        @media (max-width: 640px) {
          .landing-title { font-size: 54px; }
          .landing-ticket-grid { grid-template-columns: 1fr; }
          .landing-race { grid-template-columns: 58px minmax(0, 1fr); }
          .landing-race em { grid-column: 2; }
        }
      `}</style>

      <main className="landing-v4" id="main-content">
        <div id="notification-container" aria-live="polite" />
        <div id="cookie-banner">
          <strong>Cookies PMU Gagnant</strong>
          <p style={{ margin: "8px 0 0", color: "var(--landing-muted)", lineHeight: 1.55 }}>
            On utilise les cookies essentiels, analytics et publicitaires uniquement avec ton accord.
          </p>
          <div className="landing-cookie-actions">
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => (window as LandingWindow).ckDismiss?.("accepted")}>
              Accepter
            </button>
            <button type="button" className="landing-btn" onClick={() => (window as LandingWindow).ckDismiss?.("refused")}>
              Refuser
            </button>
          </div>
        </div>

        <nav className="landing-wrap landing-nav" aria-label="Navigation publique">
          <Link href="/" className="landing-brand">
            <span className="landing-mark">PG</span>
            <span>
              <span className="landing-logo">PMU<span>Gagnant</span></span>
              <span className="landing-subbrand">VMAX · IA turf</span>
            </span>
          </Link>
          <div className="landing-actions">
            <Link href="/login" className="landing-btn">Se connecter</Link>
            <Link href="/signup" className="landing-btn landing-btn-primary">Commencer gratuitement</Link>
          </div>
        </nav>

        <section className="landing-wrap landing-hero">
          <div>
            <p className="landing-kicker">Pronostic PMU assiste par IA</p>
            <h1 className="landing-title">L&apos;IA qui analyse les courses PMU a votre place</h1>
            <p className="landing-lead">
              Chaque jour, notre algorithme identifie les meilleurs chevaux. Vous pariez en confiance.
            </p>
            <div className="landing-hero-cta">
              <Link href="/signup" className="landing-btn landing-btn-primary">Commencer gratuitement</Link>
              <Link href="/login" className="landing-btn">Se connecter</Link>
            </div>
            <div className="landing-stat">
              <span className="landing-kicker">ROI moyen sur 30 jours</span>
              <strong>+26%</strong>
              <span>Un seul ticket par jour. Calcule. Defendable.</span>
            </div>
          </div>

          <div className="landing-preview" aria-label="Apercu ticket VMAX">
            <div className="landing-ticket">
              <p className="landing-kicker">Ticket prioritaire · Depart dans <span data-countdown>--:--:--</span></p>
              <h2 style={{ margin: "14px 0 0", fontSize: 42, lineHeight: 1 }}>R1C6 · Prix d&apos;Echassieres</h2>
              <div className="landing-ticket-grid">
                <div className="landing-tile"><span>Cheval</span><strong>#2 Idylle Ever</strong></div>
                <div className="landing-tile"><span>Mise</span><strong>24 EUR</strong></div>
                <div className="landing-tile"><span>Confiance</span><strong data-vmax-score>10/10</strong></div>
              </div>
            </div>
          </div>
        </section>

        <div className="landing-ticker" aria-hidden="true">
          <div className="landing-ticker-track">
            <span>VMAX lit 31 courses aujourd&apos;hui</span><span>1 ticket prioritaire</span><span>ROI moyen +26%</span><span>Alertes Telegram T-15</span>
            <span>VMAX lit 31 courses aujourd&apos;hui</span><span>1 ticket prioritaire</span><span>ROI moyen +26%</span><span>Alertes Telegram T-15</span>
          </div>
        </div>

        <section className="landing-wrap landing-section">
          <div className="landing-grid-3">
            {proofItems.map((item) => (
              <article className="landing-card" key={item}>
                <h3>{item}</h3>
                <p>Une fenetre simple, lisible et actionnable avant la course.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-wrap landing-section landing-program">
          <div>
            <div className="landing-section-head">
              <div>
                <p className="landing-kicker">Top 3 courses</p>
                <h2>Programme trie par VMAX</h2>
              </div>
            </div>
            {topCourses.map((course) => (
              <article className="landing-race" key={course.code}>
                <span className="landing-race-code">{course.code}</span>
                <span>
                  <strong>{course.track}</strong>
                  <small>{course.name}</small>
                </span>
                <em>{course.time}</em>
              </article>
            ))}
          </div>
          <aside className="landing-card landing-panel-light">
            <p className="landing-kicker" style={{ color: "#05725f" }}>Quinte+ du jour</p>
            <h3 style={{ fontSize: 34 }}>1 ticket. Pas 15 idees.</h3>
            <p style={{ color: "#55706b" }}>Le moteur garde uniquement les chevaux defendables et coupe le bruit.</p>
            <ol style={{ marginTop: 22, lineHeight: 2.1, fontWeight: 900 }}>
              <li>Lire la course</li>
              <li>Verifier le cheval</li>
              <li>Jouer ou passer</li>
            </ol>
          </aside>
        </section>

        <section className="landing-wrap landing-section">
          <div className="landing-section-head">
            <div>
              <p className="landing-kicker">Chiffres animes</p>
              <h2>Preuves moteur</h2>
            </div>
          </div>
          <div className="landing-grid-3">
            <article className="landing-card"><p>Abonnes</p><h3><span data-count-to="1247">0</span></h3></article>
            <article className="landing-card"><p>Tickets mesures</p><h3><span data-count-to="590">0</span></h3></article>
            <article className="landing-card"><p>ROI moyen</p><h3><span data-count-to="26" data-suffix="%">0%</span></h3></article>
          </div>
        </section>

        <section className="landing-wrap landing-section landing-before-after">
          <article className="landing-card">
            <p className="landing-kicker">Avant</p>
            <h2>Programme surcharge</h2>
            <p>Des dizaines de courses, trop d&apos;infos, aucune priorite claire.</p>
          </article>
          <article className="landing-card">
            <p className="landing-kicker">Apres</p>
            <h2>Ticket prioritaire</h2>
            <p>Une decision simple : cheval, mise, confiance et heure de depart.</p>
          </article>
        </section>

        <section className="landing-wrap landing-section">
          <div className="landing-grid-3">
            <article className="landing-card">
              <p className="landing-kicker">Simulateur ROI</p>
              <h3 data-sim-roi>+26%</h3>
              <label>Bankroll <strong data-sim-bankroll>300 EUR</strong></label>
              <input id="sim-bankroll" className="landing-slider" type="range" min="100" max="1500" defaultValue="300" onInput={() => (window as LandingWindow).updateSim?.()} />
              <label>Mise <strong data-sim-stake>8 EUR</strong></label>
              <input id="sim-stake" className="landing-slider" type="range" min="4" max="50" defaultValue="8" onInput={() => (window as LandingWindow).updateSim?.()} />
              <label>Taux reussite <strong data-sim-hit>42%</strong></label>
              <input id="sim-hit" className="landing-slider" type="range" min="20" max="65" defaultValue="42" onInput={() => (window as LandingWindow).updateSim?.()} />
              <p>Gain projete : <strong data-sim-gain>+0 EUR</strong></p>
              <div className="landing-tabs">
                <button className="landing-chip" data-profil="prudent" onClick={() => (window as LandingWindow).setProfil?.("prudent")}>Prudent</button>
                <button className="landing-chip" data-profil="equilibre" data-active="true" onClick={() => (window as LandingWindow).setProfil?.("equilibre")}>Equilibre</button>
                <button className="landing-chip" data-profil="offensif" onClick={() => (window as LandingWindow).setProfil?.("offensif")}>Offensif</button>
              </div>
            </article>
            <article className="landing-card">
              <p className="landing-kicker">Demo VMAX</p>
              <h3>Action : <span data-vmax-action>JOUER</span></h3>
              <label>Lisibilite</label>
              <input id="vmax-lisibilite" className="landing-slider" type="range" min="0" max="100" defaultValue="72" onInput={() => (window as LandingWindow).updateVmax?.()} />
              <label>Value</label>
              <input id="vmax-value" className="landing-slider" type="range" min="0" max="100" defaultValue="68" onInput={() => (window as LandingWindow).updateVmax?.()} />
              <label>Fiabilite</label>
              <input id="vmax-fiabilite" className="landing-slider" type="range" min="0" max="100" defaultValue="76" onInput={() => (window as LandingWindow).updateVmax?.()} />
              <p>Score final : <strong data-vmax-score>--</strong></p>
            </article>
            <article className="landing-card">
              <p className="landing-kicker">Telegram</p>
              <h3>Alerte live a <span data-live-time>--:--</span></h3>
              <p>Reception du ticket prioritaire, rappel T-15, recap resultat.</p>
              <Link href="/signup" className="landing-btn landing-btn-primary" style={{ marginTop: 18 }}>Activer les alertes</Link>
            </article>
          </div>
        </section>

        <section className="landing-wrap landing-section">
          <div className="landing-section-head">
            <div>
              <p className="landing-kicker">Plans</p>
              <h2>Essai gratuit puis premium</h2>
            </div>
          </div>
          <div className="landing-grid-3">
            <article className="landing-card"><h3>Gratuit</h3><p>Decouverte du moteur et dashboard simplifie.</p><Link href="/signup" className="landing-btn">Commencer</Link></article>
            <article className="landing-card"><h3>Premium · 19 EUR/mois</h3><p>Ticket prioritaire, alertes et historiques ROI.</p><Link href="/signup" className="landing-btn landing-btn-primary">Essai gratuit</Link></article>
            <article className="landing-card"><h3>Annuel · 149 EUR/an</h3><p>Meilleur tarif pour suivre la saison complete.</p><Link href="/signup" className="landing-btn">Choisir annuel</Link></article>
          </div>
        </section>

        <section className="landing-wrap landing-section">
          <p className="landing-kicker">FAQ</p>
          <h2>Questions frequentes</h2>
          {[
            ["faq-1", "Est-ce une garantie de gain ?", "Non. PMU Gagnant est un service d'aide a la decision et ne garantit jamais un gain."],
            ["faq-2", "Pourquoi un seul ticket ?", "Parce que l'objectif est de reduire le bruit et de garder seulement la value defendable."],
            ["faq-3", "Puis-je resilier ?", "Oui, a tout moment depuis l'espace compte."],
          ].map(([id, question, answer]) => (
            <div id={id} className="landing-faq-item" data-open="false" key={id} onClick={() => (window as LandingWindow).faq?.(id)}>
              <div className="landing-faq-q"><span>{question}</span><span>+</span></div>
              <div className="landing-faq-a">{answer}</div>
            </div>
          ))}
        </section>

        <section className="landing-wrap landing-section">
          <div className="landing-final">
            <p className="landing-kicker">Rejoignez PMU Gagnant</p>
            <h2>Essai gratuit. Une decision claire des demain.</h2>
            <p className="landing-lead" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Laissez VMAX trier le programme. Vous gardez le controle.
            </p>
            <div className="landing-hero-cta" style={{ justifyContent: "center" }}>
              <Link href="/signup" className="landing-btn landing-btn-primary">Commencer gratuitement</Link>
            </div>
          </div>
        </section>

        <footer className="landing-wrap landing-footer">
          <p>Jouer comporte des risques : endettement, isolement, dependance. Aide : 09 74 75 13 13.</p>
          <nav>
            <Link href="/mentions-legales">Mentions legales</Link>
            <Link href="/cgv">CGV</Link>
            <Link href="/politique-confidentialite">Confidentialite</Link>
            <Link href="/politique-cookies">Cookies</Link>
          </nav>
        </footer>
      </main>
    </>
  );
}
