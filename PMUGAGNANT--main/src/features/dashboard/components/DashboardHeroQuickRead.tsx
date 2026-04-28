import type { DashboardHeroModel } from "@/features/dashboard/lib/dashboard-page-model";

type DashboardHeroQuickReadProps = {
  model: DashboardHeroModel;
};

const SECTIONS: Array<{
  key: keyof Pick<DashboardHeroModel, "bases" | "outsiders" | "eliminations">;
  label: string;
  tone: string;
  empty: string;
}> = [
  { key: "bases", label: "Bases", tone: "base", empty: "Aucune base nette" },
  { key: "outsiders", label: "Outsiders", tone: "outsider", empty: "Aucun outsider net" },
  { key: "eliminations", label: "A ecarter", tone: "reject", empty: "Aucune elimination forte" },
];

export function DashboardHeroQuickRead({ model }: DashboardHeroQuickReadProps) {
  return (
    <div className="dash-read">
      <div className="dash-read-head">
        <div>
          <p className="dash-kicker">Lecture express</p>
          <h2 className="dash-read-title">Que jouer, surveiller ou ignorer</h2>
        </div>
        <div className="dash-read-confidence">
          <strong>{model.confidenceLabel}</strong>
        </div>
      </div>

      <div className="dash-read-grid">
        {SECTIONS.map((section) => {
          const items = model[section.key];
          return (
            <section key={section.key} className={`dash-read-card ${section.tone}`}>
              <p className="dash-read-label">{section.label}</p>
              <div className="dash-read-list">
                {items.length > 0 ? (
                  items.map((item) => (
                    <div className="dash-read-item" key={`${section.key}-${item.numero}`}>
                      <div className="dash-read-top">
                        <span className={`dash-read-num ${section.tone}`}>#{item.numero}</span>
                      </div>
                      <strong className="dash-read-horse">{item.cheval}</strong>
                      <span className="dash-read-note">{item.note}</span>
                    </div>
                  ))
                ) : (
                  <div className="dash-read-empty">{section.empty}</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
