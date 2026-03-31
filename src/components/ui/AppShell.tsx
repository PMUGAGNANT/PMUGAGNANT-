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
      <div id="main-content" className="app-shell__content" tabIndex={-1}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
