"use client";

import { useEffect } from "react";
import { useTheme } from "./ThemeProvider";

const THEME_COLOR_DARK = "#07141c";
const THEME_COLOR_WARM = "#f4ede2";

/**
 * Met à jour la balise theme-color du navigateur selon dark / warm
 * (le viewport exporté dans layout est statique).
 */
export function ThemeMetaColor() {
  const { theme } = useTheme();

  useEffect(() => {
    const content = theme === "warm" ? THEME_COLOR_WARM : THEME_COLOR_DARK;
    let el = document.querySelector('meta[name="theme-color"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "theme-color");
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }, [theme]);

  return null;
}
