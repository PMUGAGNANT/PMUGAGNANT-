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
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__content">{children}</div>
      <BottomNav />
    </div>
  );
}
