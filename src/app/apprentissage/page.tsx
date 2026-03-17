"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const GREEN = "#00843D";
const GREEN_DARK = "#0C6B35";
const DARK = "#17191B";

type SignalRow = {
  key: string;
  label: string;
  description: string;
  value: number;
  delta: number;
  impact: "boost" | "neutral" | "trim";
};

type ProfileSummary = {
  scope: "GLOBAL" | "PLAT" | "TROT";
  label: string;
  version: string;
  createdAt: string | null;
  samples: number;
  successRate: number;
  successes: number;
  failures: number;
  strongestSignals: SignalRow[];
  weakestSignals: SignalRow[];
  signals: SignalRow[];
};

type LearningResponse = {
  success: boolean;
  message?: string;
  summary?: {
    source: "supabase" | "modele-emarque";
    samples: number;
    successRate: number;
    lastTrainingAt: string | null;
    healthMessage: string;
  };
  profiles?: ProfileSummary[];
};

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Date inconnue";

  return new Date(value).toLocaleString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSignalTone(signal: SignalRow) {
  if (signal.impact === "boost") {
    return {
      badgeBackground: "#E8F5E9",
      badgeColor: GREEN,
      valueColor: GREEN_DARK,
      label: `+${signal.delta.toFixed(3)}`,
    };
  }

  if (signal.impact === "trim") {
    return {
      badgeBackground: "#FDECEA",
      badgeColor: "#C0392B",
      valueColor: "#C0392B",
      label: signal.delta.toFixed(3),
    };
  }

  return {
    badgeBackground: "#F3F4F6",
    badgeColor: "#666",
    valueColor: "#444",
    label: `${signal.delta >= 0 ? "+" : ""}${signal.delta.toFixed(3)}`,
  };
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn";
}) {
  const color = tone === "good" ? GREEN : tone === "warn" ? "#A66B00" : DARK;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 24,
        padding: 18,
        border: "1px solid rgba(15,23,42,0.05)",
        boxShadow: "0 18px 32px rgba(15,23,42,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#7A7A7A",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 32, lineHeight: "34px", fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function SignalCard({
  title,
  signals,
}: {
  title: string;
  signals: SignalRow[];
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 24,
        padding: 18,
        border: "1px solid rgba(15,23,42,0.05)",
        boxShadow: "0 18px 32px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {signals.map((signal) => {
          const tone = getSignalTone(signal);
          return (
            <div
              key={signal.key}
              style={{
                borderRadius: 18,
                padding: "12px 14px",
                background: "linear-gradient(180deg, #FBFCFC 0%, #F5F7F8 100%)",
                border: "1px solid rgba(15,23,42,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: DARK }}>{signal.label}</div>
                <span
                  style={{
                    background: tone.badgeBackground,
                    color: tone.badgeColor,
                    padding: "5px 9px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {tone.label}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280", lineHeight: "17px" }}>
                {signal.description}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: tone.valueColor }}>
                Poids actif: {signal.value.toFixed(3)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ApprentissagePage() {
  const router = useRouter();
  const [data, setData] = useState<LearningResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/apprentissage", { cache: "no-store" });
        const json = (await response.json()) as LearningResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) {
          setData({
            success: false,
            message: "Impossible de charger le tableau d'apprentissage.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const globalProfile = useMemo(
    () => data?.profiles?.find((profile) => profile.scope === "GLOBAL") ?? data?.profiles?.[0] ?? null,
    [data]
  );

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,132,61,0.12), transparent 24%), linear-gradient(180deg, #F6F9F8 0%, #EEF4F2 100%)",
        paddingBottom: 92,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(18, 22, 26, 0.88)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{
            position: "absolute",
            left: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 19, letterSpacing: "-0.3px" }}>
          Apprentissage IA
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <div
          style={{
            background:
              "radial-gradient(circle at top right, rgba(255,255,255,0.14), transparent 32%), linear-gradient(135deg, #118C4F 0%, #0A6D3A 100%)",
            borderRadius: 30,
            padding: 24,
            color: "#FFFFFF",
            boxShadow: "0 28px 56px rgba(0,132,61,0.22)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.88, marginBottom: 8 }}>Modele vivant</div>
          <div style={{ fontSize: 34, lineHeight: "38px", fontWeight: 900, letterSpacing: "-1.2px", marginBottom: 8 }}>
            L&apos;algo apprend de l&apos;historique
          </div>
          <div style={{ fontSize: 14, lineHeight: "20px", opacity: 0.92 }}>
            Il se recale sur les resultats passes pour savoir quels signaux aident vraiment a trouver les bonnes courses et les bons tickets.
          </div>
          {data?.summary && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 18,
                background: "rgba(255,255,255,0.12)",
                fontSize: 13,
                lineHeight: "18px",
              }}
            >
              {data.summary.healthMessage}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: "#666" }}>Chargement de l&apos;apprentissage...</div>
      ) : !data?.success || !data.summary || !data.profiles ? (
        <div
          style={{
            margin: "0 16px",
            background: "#FFF3CD",
            color: "#856404",
            padding: 16,
            borderRadius: 18,
            fontWeight: 600,
            lineHeight: "20px",
          }}
        >
          {data?.message ?? "Impossible de charger l'apprentissage IA."}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px" }}>
            <SummaryCard label="Echantillons 1 an" value={data.summary.samples.toLocaleString("fr-FR")} />
            <SummaryCard label="Taux global" value={formatRate(data.summary.successRate)} tone={data.summary.successRate >= 24 ? "good" : "warn"} />
            <SummaryCard label="Source active" value={data.summary.source === "supabase" ? "LIVE" : "EMBARQUE"} tone={data.summary.source === "supabase" ? "good" : "warn"} />
            <SummaryCard label="Dernier train" value={new Date(data.summary.lastTrainingAt ?? Date.now()).toLocaleDateString("fr-FR")} />
          </div>

          {globalProfile && (
            <div
              style={{
                margin: "16px",
                background: "#FFFFFF",
                borderRadius: 24,
                padding: 18,
                border: "1px solid rgba(15,23,42,0.05)",
                boxShadow: "0 18px 32px rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 800, color: DARK, marginBottom: 6 }}>Modele global actif</div>
              <div style={{ fontSize: 13, color: "#5F6B68", lineHeight: "19px" }}>
                Version <strong>{globalProfile.version}</strong> mise a jour le{" "}
                <strong>{formatDateTime(globalProfile.createdAt)}</strong>.
              </div>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ background: "#E8F5E9", color: GREEN, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                  Reussites {globalProfile.successes.toLocaleString("fr-FR")}
                </span>
                <span style={{ background: "#FDECEA", color: "#C0392B", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                  Echecs {globalProfile.failures.toLocaleString("fr-FR")}
                </span>
                <span style={{ background: "#EEF5FF", color: "#1565C0", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                  Taux {formatRate(globalProfile.successRate)}
                </span>
              </div>
            </div>
          )}

          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
            {data.profiles.map((profile) => (
              <div
                key={profile.scope}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 24,
                  padding: 18,
                  border: "1px solid rgba(15,23,42,0.05)",
                  boxShadow: "0 18px 32px rgba(15,23,42,0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
                      Profil {profile.label}
                    </div>
                    <div style={{ fontSize: 24, lineHeight: "28px", fontWeight: 900, color: DARK }}>
                      {formatRate(profile.successRate)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#F3F7F5",
                      color: GREEN_DARK,
                      borderRadius: 16,
                      padding: "10px 12px",
                      minWidth: 106,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#70817A", marginBottom: 4 }}>Echantillons</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{profile.samples.toLocaleString("fr-FR")}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "#F8FAFB", borderRadius: 16, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Signaux les plus forts</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>
                      {profile.strongestSignals.slice(0, 2).map((signal) => signal.label).join(" • ")}
                    </div>
                  </div>
                  <div style={{ background: "#F8FAFB", borderRadius: 16, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Signaux a surveiller</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>
                      {profile.weakestSignals.slice(0, 2).map((signal) => signal.label).join(" • ")}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <SignalCard title="Ce que le modele renforce" signals={profile.strongestSignals} />
                  <SignalCard title="Ce que le modele tempere" signals={profile.weakestSignals} />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              margin: "16px",
              borderRadius: 24,
              background: "#FFFFFF",
              border: "1px solid rgba(15,23,42,0.05)",
              boxShadow: "0 18px 32px rgba(15,23,42,0.08)",
              padding: 18,
            }}
          >
            <div style={{ fontSize: 19, fontWeight: 800, color: DARK, marginBottom: 10 }}>Comment l&apos;IA devient plus forte</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "#56636A", lineHeight: "20px" }}>
              <div>1. Elle rejoue les courses passees et enregistre les tickets conseilles.</div>
              <div>2. Elle compare ces tickets aux vrais rapports et aux arrivees officielles.</div>
              <div>3. Elle renforce les signaux utiles et tempere ceux qui produisent trop d&apos;erreurs.</div>
              <div>4. Elle embarque ensuite un nouveau profil de poids plus adapte au plat, au trot et au global.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
