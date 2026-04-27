import Link from "next/link";

type PageNextStepCardProps = {
  kicker: string;
  title: string;
  text: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function PageNextStepCard({
  kicker,
  title,
  text,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: PageNextStepCardProps) {
  return (
    <section className="app-card p-6 text-center md:p-8">
      <p className="app-kicker">{kicker}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-text)] md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
        {text}
      </p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={primaryHref} className="app-button-primary inline-flex">
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className="app-button-secondary inline-flex">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
