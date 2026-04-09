"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

const shellDisabledRoutes = new Set(["/login"]);

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const shellDisabled = shellDisabledRoutes.has(pathname);

  if (shellDisabled) {
    return (
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <main
          id="main-content"
          className="app-shell__content relative z-10"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
