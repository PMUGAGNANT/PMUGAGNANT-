import { normalizeReferralCode } from "@/lib/referral";

export async function applyReferralCode(referralCode: string, accessToken: string) {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    throw new Error("Code invalide");
  }

  const response = await fetch("/api/referral", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ referral_code: normalizedCode }),
  });

  const payload = (await response.json()) as {
    success?: boolean;
    message?: string;
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "Code invalide");
  }

  return payload.message ?? "7 jours premium actives !";
}
