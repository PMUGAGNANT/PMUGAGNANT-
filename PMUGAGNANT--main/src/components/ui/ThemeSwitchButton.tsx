"use client";

import { useTheme } from "@/components/ui/ThemeProvider";

type ThemeSwitchButtonProps = {
  className?: string;
};

export function ThemeSwitchButton({ className = "" }: ThemeSwitchButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "cream" ? "Couleur actuelle" : "Couleur crème";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-switch-button ${className}`.trim()}
      aria-label="Changer la palette du site"
    >
      {label}
    </button>
  );
}
