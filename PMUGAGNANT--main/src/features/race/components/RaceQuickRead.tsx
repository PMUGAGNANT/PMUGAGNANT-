import { formatOdds } from "@/features/vmax/vmax-model";
import type { RaceQuickReadModel } from "@/features/race/lib/race-page-model";

type RaceQuickReadProps = {
  model: RaceQuickReadModel;
};

const SECTIONS: Array<{
  key: keyof Pick<RaceQuickReadModel, "bases" | "outsiders" | "eliminations">;
  title: string;
  tone: string;
  emptyLabel: string;
}> = [
  {
    key: "bases",
    title: "Bases solides",
    tone: "base",
    emptyLabel: "Pas de base nette",
  },
  {
    key: "outsiders",
    title: "Outsiders a suivre",
    tone: "outsider",
    emptyLabel: "Pas d'outsider clair",
  },
  {
    key: "eliminations",
    title: "A ecarter",
    tone: "reject",
    emptyLabel: "Pas d'elimination forte",
  },
];

export function RaceQuickRead({ model }: RaceQuickReadProps) {
  return (
    <section className="rp-quick-read">
      <div className="rp-quick-read-head">
        <div>
          <div className="rp-quick-read-kicker">Lecture express</div>
          <h2 className="rp-quick-read-title">
            Comprendre la course en 10 secondes
          </h2>
        </div>
        <div className="rp-quick-read-confidence">
          <span className="rp-quick-read-confidence-score">{model.confidence}%</span>
          <span className="rp-quick-read-confidence-label">
            {model.confidenceLabel}
          </span>
        </div>
      </div>

      <div className="rp-quick-read-grid">
        {SECTIONS.map((section) => {
          const items = model[section.key];

          return (
            <article key={section.key} className={`rp-quick-card ${section.tone}`}>
              <div className="rp-quick-card-title">{section.title}</div>
              <div className="rp-quick-list">
                {items.length > 0 ? (
                  items.map((item) => (
                    <div key={`${section.key}-${item.numero}`} className="rp-quick-item">
                      <div className="rp-quick-item-top">
                        <span className={`rp-quick-num ${section.tone}`}>#{item.numero}</span>
                        {item.cote !== null ? (
                          <span className="rp-quick-odds">Cote {formatOdds(item.cote)}</span>
                        ) : null}
                      </div>
                      <strong className="rp-quick-horse">{item.cheval}</strong>
                      <span className="rp-quick-note">{item.note}</span>
                    </div>
                  ))
                ) : (
                  <div className="rp-quick-empty">{section.emptyLabel}</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
