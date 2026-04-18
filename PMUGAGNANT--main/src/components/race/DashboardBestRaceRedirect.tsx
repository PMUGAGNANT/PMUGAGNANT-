"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type DashboardBestRaceRedirectProps = {
  href: string | null;
};

export default function DashboardBestRaceRedirect({ href }: DashboardBestRaceRedirectProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("openBest") === "1" && href) {
      router.push(href);
    }
  }, [href, router, searchParams]);

  return null;
}
