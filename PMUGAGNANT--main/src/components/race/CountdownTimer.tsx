"use client";

import { useEffect, useMemo, useState } from "react";

type CountdownTimerProps = {
  dateStr: string;
  heureDepart: string;
  variant?: "compact" | "hero";
};

function getRaceTimestamp(dateStr: string, heureDepart: string) {
  const day = Number.parseInt(dateStr.slice(0, 2), 10);
  const month = Number.parseInt(dateStr.slice(2, 4), 10) - 1;
  const year = Number.parseInt(dateStr.slice(4, 8), 10);
  const [hours, minutes] = heureDepart.split(":").map(Number);

  return new Date(year, month, day, hours, minutes, 0, 0).getTime();
}

function formatRemaining(totalMinutes: number) {
  if (totalMinutes <= -10) {
    return "Course terminée";
  }

  if (totalMinutes <= 0) {
    return "Départ imminent";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `Départ dans ${hours}h${String(minutes).padStart(2, "0")}m`;
  }

  return `Départ dans ${minutes} min`;
}

export default function CountdownTimer({
  dateStr,
  heureDepart,
  variant = "compact",
}: CountdownTimerProps) {
  const target = useMemo(() => getRaceTimestamp(dateStr, heureDepart), [dateStr, heureDepart]);
  const [remainingMinutes, setRemainingMinutes] = useState(() =>
    Math.ceil((target - Date.now()) / 60000)
  );

  useEffect(() => {
    const update = () => setRemainingMinutes(Math.ceil((target - Date.now()) / 60000));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [target]);

  const urgent = remainingMinutes > 0 && remainingMinutes < 10;
  const classes =
    variant === "hero"
      ? `rounded-lg border px-4 py-3 font-[var(--font-display)] text-3xl font-black ${
          urgent
            ? "animate-pulse border-[#FF4D5A]/45 bg-[#FF4D5A]/15 text-[#FF4D5A]"
            : "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]"
        }`
      : `inline-flex rounded-full border px-3 py-1 text-xs font-black ${
          urgent
            ? "animate-pulse border-[#FF4D5A]/45 bg-[#FF4D5A]/15 text-[#FF4D5A]"
            : "border-white/10 bg-white/[0.06] text-slate-300"
        }`;

  return (
    <span className={classes} aria-live="polite">
      {formatRemaining(remainingMinutes)}
    </span>
  );
}
