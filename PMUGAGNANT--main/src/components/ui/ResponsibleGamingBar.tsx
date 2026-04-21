"use client";

import { useTheme } from "@/components/ui/ThemeProvider";

export function ResponsibleGamingBar() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "cream" ? "Palette actuelle" : "Palette crème";

  return (
    <div className="responsible-gaming-bar" role="note" aria-label="Jeu responsable">
      <p>
        <strong>Jouer comporte des risques : endettement, isolement, dépendance.</strong>{" "}
        Pour être aidé, appelez le{" "}
        <a href="tel:0974751313">09 74 75 13 13</a> (appel non surtaxé).{" "}
        <span>Interdit aux mineurs.</span>
      </p>
      <button type="button" onClick={toggleTheme} className="theme-swap-button">
        {nextLabel}
      </button>
    </div>
  );
}
