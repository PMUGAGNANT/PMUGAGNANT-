"use client";

import { useTheme } from "@/components/ui/ThemeProvider";

type ThemeSwitchButtonProps = {
  className?: string;
};

export function ThemeSwitchButton({ className = "" }: ThemeSwitchButtonProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-switch-button ${className}`.trim()} role="group" aria-label="Palette du site">
      <button
        type="button"
        onClick={() => setTheme("warm")}
        aria-pressed={theme !== "cream"}
        className={theme === "cream" ? undefined : "is-active"}
      >
        Sombre
      </button>
      <button
        type="button"
        onClick={() => setTheme("cream")}
        aria-pressed={theme === "cream"}
        className={theme === "cream" ? "is-active" : undefined}
      >
        Crème
      </button>
    </div>
  );
}
