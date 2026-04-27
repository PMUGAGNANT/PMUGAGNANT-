import Link from "next/link";
import type { AccountOverview } from "@/features/account/lib/account-overview";

type AccountNextActionCardProps = {
  overview: AccountOverview;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

function isAnchorAction(href: string) {
  return href.startsWith("#");
}

export function AccountNextActionCard({
  overview,
  onPrimaryAction,
  onSecondaryAction,
}: AccountNextActionCardProps) {
  return (
    <aside className="app-card p-5 md:p-6">
      <p className="app-kicker">{overview.focusLabel}</p>
      <h2 className="mt-3 text-3xl font-black leading-[0.98] text-[var(--pmu-text)]">
        {overview.focusTitle}
      </h2>
      <p className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
        {overview.focusText}
      </p>

      <div className="mt-5 inline-flex rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--pmu-text-soft)]">
        {overview.accessBadge}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {isAnchorAction(overview.primaryActionHref) ? (
          <button type="button" onClick={onPrimaryAction} className="app-button-primary">
            {overview.primaryActionLabel}
          </button>
        ) : (
          <Link href={overview.primaryActionHref} className="app-button-primary">
            {overview.primaryActionLabel}
          </Link>
        )}

        {isAnchorAction(overview.secondaryActionHref) ? (
          <button type="button" onClick={onSecondaryAction} className="app-button-secondary">
            {overview.secondaryActionLabel}
          </button>
        ) : (
          <Link href={overview.secondaryActionHref} className="app-button-secondary">
            {overview.secondaryActionLabel}
          </Link>
        )}
      </div>
    </aside>
  );
}
