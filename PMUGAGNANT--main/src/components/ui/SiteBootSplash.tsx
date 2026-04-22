"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function SiteBootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 1050);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="site-boot-splash" role="status" aria-live="polite">
      <div className="boot-loader">
        <div className="boot-loader__mark" aria-hidden="true">
          <span className="boot-loader__orbit" />
          <Image src="/logo-turfedge.png" alt="" width={56} height={56} priority />
        </div>
        <div className="boot-loader__copy">
          <span>TurfEdge</span>
          <strong>Lecture des signaux du jour</strong>
        </div>
        <div className="boot-loader__scan" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Cotes live / VMAX / bankroll</p>
      </div>
    </div>
  );
}
