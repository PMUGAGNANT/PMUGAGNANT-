"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-preference";

const THEME_COLOR_LIGHT = "#FAF7EF";
const THEME_COLOR_CREAM = "#FFF3D8";

export function ThemeMetaColor() {
  useEffect(() => {
    function applyThemeColor() {
      let el = document.querySelector('meta[name="theme-color"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", "theme-color");
        document.head.appendChild(el);
      }
      const theme = document.documentElement.dataset.theme;
      el.setAttribute("content", theme === "cream" ? THEME_COLOR_CREAM : THEME_COLOR_LIGHT);
    }

    applyThemeColor();
    const observer = new MutationObserver(applyThemeColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        applyThemeColor();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
