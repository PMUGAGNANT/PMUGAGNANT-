import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PMU Gagnant — L'IA qui analyse les courses PMU";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        background: "#0A0A0A", width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 86, color: "#D4AF37", fontWeight: 300, letterSpacing: "-2px" }}>
          PMUGagnant
        </div>
        <div style={{ fontSize: 30, color: "rgba(245,240,232,0.55)", marginTop: 20 }}>
          L&apos;IA qui analyse les courses PMU à votre place
        </div>
        <div style={{
          marginTop: 44, background: "rgba(212,175,55,0.12)",
          border: "1px solid rgba(212,175,55,0.3)", borderRadius: 16,
          padding: "16px 36px", fontSize: 26, color: "#00FF87",
          fontFamily: "monospace",
        }}>
          ROI moyen +26% · 1 247 abonnés · 14j d&apos;essai gratuit
        </div>
      </div>
    ),
    { ...size }
  );
}
