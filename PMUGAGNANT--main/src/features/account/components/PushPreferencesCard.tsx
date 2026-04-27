"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type PushPreferences = {
  morningEnabled: boolean;
  preraceEnabled: boolean;
  resultsEnabled: boolean;
};

const DEFAULT_PREFERENCES: PushPreferences = {
  morningEnabled: true,
  preraceEnabled: true,
  resultsEnabled: true,
};

function PreferenceRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-black text-[var(--pmu-text)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--pmu-text-soft)]">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-[var(--pmu-primary)]"
      />
    </label>
  );
}

export function PushPreferencesCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!hasSupabaseConfig()) {
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || cancelled) {
          setLoading(false);
          return;
        }

        const response = await fetch("/api/push/preferences", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const payload = await response.json();

        if (!response.ok || !payload.success || cancelled) {
          throw new Error(payload.error ?? "Impossible de charger les alertes.");
        }

        setSubscribed(Boolean(payload.subscribed));
        setPreferences({
          morningEnabled: payload.preferences?.morningEnabled !== false,
          preraceEnabled: payload.preferences?.preraceEnabled !== false,
          resultsEnabled: payload.preferences?.resultsEnabled !== false,
        });
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Impossible de charger les alertes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  async function savePreferences(nextPreferences: PushPreferences) {
    setPreferences(nextPreferences);
    setSaving(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Reconnecte-toi pour modifier tes alertes.");
      }

      const response = await fetch("/api/push/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(nextPreferences),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Impossible d'enregistrer les alertes.");
      }

      setMessage("Preferences enregistrees.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d'enregistrer les alertes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Alertes TurfEdge</p>
          <h2 className="app-section-title">Pilote tes notifications</h2>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
        Choisis les signaux que tu veux recevoir : cheval du jour, rappel avant depart et bilan du soir.
      </p>

      {!subscribed && !loading ? (
        <div className="mt-4 rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-4 py-3 text-sm text-[var(--pmu-text-soft)]">
          Active d&apos;abord les notifications dans le navigateur pour personnaliser tes alertes.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <PreferenceRow
          title="Cheval du jour"
          description="Le meilleur signal du matin pour ouvrir la journee rapidement."
          checked={preferences.morningEnabled}
          disabled={loading || saving || !subscribed}
          onChange={(nextValue) =>
            void savePreferences({ ...preferences, morningEnabled: nextValue })
          }
        />
        <PreferenceRow
          title="30 min avant le depart"
          description="Un rappel juste avant la course quand un signal merite de revenir."
          checked={preferences.preraceEnabled}
          disabled={loading || saving || !subscribed}
          onChange={(nextValue) =>
            void savePreferences({ ...preferences, preraceEnabled: nextValue })
          }
        />
        <PreferenceRow
          title="Resultats du soir"
          description="Le bilan du jour avec gain net et ROI pour boucler la session."
          checked={preferences.resultsEnabled}
          disabled={loading || saving || !subscribed}
          onChange={(nextValue) =>
            void savePreferences({ ...preferences, resultsEnabled: nextValue })
          }
        />
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-4 py-3 text-sm text-[var(--pmu-text-soft)]">
          {message}
        </div>
      ) : null}
    </section>
  );
}
