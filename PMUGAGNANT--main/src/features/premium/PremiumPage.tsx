"use client";

import Link from "next/link";

import PromoVideo from "@/components/PromoVideo";
import { ReferralCard } from "@/components/ui/ReferralCard";
import {
  PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX,
  PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN,
} from "@/lib/billing-display";

const FEATURES = [
  {
    emoji: "🎯",
    title: "Ticket par course",
    text: "Cheval retenu, type de pari, mise Kelly calculée. Pas une liste, une décision.",
  },
  {
    emoji: "💎",
    title: "Pépites et outsiders",
    text: "Les chevaux que le marché ignore mais que l'algo repère. C'est là que le ROI se construit.",
  },
  {
    emoji: "📊",
    title: "Score de confiance",
    text: "De 0 à 10 sur chaque course. Tu sais exactement quand y aller et quand passer.",
  },
  {
    emoji: "⚡",
    title: "Alerte T-10 minutes",
    text: "Cote en baisse juste avant le départ = signal fort. Tu reçois l'alerte automatiquement.",
  },
  {
    emoji: "💰",
    title: "Mise Kelly lisible",
    text: "Combien miser selon ta bankroll. Pas d'improvisation, pas de trop gros coup.",
  },
  {
    emoji: "📈",
    title: "Suivi de performance",
    text: "ROI réel, bilan hebdomadaire, comparaison contre le hasard. Tu vois si ça marche.",
  },
];

const COMPARE_ROWS = [
  { feature: "Programme du jour complet", free: true, premium: true },
  { feature: "Score journée et lisibilité", free: true, premium: true },
  { feature: "Ticket détaillé par course", free: false, premium: true },
  { feature: "Mise Kelly conseillée", free: false, premium: true },
  { feature: "4 rôles clés : pépite, outsider, favori, oublié", free: false, premium: true },
  { feature: "Avis expert top 5 chevaux", free: "Top 3", premium: true },
  { feature: "Alerte T-10 min avant départ", free: false, premium: true },
  { feature: "Combo courses multi-sélection", free: false, premium: true },
  { feature: "Bilan ROI et suivi performance", free: false, premium: true },
];

const FAQ_ITEMS = [
  {
    q: "À qui sert le premium ?",
    a: "À quelqu'un qui veut une lecture actionnable : savoir quoi jouer, quoi ignorer et combien miser sans passer 2 h à trier 40 courses chaque matin.",
  },
  {
    q: "Est-ce que tout devient payant ?",
    a: "Non. La page d'accueil avec le programme reste publique. Le premium débloque la lecture complète, les tickets détaillés, les alertes T-10 et les mises recommandées.",
  },
  {
    q: "L'abonnement garantit-il des gains ?",
    a: "Non. TurfEdge vend de la discipline, du filtrage et un moteur plus clair. Pas une promesse irréelle. Le ROI moyen sur les courses validées est de +8.3% : c'est un outil, pas une magie.",
  },
  {
    q: "Peut-on arrêter à tout moment ?",
    a: "Oui. Le portail Stripe te permet de gérer ou stopper l'abonnement en 2 clics, sans conditions.",
  },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="var(--pmu-primary)" />
      <path
        d="M5 8l2 2 4-4"
        stroke="var(--pmu-on-primary)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="var(--pmu-surface-2)" />
      <path d="M10 6L6 10M6 6l4 4" stroke="var(--pmu-text-muted)" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export default function PremiumPage() {
  const premiumCheckoutRedirect = encodeURIComponent("/mes-paris?billing=checkout");
  const premiumCheckoutHref = `/login?redirect=${premiumCheckoutRedirect}`;
  const priceLabel = `${PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN} ${PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX}`;

  return (
    <div style={{ margin: "0 auto", maxWidth: "860px", padding: "0 1rem 4rem" }}>
      <section className="app-page-hero mb-6 p-6 text-center md:p-10">
        <p className="app-kicker mb-4">
          TurfEdge Premium · {priceLabel}
        </p>
        <h1 className="mx-auto mb-5 max-w-3xl text-[2.35rem] font-black leading-tight text-[var(--pmu-text)] md:text-[3.2rem]">
          L&apos;IA qui lit toutes les courses PMU à ta place. Chaque matin.
        </h1>
        <p className="mx-auto mb-8 max-w-[34rem] text-base leading-7 text-[var(--pmu-text-soft)]">
          Score de confiance, cheval retenu, mise conseillée, alerte T-10. Tu ouvres TurfEdge,
          tu sais quoi faire.
        </p>
        <PromoVideo />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          <Link
            href={premiumCheckoutHref}
            className="app-button-primary"
          >
            Commencer · {priceLabel}
          </Link>
          <Link
            href="/bilan"
            className="app-button-secondary"
          >
            Voir le bilan du moteur →
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--pmu-text-muted)]">
          Paiement sécurisé via Stripe · Annulable à tout moment
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { num: "13", label: "courses validées aujourd'hui", sub: "sur 38 analysées" },
          { num: "+8.3%", label: "ROI moyen semaine", sub: "sur les courses validées" },
          { num: "100/100", label: "score journée", sub: "lisibilité maximale" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--pmu-surface)",
              border: "1px solid rgba(24,22,15,0.09)",
              borderRadius: "8px",
              padding: "1.25rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "var(--pmu-primary)",
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "1.8rem",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {stat.num}
            </p>
            <p style={{ color: "var(--pmu-text)", fontSize: "0.78rem", fontWeight: 600, marginTop: "0.4rem" }}>
              {stat.label}
            </p>
            <p style={{ color: "var(--pmu-text-muted)", fontSize: "0.68rem", marginTop: "0.2rem" }}>{stat.sub}</p>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            color: "var(--pmu-primary)",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: 0,
            marginBottom: "0.75rem",
            textTransform: "uppercase",
          }}
        >
          Ce qui est inclus
        </p>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "var(--pmu-surface)",
                border: "1px solid rgba(24,22,15,0.09)",
                borderRadius: "8px",
                padding: "1.1rem 1.25rem",
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "0.5rem" }} aria-hidden="true">
                {feature.emoji}
              </div>
              <p
                style={{
                  color: "var(--pmu-text)",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: "0.35rem",
                }}
              >
                {feature.title}
              </p>
              <p style={{ color: "var(--pmu-text-soft)", fontSize: "0.78rem", lineHeight: 1.55 }}>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "var(--pmu-surface)",
          border: "1px solid rgba(24,22,15,0.09)",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "var(--pmu-primary)",
            color: "var(--pmu-on-primary)",
            display: "grid",
            fontSize: "0.65rem",
            fontWeight: 700,
            gridTemplateColumns: "1fr 100px 100px",
            letterSpacing: 0,
            padding: "0.75rem 1.25rem",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "rgba(253,252,249,0.7)" }}>Fonctionnalité</span>
          <span style={{ color: "rgba(253,252,249,0.7)", textAlign: "center" }}>Gratuit</span>
          <span style={{ color: "#FFE8A3", textAlign: "center" }}>Premium</span>
        </div>
        {COMPARE_ROWS.map((row, index) => (
          <div
            key={row.feature}
            style={{
              alignItems: "center",
              background: index % 2 === 0 ? "var(--pmu-surface)" : "var(--pmu-surface-2)",
              borderBottom:
                index < COMPARE_ROWS.length - 1 ? "1px solid rgba(24,22,15,0.06)" : "none",
              display: "grid",
              gridTemplateColumns: "1fr 100px 100px",
              padding: "0.7rem 1.25rem",
            }}
          >
            <span style={{ color: "var(--pmu-text)", fontSize: "0.82rem", fontWeight: 500 }}>{row.feature}</span>
            <div style={{ textAlign: "center" }}>
              {row.free === true ? (
                <CheckIcon />
              ) : row.free === false ? (
                <CrossIcon />
              ) : (
                <span style={{ color: "var(--pmu-gold)", fontSize: "0.68rem", fontWeight: 600 }}>{row.free}</span>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <CheckIcon />
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          background: "var(--pmu-gold-light)",
          border: "1px solid rgba(140,109,47,0.25)",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "var(--pmu-primary)",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "1.5rem",
            fontStyle: "italic",
            fontWeight: 700,
            marginBottom: "0.5rem",
          }}
        >
          &ldquo;Jouer juste, jouer rare, jouer fort.&rdquo;
        </p>
        <p
          style={{
            color: "var(--pmu-gold)",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: 0,
            marginBottom: "1.5rem",
            textTransform: "uppercase",
          }}
        >
          TurfEdge · Algo v9.2
        </p>
        <Link
          href={premiumCheckoutHref}
          style={{
            background: "var(--pmu-primary)",
            border: "none",
            borderRadius: "8px",
            color: "var(--pmu-on-primary)",
            display: "inline-block",
            fontSize: "0.95rem",
            fontWeight: 700,
            padding: "0.9rem 2.5rem",
            textDecoration: "none",
          }}
        >
          Commencer maintenant · {priceLabel}
        </Link>
        <p style={{ color: "var(--pmu-text-muted)", fontSize: "0.72rem", marginTop: "0.75rem" }}>
          Annulable à tout moment · Paiement sécurisé Stripe
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            background: "var(--pmu-surface)",
            border: "1px solid rgba(24,22,15,0.09)",
            borderRadius: "8px",
            padding: "1.25rem",
          }}
        >
          <p
            style={{
              color: "var(--pmu-primary)",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: 0,
              marginBottom: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            ✓ Pour toi si
          </p>
          {[
            "Tu veux savoir quoi jouer sans trier 40 courses.",
            "Tu veux jouer moins, mais avec plus de conviction.",
            "Tu veux une mise claire sur ta bankroll.",
            "Tu veux mesurer si l'algo apporte vraiment quelque chose.",
          ].map((item) => (
            <div
              key={item}
              style={{
                alignItems: "flex-start",
                display: "flex",
                gap: "0.5rem",
                marginBottom: "0.6rem",
              }}
            >
              <CheckIcon />
              <span style={{ color: "var(--pmu-text-soft)", fontSize: "0.78rem", lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            background: "var(--pmu-surface)",
            border: "1px solid rgba(184,80,48,0.15)",
            borderRadius: "8px",
            padding: "1.25rem",
          }}
        >
          <p
            style={{
              color: "var(--pmu-red)",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: 0,
              marginBottom: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            ✕ Pas pour toi si
          </p>
          {[
            "Tu veux un tipster miracle à gains garantis.",
            "Tu veux jouer chaque course sans filtre.",
            "Tu refuses toute discipline de bankroll.",
          ].map((item) => (
            <div
              key={item}
              style={{
                alignItems: "flex-start",
                display: "flex",
                gap: "0.5rem",
                marginBottom: "0.6rem",
              }}
            >
              <CrossIcon />
              <span style={{ color: "var(--pmu-text-soft)", fontSize: "0.78rem", lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ marginBottom: "1.5rem" }}>
        <ReferralCard />
      </div>

      <section
        style={{
          background: "var(--pmu-surface)",
          border: "1px solid rgba(24,22,15,0.09)",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          padding: "1.5rem",
        }}
      >
        <p
          style={{
            color: "var(--pmu-primary)",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: 0,
            marginBottom: "1rem",
            textTransform: "uppercase",
          }}
        >
          Questions fréquentes
        </p>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} style={{ background: "var(--pmu-surface-2)", borderRadius: "8px", padding: "1rem" }}>
              <p style={{ color: "var(--pmu-text)", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {item.q}
              </p>
              <p style={{ color: "var(--pmu-text-soft)", fontSize: "0.78rem", lineHeight: 1.55 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-page-hero p-6 text-center md:p-10">
        <h2 className="mb-3 text-[2rem] font-black leading-tight text-[var(--pmu-text)] md:text-[2.45rem]">
          Prêt à jouer avec un vrai cadre ?
        </h2>
        <p className="mb-6 text-sm text-[var(--pmu-text-soft)]">
          {priceLabel} · Annulable à tout moment · Paiement sécurisé
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          <Link
            href={premiumCheckoutHref}
            className="app-button-primary"
          >
            Commencer · {priceLabel}
          </Link>
          <Link
            href="/"
            className="app-button-secondary"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    </div>
  );
}
