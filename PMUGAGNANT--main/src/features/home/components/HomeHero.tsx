import Image from "next/image";

import type { HomeStats } from "@/features/home/components/home-page-types";
import {
  formatCourseMeta,
  formatMinutesLabel,
  formatRaceCode,
  formatStake,
  type FeaturedRace,
} from "@/features/home/lib/home-page-model";
import { formatLiveRoi, hasLiveStatsData, type LiveStatsSnapshot } from "@/lib/live-stats";

type HomeHeroProps = {
  stats: HomeStats;
  liveStats: LiveStatsSnapshot;
  focusRace: FeaturedRace | null;
  programmeRaces: FeaturedRace[];
  onOpenPremium: () => void;
  onOpenFocus: () => void;
  onOpenRace: (race: FeaturedRace) => void;
};

function getHeroDecision(focusRace: FeaturedRace | null) {
  if (!focusRace) return { label: "ANALYSE", tone: "neutral" as const, text: "Le moteur attend les courses du jour.", color: "#8A907F" };
  if (focusRace.status === "jouable") return { label: "JOUER", tone: "success" as const, text: "Course lisible. Signal validé. Mise engagée.", color: "#00C851" };
  if (focusRace.status === "surveillance") return { label: "SURVEILLER", tone: "warning" as const, text: "Signal intéressant — confirmation attendue.", color: "#D4AF37" };
  return { label: "PASSER", tone: "neutral" as const, text: "Pas assez de signal. Le moteur ne joue pas.", color: "#8A907F" };
}

function getStatusColor(status: FeaturedRace["status"]) {
  if (status === "jouable") return "#00C851";
  if (status === "surveillance") return "#D4AF37";
  if (status === "resultat") return "#4DC8FF";
  return "#8A907F";
}

function getStatusLabel(status: FeaturedRace["status"]) {
  if (status === "jouable") return "Jouer";
  if (status === "surveillance") return "À suivre";
  if (status === "resultat") return "Résultat";
  return "Passer";
}

export function HomeHero({
  stats,
  liveStats,
  focusRace,
  programmeRaces,
  onOpenPremium,
  onOpenFocus,
  onOpenRace,
}: HomeHeroProps) {
  const decision = getHeroDecision(focusRace);
  const hasStats = hasLiveStatsData(liveStats);
  const performanceValue = hasStats ? formatLiveRoi(liveStats.roi30d) : "--";
  const performanceLabel = hasStats
    ? `${liveStats.totalPredictions} tickets · 30 jours`
    : "Données en cours";
  const focusPick = focusRace?.score?.pick;
  const focusStake = formatStake(
    focusPick?.confidence ? Math.max(6, Math.round(focusPick.confidence * 2.5)) : 8
  );
  const focusHorse =
    focusPick?.nom || focusPick?.numPmu
      ? `#${focusPick?.numPmu ?? "--"} ${focusPick?.nom ?? "Sélection"}`
      : "Ticket du jour";
  const focusCode = focusRace ? formatRaceCode(focusRace.race) : "--";
  const focusMeta = focusRace ? formatCourseMeta(focusRace.race) : "Programme en attente";
  const focusTime = focusRace?.race.heureDepart ?? "--:--";
  const focusTitle = focusRace?.race.nomCourse ?? "Course prioritaire en préparation";
  const programme = programmeRaces.slice(0, 10);
  const scoreValue = focusRace ? focusRace.scoreValue.toFixed(1) : "--";

  return (
    <>
      <style>{`
        .hh-wrap {
          display: grid;
          grid-template-columns: 1fr 26rem;
          min-height: 42rem;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(212,175,55,.15);
          background: #0A0E1A;
        }
        @media(max-width:1024px){ .hh-wrap { grid-template-columns:1fr; } .hh-aside { display:none; } }

        /* STATS BAR */
        .hh-statsbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255,255,255,.06);
          border-bottom: 1px solid rgba(255,255,255,.08);
          backdrop-filter: blur(10px);
          z-index: 2;
        }
        .hh-stat {
          padding: 14px 18px;
          background: rgba(5,10,25,.7);
        }
        .hh-stat-lbl {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(255,255,255,.4);
          margin-bottom: 6px;
        }
        .hh-stat-val {
          font-family: var(--font-mono, 'DM Mono', monospace);
          font-size: 22px;
          font-weight: 500;
          line-height: 1;
        }

        /* MAIN LEFT */
        .hh-left {
          position: relative;
          min-height: 42rem;
          overflow: hidden;
        }
        .hh-bg {
          position: absolute;
          inset: 0;
          object-fit: cover;
          opacity: .35;
        }
        .hh-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            rgba(5,10,25,.98) 0%,
            rgba(5,10,25,.82) 45%,
            rgba(5,10,25,.25) 100%
          ),
          linear-gradient(180deg, rgba(5,10,25,.3) 0%, rgba(5,10,25,.95) 100%);
        }
        .hh-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          height: 100%;
          padding: 96px 36px 36px;
        }

        /* DECISION BADGE */
        .hh-decision {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .hh-decision-badge {
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .hh-decision-badge[data-tone="success"] {
          background: rgba(0,200,81,.15);
          border: 1px solid rgba(0,200,81,.3);
          color: #00C851;
        }
        .hh-decision-badge[data-tone="warning"] {
          background: rgba(212,175,55,.12);
          border: 1px solid rgba(212,175,55,.25);
          color: #D4AF37;
        }
        .hh-decision-badge[data-tone="neutral"] {
          background: rgba(138,144,127,.1);
          border: 1px solid rgba(138,144,127,.2);
          color: #8A907F;
        }
        .hh-engine { font-size: 11px; font-weight: 700; letter-spacing: .1em; color: rgba(0,200,81,.7); }
        .hh-departure {
          font-size: 13px;
          font-weight: 700;
          color: #00C851;
          margin-bottom: 12px;
          font-family: var(--font-mono, 'DM Mono', monospace);
          letter-spacing: .06em;
        }

        /* TAGS */
        .hh-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .hh-tag {
          padding: 5px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(0,0,0,.35);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: rgba(255,255,255,.75);
          backdrop-filter: blur(4px);
        }
        .hh-tag.green { border-color: rgba(0,200,81,.3); background: rgba(0,200,81,.1); color: #00C851; }

        /* TITLE */
        .hh-title {
          font-family: var(--font-display, 'Barlow Condensed', sans-serif);
          font-size: clamp(2.4rem, 4.5vw, 5rem);
          font-weight: 800;
          line-height: .92;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: -.01em;
          margin-bottom: 14px;
          max-width: 720px;
        }
        .hh-subtitle {
          font-size: 15px;
          color: rgba(255,255,255,.6);
          line-height: 1.65;
          max-width: 560px;
          margin-bottom: 28px;
        }

        /* TICKET GRID */
        .hh-ticket {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }
        .hh-ticket-cell {
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(0,0,0,.45);
          padding: 14px 16px;
          backdrop-filter: blur(8px);
        }
        .hh-ticket-lbl {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(255,255,255,.38);
          margin-bottom: 8px;
        }
        .hh-ticket-val {
          font-family: var(--font-display, 'Barlow Condensed', sans-serif);
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: .01em;
          line-height: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hh-ticket-val.green { color: #00C851; }
        .hh-ticket-val.gold { color: #D4AF37; }

        /* SCORE BAR */
        .hh-score-wrap { margin-bottom: 24px; }
        .hh-score-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .hh-score-lbl { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.35); }
        .hh-score-val { font-family: var(--font-mono, 'DM Mono', monospace); font-size: 20px; font-weight: 500; color: #00C851; }
        .hh-score-bar { height: 6px; background: rgba(255,255,255,.08); border-radius: 3px; overflow: hidden; }
        .hh-score-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #00C851, #31E981); transition: width .6s ease; }

        /* BUTTONS */
        .hh-btns { display: flex; gap: 10px; flex-wrap: wrap; }
        .hh-btn-main {
          padding: 13px 26px;
          border-radius: 10px;
          background: #00C851;
          color: #080A12;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all .2s;
          letter-spacing: .02em;
        }
        .hh-btn-main:hover { background: #31E981; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,200,81,.35); }
        .hh-btn-sec {
          padding: 13px 22px;
          border-radius: 10px;
          border: 1px solid rgba(212,175,55,.25);
          background: transparent;
          color: #D4AF37;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all .2s;
        }
        .hh-btn-sec:hover { border-color: #D4AF37; background: rgba(212,175,55,.07); }

        /* ASIDE */
        .hh-aside {
          display: flex;
          flex-direction: column;
          background: #0D1422;
          border-left: 1px solid rgba(212,175,55,.1);
          overflow: hidden;
        }
        .hh-aside-head {
          padding: 20px 20px 16px;
          border-bottom: 1px solid rgba(212,175,55,.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hh-aside-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(246,242,232,.45);
        }
        .hh-aside-count {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #00C851;
          color: #080A12;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hh-aside-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,175,55,.2) transparent;
        }
        .hh-course-btn {
          width: 100%;
          text-align: left;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid rgba(212,175,55,.1);
          background: rgba(255,255,255,.03);
          cursor: pointer;
          transition: all .18s;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .hh-course-btn:hover { background: rgba(0,200,81,.06); border-color: rgba(0,200,81,.2); }
        .hh-course-btn.focus { background: rgba(0,200,81,.1); border-color: rgba(0,200,81,.35); }
        .hh-course-code {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background: rgba(255,255,255,.05);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display, 'Barlow Condensed', sans-serif);
          font-size: 14px;
          font-weight: 800;
          color: rgba(246,242,232,.7);
          flex-shrink: 0;
          letter-spacing: .01em;
        }
        .hh-course-btn.focus .hh-course-code { background: rgba(0,200,81,.15); color: #00C851; }
        .hh-course-info { flex: 1; min-width: 0; }
        .hh-course-hippe {
          font-size: 14px;
          font-weight: 700;
          color: rgba(246,242,232,.85);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hh-course-name {
          font-size: 11px;
          color: rgba(246,242,232,.35);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .hh-course-tags { display: flex; gap: 5px; margin-top: 5px; }
        .hh-course-tag {
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .06em;
        }
        .hh-course-time {
          font-family: var(--font-mono, 'DM Mono', monospace);
          font-size: 12px;
          color: rgba(246,242,232,.4);
          flex-shrink: 0;
        }

        /* PROOF */
        .hh-proof {
          margin: 0 12px 12px;
          padding: 16px;
          border-radius: 10px;
          background: rgba(0,200,81,.06);
          border: 1px solid rgba(0,200,81,.12);
        }
        .hh-proof-lbl {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(0,200,81,.6);
          margin-bottom: 6px;
        }
        .hh-proof-val {
          font-family: var(--font-mono, 'DM Mono', monospace);
          font-size: 28px;
          font-weight: 500;
          color: #00C851;
          line-height: 1;
          margin-bottom: 4px;
        }
        .hh-proof-sub { font-size: 12px; color: rgba(246,242,232,.35); }
      `}</style>

      <section className="hh-wrap">
        {/* LEFT — HERO */}
        <div className="hh-left">
          <Image
            src="/pmu-waiting-race.png"
            alt="Course hippique analysée par PMU Gagnant"
            fill
            priority
            sizes="(min-width: 1024px) calc(100vw - 26rem), 100vw"
            className="hh-bg"
          />
          <div className="hh-overlay" />

          {/* STATS BAR */}
          <div className="hh-statsbar">
            <div className="hh-stat">
              <div className="hh-stat-lbl">Décision IA</div>
              <div className="hh-stat-val">
                <span
                  className="hh-decision-badge"
                  data-tone={decision.tone}
                  style={{fontSize:13, padding:"4px 10px"}}
                >
                  {decision.label}
                </span>
                {" "}
                <span className="hh-engine">V9.2</span>
              </div>
            </div>
            <div className="hh-stat">
              <div className="hh-stat-lbl">Course focus</div>
              <div className="hh-stat-val" style={{color:"#00C851"}}>{focusCode}</div>
            </div>
            <div className="hh-stat">
              <div className="hh-stat-lbl">Tickets valides</div>
              <div className="hh-stat-val" style={{color:"#F6F2E8"}}>{stats.playable}</div>
            </div>
            <div className="hh-stat">
              <div className="hh-stat-lbl">ROI réel</div>
              <div className="hh-stat-val" style={{color:"#D4AF37"}}>{performanceValue}</div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="hh-content">
            <div className="hh-decision">
              <span className="hh-decision-badge" data-tone={decision.tone}>
                {decision.label}
              </span>
              <span className="hh-engine">TURFEDGE V9.2</span>
            </div>

            <p className="hh-departure">
              Départ dans {formatMinutesLabel(focusRace?.minutesUntilStart)}
            </p>

            <div className="hh-tags">
              <span className="hh-tag green">Programme IA</span>
              <span className="hh-tag">{focusMeta}</span>
              <span className="hh-tag">{focusTime}</span>
            </div>

            <h1 className="hh-title">
              {focusCode} {focusTitle}
            </h1>

            <p className="hh-subtitle">
              {decision.text} Choisissez la course, vérifiez le cheval, ouvrez le ticket.
            </p>

            {/* TICKET */}
            <div className="hh-ticket">
              <div className="hh-ticket-cell">
                <div className="hh-ticket-lbl">Cheval</div>
                <div className="hh-ticket-val">{focusHorse}</div>
              </div>
              <div className="hh-ticket-cell">
                <div className="hh-ticket-lbl">Mise Kelly</div>
                <div className="hh-ticket-val gold">{focusStake}</div>
              </div>
              <div className="hh-ticket-cell">
                <div className="hh-ticket-lbl">Confiance</div>
                <div className="hh-ticket-val green">
                  {focusRace ? `${scoreValue}/10` : "--"}
                </div>
              </div>
            </div>

            {/* SCORE BAR */}
            {focusRace && (
              <div className="hh-score-wrap">
                <div className="hh-score-header">
                  <span className="hh-score-lbl">Score VMAX</span>
                  <span className="hh-score-val">
                    {Math.round(focusRace.scoreValue * 10)}/100
                  </span>
                </div>
                <div className="hh-score-bar">
                  <div
                    className="hh-score-fill"
                    style={{width:`${Math.min(100, focusRace.scoreValue * 10)}%`}}
                  />
                </div>
              </div>
            )}

            <div className="hh-btns">
              <button type="button" className="hh-btn-main" onClick={onOpenFocus}>
                Ouvrir la course →
              </button>
              <button type="button" className="hh-btn-sec" onClick={onOpenPremium}>
                Débloquer Premium
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — PROGRAMME */}
        <aside className="hh-aside">
          <div className="hh-aside-head">
            <div>
              <div className="hh-aside-title">Programme du jour</div>
              <div style={{fontSize:18,fontWeight:700,color:"#F6F2E8",marginTop:4}}>
                {stats.total} courses analysées
              </div>
            </div>
            <div className="hh-aside-count">{stats.total}</div>
          </div>

          <div className="hh-aside-list">
            {programme.length > 0 ? (
              programme.map((item) => {
                const code = formatRaceCode(item.race);
                const isFocus =
                  focusRace &&
                  item.race.reunion === focusRace.race.reunion &&
                  item.race.course === focusRace.race.course;
                const statusColor = getStatusColor(item.status);
                const statusLabel = getStatusLabel(item.status);

                return (
                  <button
                    key={`${item.race.reunion}-${item.race.course}-${item.race.dateStr}`}
                    type="button"
                    onClick={() => onOpenRace(item)}
                    className={`hh-course-btn${isFocus ? " focus" : ""}`}
                  >
                    <div className="hh-course-code">{code}</div>
                    <div className="hh-course-info">
                      <div className="hh-course-hippe">{item.race.hippodrome}</div>
                      <div className="hh-course-name">{item.race.nomCourse}</div>
                      <div className="hh-course-tags">
                        <span
                          className="hh-course-tag"
                          style={{
                            background: `${statusColor}18`,
                            color: statusColor,
                            border: `1px solid ${statusColor}28`,
                          }}
                        >
                          {statusLabel}
                        </span>
                        <span
                          className="hh-course-tag"
                          style={{
                            background: "rgba(255,255,255,.04)",
                            color: "rgba(246,242,232,.35)",
                            border: "1px solid rgba(255,255,255,.07)",
                          }}
                        >
                          {item.race.nombrePartants} partants
                        </span>
                        {item.race.estQuinte && (
                          <span
                            className="hh-course-tag"
                            style={{
                              background: "rgba(212,175,55,.1)",
                              color: "#D4AF37",
                              border: "1px solid rgba(212,175,55,.2)",
                            }}
                          >
                            Quinté+
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hh-course-time">{item.race.heureDepart}</div>
                  </button>
                );
              })
            ) : (
              <div style={{
                padding:20,
                borderRadius:10,
                background:"rgba(255,255,255,.03)",
                border:"1px solid rgba(212,175,55,.08)",
                fontSize:14,
                color:"rgba(246,242,232,.4)",
                textAlign:"center",
                lineHeight:1.6
              }}>
                Le programme charge les courses du jour.
              </div>
            )}
          </div>

          {/* PROOF */}
          <div className="hh-proof">
            <div className="hh-proof-lbl">Preuve moteur · 30 jours</div>
            <div className="hh-proof-val">{performanceValue}</div>
            <div className="hh-proof-sub">{performanceLabel}</div>
          </div>
        </aside>
      </section>
    </>
  );
}
