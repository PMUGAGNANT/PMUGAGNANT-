import Link from "next/link";
import {
  formatRaceAnalysisId,
} from "@/features/vmax/vmax-model";
import {
  getCompactBubbleClass,
  getStatusLabel,
  type DashboardRace,
} from "@/features/dashboard/lib/dashboard-page-model";

type DashboardRaceCardProps = {
  item: DashboardRace;
};

export function DashboardRaceCard({ item }: DashboardRaceCardProps) {
  const href = `/race/${formatRaceAnalysisId(item.race.reunion, item.race.course)}?date=${item.race.dateStr}`;

  return (
    <Link href={href} className="dash-card">
      <div className="dash-card-row">
        <strong className="dash-card-title">{item.race.hippodrome}</strong>
        <span className={`dash-status ${item.status}`}>{getStatusLabel(item.status)}</span>
      </div>
      <p className="dash-card-meta">
        {item.race.discipline} · {item.race.heureDepart} · {item.race.nombrePartants} partants
      </p>
      <div className="dash-card-row">
        <div className="dash-mini-bubbles">
          {item.topNumbers.slice(0, 3).map((num, index) => (
            <span className={`dash-mini ${getCompactBubbleClass(index)}`} key={num}>
              {num}
            </span>
          ))}
        </div>
        <span className="dash-card-confidence">{item.confidence}% confiance</span>
      </div>
    </Link>
  );
}
