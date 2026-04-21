"use client";

import { useEffect, useState } from "react";

export function SiteBootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 850);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="site-boot-splash" role="status" aria-live="polite">
      <div>
        <span>TURFEDGE</span>
        <strong>Préparation des pronostics</strong>
        <i />
      </div>
    </div>
  );
}
