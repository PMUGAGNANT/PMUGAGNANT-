"use client";

import { useEffect } from "react";

const THEME_COLOR_LIGHT = "#FAF7EF";

export function ThemeMetaColor() {
  useEffect(() => {
    let el = document.querySelector('meta[name="theme-color"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "theme-color");
      document.head.appendChild(el);
    }
    el.setAttribute("content", THEME_COLOR_LIGHT);
  }, []);

  return null;
}
