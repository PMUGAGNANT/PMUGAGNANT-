"use client";

import { useEffect, useState } from "react";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";

type RaceAlertButtonProps = {
  dateStr: string;
  reunion: number;
  course: number;
  hippodrome: string;
  heureDepart: string;
  chevalNum: number;
  chevalNom: string;
};

const PHONE_STORAGE_KEY = "turfedge-alert-phone";

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export default function RaceAlertButton(props: RaceAlertButtonProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  useEffect(() => {
    try {
      const storedPhone = window.localStorage.getItem(PHONE_STORAGE_KEY);
      if (storedPhone) {
        setPhone(storedPhone);
      }
    } catch {
      setPhone("");
    }
  }, []);

  async function registerAlert(nextPhone: string) {
    setLoading(true);
    setMessage("");

    try {
      let token: string | null = null;
      if (hasSupabaseConfig()) {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      }

      const response = await fetch("/api/race-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...props,
          phone: normalizePhone(nextPhone),
        }),
      });
      const payload: { success?: boolean; error?: string } = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Alerte indisponible.");
      }

      try {
        window.localStorage.setItem(PHONE_STORAGE_KEY, normalizePhone(nextPhone));
      } catch {
        // Le stockage local est facultatif pour l'inscription.
      }

      setPhone(normalizePhone(nextPhone));
      setEnabled(true);
      setShowPhoneInput(false);
      setMessage("Alerte activée ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Alerte indisponible.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClick() {
    if (enabled) {
      return;
    }

    if (!phone) {
      setShowPhoneInput(true);
      return;
    }

    await registerAlert(phone);
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || enabled}
        className={`rounded-lg px-4 py-3 text-sm font-black transition ${
          enabled
            ? "border border-[#00C851]/35 bg-[#00C851]/12 text-[#00C851]"
            : "border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/18"
        }`}
      >
        {enabled ? "Alerte activée ✓" : loading ? "Activation..." : "Recevoir l'alerte"}
      </button>

      {showPhoneInput ? (
        <form
          className="grid gap-2 rounded-lg border border-white/10 bg-[#0D1422] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void registerAlert(String(formData.get("phone") ?? ""));
          }}
        >
          <label className="text-xs font-black uppercase text-slate-400" htmlFor="race-alert-phone">
            Numéro Telegram ou téléphone
          </label>
          <input
            id="race-alert-phone"
            name="phone"
            defaultValue={phone}
            placeholder="+336..."
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#D4AF37]/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-black text-[#0A0E1A]"
          >
            Confirmer l&apos;inscription
          </button>
        </form>
      ) : null}

      {message ? <p className="text-xs font-bold text-slate-400">{message}</p> : null}
    </div>
  );
}
