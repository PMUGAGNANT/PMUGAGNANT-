"use client";

import { useEffect, useState } from "react";
import { TurfEdgeWaitScreen } from "@/components/ui/TurfEdgeWaitScreen";

export function SiteBootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 1450);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) {
    return null;
  }

  return <TurfEdgeWaitScreen label="Lecture des signaux du jour" mode="boot" />;
}
