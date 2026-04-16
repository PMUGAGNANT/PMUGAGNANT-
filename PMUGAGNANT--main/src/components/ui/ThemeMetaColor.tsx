"use client";

import { useEffect } from "react";
import { useTheme } from "./ThemeProvider";

const THEME_COLOR_DARK = "#08111b";
const THEME_COLOR_WARM = "#f3f6fb";

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
