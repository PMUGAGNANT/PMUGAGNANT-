import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PMU Gagnant — L'IA qui trie les courses PMU";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        background: "linear-gradient(135deg, #0A0E1A 0%, #0D1422 100%)",
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px",
      }}>
        {/* Top badge */}
        <div style={{
          background: "rgba(212,175,55,0.12)",
          border: "1px solid rgba(212,175,55,0.3)",
          borderRadius: 8, padding: "8px 22px",
          fontSize: 14, color: "#D4AF37", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
          marginBottom: 28,
        }}>
          TurfEdge · Algo v9.2
        </div>

        {/* Logo */}
        <div style={{
          fontSize: 90, color: "#F6F2E8", fontWeight: 800,
          letterSpacing: "-3px", lineHeight: 1,
        }}>
          PMU<span style={{ color: "#00C851" }}>Gagnant</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 28, color: "rgba(246,242,232,0.5)",
          marginTop: 18, letterSpacing: "-0.3px",
        }}>
          L&apos;IA qui trie les courses PMU
        </div>

        {/* Features row */}
        <div style={{
          marginTop: 48, display: "flex", gap: 16,
        }}>
          {["Cheval conseillé", "Mise Kelly", "JOUER / PASSER", "Alertes T-30"].map((item) => (
            <div key={item} style={{
              background: "rgba(0,200,81,0.08)",
              border: "1px solid rgba(0,200,81,0.2)",
              borderRadius: 10, padding: "10px 20px",
              fontSize: 18, color: "#00C851", fontWeight: 700,
            }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
