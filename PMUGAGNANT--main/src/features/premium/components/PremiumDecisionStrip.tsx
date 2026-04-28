const DECISION_STEPS = [
  {
    label: "1. Lire la course",
    title: "Les bases ressortent",
    text: "Tu vois vite les chevaux a garder, les outsiders utiles et les profils a ecarter.",
  },
  {
    label: "2. Decider",
    title: "Le ticket devient simple",
    text: "Le premium affiche le cheval, le type de pari, la mise conseillee et la confiance.",
  },
  {
    label: "3. Suivre",
    title: "Le bilan reste propre",
    text: "Le compte garde les tickets, les gains, les pertes et la progression sans bricolage.",
  },
];

export function PremiumDecisionStrip() {
  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">En 30 secondes</p>
          <h2 className="app-section-title">Ce que Premium change vraiment</h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {DECISION_STEPS.map((step) => (
          <article
            key={step.label}
            className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4"
          >
            <p className="app-kicker">{step.label}</p>
            <h3 className="mt-3 text-2xl font-black leading-tight text-[var(--pmu-text)]">
              {step.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {step.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
