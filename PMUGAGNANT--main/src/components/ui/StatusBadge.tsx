import type { VmaxRaceStatus } from "@/features/vmax/vmax-model";

type StatusBadgeProps = {
  status: VmaxRaceStatus;
};

const STATUS_LABELS: Record<VmaxRaceStatus, string> = {
  ready: "ANALYSE PRETE",
  soon: "BIENTOT",
  live: "EN COURS",
  finished: "TERMINEE",
};

const STATUS_CLASSES: Record<VmaxRaceStatus, string> = {
  ready: "border-[#00C851]/35 bg-[#00C851]/10 text-[#00C851]",
  soon: "animate-pulse border-[#FF9F1C]/40 bg-[#FF9F1C]/15 text-[#FF9F1C]",
  live: "border-[#FF9F1C]/40 bg-[#FF9F1C]/15 text-[#FF9F1C]",
  finished: "border-white/10 bg-white/[0.08] text-slate-400",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
