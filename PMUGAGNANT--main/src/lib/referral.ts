export const REFERRAL_BONUS_DAYS = 7;
export const DEFAULT_REFERRAL_SITE_URL = "https://pmugagnant.vercel.app";

export interface ReferralSnapshot {
  referral_code: string;
  referral_count: number;
  referral_premium_days: number;
  share_url: string;
}

export function normalizeReferralCode(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function buildReferralShareUrl(referralCode: string, siteUrl?: string | null) {
  const baseUrl = (siteUrl?.trim() || DEFAULT_REFERRAL_SITE_URL).replace(/\/+$/, "");
  return `${baseUrl}/login?ref=${referralCode}`;
}

export function generateReferralCode() {
  const raw =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;

  return raw.slice(0, 8).toUpperCase();
}
