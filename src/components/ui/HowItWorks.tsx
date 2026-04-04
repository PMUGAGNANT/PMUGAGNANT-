"use client";

const STEPS = [
  {
    num: "1",
    emoji: "🔍",
    title: "Le moteur analyse",
    description:
      "Chaque matin, le moteur passe au crible les courses du jour : forme des chevaux, jockeys, terrain, météo et cotes.",
  },
  {
    num: "2",
    emoji: "🎯",
    title: "On garde l'essentiel",
    description:
      "Sur 200+ courses analysées, seules 3 à 5 passent nos critères de qualité. Vous ne voyez que les meilleures opportunités.",
  },
  {
    num: "3",
    emoji: "📱",
    title: "Vous recevez le ticket",
    description:
      "Un message simple avec le cheval à suivre, le type de pari conseillé et notre niveau de confiance.",
  },
  {
    num: "4",
    emoji: "📊",
    title: "On suit les résultats",
    description:
      "Chaque semaine, un bilan transparent avec les gains, les pertes et le ROI réel. Pas de faux résultats.",
  },
];

export function HowItWorks() {
  return (
    <section className="app-card overflow-hidden p-6 md:p-8">
      <div className="text-center">
        <p className="app-kicker">Comment ça marche</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)] md:text-3xl">
          Simple, même si vous débutez
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--pmu-text-soft)]">
          Pas besoin d&apos;?tre expert du turf. Le moteur fait le tri, vous gardez
          la d?cision finale.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="relative rounded-xl border border-[var(--pmu-border)] p-5 transition hover:border-[var(--pmu-primary-soft)]"
            style={{ background: "var(--pmu-surface-2)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black"
                style={{
                  background: "var(--pmu-primary-soft)",
                  color: "var(--pmu-primary)",
                  border: "1px solid var(--pmu-primary-soft)",
                }}
              >
                {step.emoji}
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--pmu-text)]">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--pmu-text-soft)]">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
