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
  isPro: boolean;
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
  return "#636B5C";
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
  isPro,
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
  const rawConfidence = focusPick?.confidence ?? 0;
  const shouldPlayFocus = rawConfidence >= 6;
  const focusStake = !focusRace
    ? "--"
    : shouldPlayFocus
      ? formatStake(Math.max(6, Math.round(rawConfidence * 2.5)))
      : "0 €";

  // Cheval : visible si PRO ou si le pick est disponible ET non verrouillé
  const hasHorse = !!(focusPick?.nom || focusPick?.numPmu);
  const horseVisible = isPro && hasHorse;
  const focusHorse = hasHorse
    ? `#${focusPick?.numPmu ?? "--"} ${focusPick?.nom ?? "Sélection"}`
    : "Ticket du jour";

  const focusCode = focusRace ? formatRaceCode(focusRace.race) : "--";
  const focusMeta = focusRace ? formatCourseMeta(focusRace.race) : "Programme en attente";
  const focusTime = focusRace?.race.heureDepart ?? "--:--";
  const focusTitle = focusRace?.race.nomCourse ?? "Course prioritaire en préparation";
  const scoreValue = focusRace ? focusRace.scoreValue.toFixed(1) : "--";
  const scorePct = focusRace ? Math.min(100, Math.round(focusRace.scoreValue * 10)) : 0;

  // Programme : toutes les courses triées (jouables en premier)
  const programme = [...programmeRaces].sort((a, b) => {
    const order = { jouable: 0, surveillance: 1, passer: 2, resultat: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  }).slice(0, 20);

  return (
    <>
      <style>{`
        .hh-wrap {
          display: grid;
          grid-template-columns: 1fr 27rem;
          min-height: 44rem;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(212,175,55,.15);
          background: #0A0E1A;
        }
        @media(max-width:1024px){ .hh-wrap{grid-template-columns:1fr} .hh-aside{display:none} }

        /* STATS BAR */
        .hh-statsbar {
          position:absolute; top:0; left:0; right:0;
          display:grid; grid-template-columns:repeat(4,1fr); gap:1px;
          background:rgba(255,255,255,.05); border-bottom:1px solid rgba(255,255,255,.07);
          backdrop-filter:blur(12px); z-index:2;
        }
        .hh-stat { padding:13px 18px; background:rgba(5,10,25,.75); }
        .hh-stat-lbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.38); margin-bottom:6px; }
        .hh-stat-val { font-family:var(--font-mono,'DM Mono',monospace); font-size:20px; font-weight:500; line-height:1; }

        /* LEFT */
        .hh-left { position:relative; min-height:44rem; overflow:hidden; }
        .hh-bg { position:absolute; inset:0; object-fit:cover; opacity:.3; }
        .hh-overlay {
          position:absolute; inset:0;
          background:linear-gradient(105deg,rgba(5,10,25,.99) 0%,rgba(5,10,25,.85) 42%,rgba(5,10,25,.3) 100%),
                    linear-gradient(180deg,rgba(5,10,25,.25) 0%,rgba(5,10,25,.97) 100%);
        }
        .hh-content { position:relative; z-index:1; display:flex; flex-direction:column; justify-content:flex-end; height:100%; padding:90px 36px 34px; }

        /* BADGES */
        .hh-decision-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .hh-badge {
          padding:5px 13px; border-radius:7px; font-size:12px; font-weight:700;
          letter-spacing:.1em; text-transform:uppercase;
        }
        .hh-badge[data-tone="success"]{ background:rgba(0,200,81,.15); border:1px solid rgba(0,200,81,.3); color:#00C851; }
        .hh-badge[data-tone="warning"]{ background:rgba(212,175,55,.12); border:1px solid rgba(212,175,55,.25); color:#D4AF37; }
        .hh-badge[data-tone="neutral"]{ background:rgba(138,144,127,.1); border:1px solid rgba(138,144,127,.2); color:#8A907F; }
        .hh-engine { font-size:11px; font-weight:700; letter-spacing:.1em; color:rgba(0,200,81,.65); }
        .hh-departure { font-size:13px; font-weight:700; color:#00C851; margin-bottom:10px; font-family:var(--font-mono,'DM Mono',monospace); }
        .hh-tags { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:18px; }
        .hh-tag { padding:4px 11px; border-radius:6px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.35); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:rgba(255,255,255,.7); }
        .hh-tag.green { border-color:rgba(0,200,81,.3); background:rgba(0,200,81,.1); color:#00C851; }
        .hh-title { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:clamp(2.2rem,4vw,4.6rem); font-weight:800; line-height:.9; color:#fff; text-transform:uppercase; letter-spacing:-.01em; margin-bottom:12px; max-width:680px; }
        .hh-subtitle { font-size:14px; color:rgba(255,255,255,.55); line-height:1.65; max-width:540px; margin-bottom:24px; }

        /* TICKET */
        .hh-ticket { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
        .hh-cell { border-radius:10px; border:1px solid rgba(255,255,255,.1); background:rgba(0,0,0,.42); padding:13px 15px; backdrop-filter:blur(8px); position:relative; overflow:hidden; }
        .hh-cell-lbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.36); margin-bottom:7px; }
        .hh-cell-val { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:21px; font-weight:800; color:#fff; text-transform:uppercase; line-height:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .hh-cell-val.green { color:#00C851; }
        .hh-cell-val.gold { color:#D4AF37; }

        /* LOCKED STATE */
        .hh-locked {
          position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
          background:rgba(8,10,18,.8); backdrop-filter:blur(5px); border-radius:9px; gap:4px; cursor:pointer;
          border:1px solid rgba(212,175,55,.2); transition:all .2s;
        }
        .hh-locked:hover { background:rgba(212,175,55,.08); border-color:rgba(212,175,55,.35); }
        .hh-locked-ico { font-size:18px; }
        .hh-locked-txt { font-family:var(--font-mono,'DM Mono',monospace); font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:rgba(212,175,55,.6); }

        /* SCORE */
        .hh-score-wrap { margin-bottom:22px; }
        .hh-score-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .hh-score-lbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.32); }
        .hh-score-val { font-family:var(--font-mono,'DM Mono',monospace); font-size:18px; font-weight:500; color:#00C851; }
        .hh-score-bar { height:5px; background:rgba(255,255,255,.07); border-radius:3px; overflow:hidden; }
        .hh-score-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,#00C851,#31E981); transition:width .6s ease; }

        /* BTNS */
        .hh-btns { display:flex; gap:9px; flex-wrap:wrap; }
        .hh-btn-main { padding:12px 24px; border-radius:9px; background:#00C851; color:#080A12; font-size:14px; font-weight:700; border:none; cursor:pointer; transition:all .2s; letter-spacing:.02em; }
        .hh-btn-main:hover { background:#31E981; transform:translateY(-1px); box-shadow:0 7px 24px rgba(0,200,81,.35); }
        .hh-btn-sec { padding:12px 20px; border-radius:9px; border:1px solid rgba(212,175,55,.25); background:transparent; color:#D4AF37; font-size:14px; font-weight:700; cursor:pointer; transition:all .2s; }
        .hh-btn-sec:hover { border-color:#D4AF37; background:rgba(212,175,55,.07); }

        /* ASIDE */
        .hh-aside { display:flex; flex-direction:column; background:#0D1422; border-left:1px solid rgba(212,175,55,.1); overflow:hidden; }
        .hh-aside-head { padding:18px 18px 14px; border-bottom:1px solid rgba(212,175,55,.08); display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .hh-aside-title { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(246,242,232,.4); }
        .hh-aside-h { font-size:17px; font-weight:700; color:#F6F2E8; margin-top:2px; }
        .hh-aside-count { width:30px; height:30px; border-radius:7px; background:#00C851; color:#080A12; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

        /* FILTER TABS */
        .hh-tabs { display:grid; grid-template-columns:repeat(2,1fr); margin:10px 12px 8px; gap:4px; }
        .hh-tab { padding:7px; border-radius:7px; font-size:11px; font-weight:700; text-align:center; cursor:pointer; border:none; transition:all .2s; background:rgba(255,255,255,.04); color:rgba(246,242,232,.35); }
        .hh-tab.active { background:rgba(0,200,81,.12); color:#00C851; border:1px solid rgba(0,200,81,.2); }

        /* LIST */
        .hh-list { flex:1; overflow-y:auto; padding:0 10px 8px; display:flex; flex-direction:column; gap:4px; scrollbar-width:thin; scrollbar-color:rgba(212,175,55,.15) transparent; }
        .hh-course { width:100%; text-align:left; padding:10px 12px; border-radius:10px; border:1px solid rgba(212,175,55,.08); background:rgba(255,255,255,.02); cursor:pointer; transition:all .18s; display:flex; align-items:center; gap:10px; }
        .hh-course:hover { background:rgba(0,200,81,.05); border-color:rgba(0,200,81,.18); }
        .hh-course.focus-race { background:rgba(0,200,81,.09); border-color:rgba(0,200,81,.3); }
        .hh-course-code { width:44px; height:44px; border-radius:8px; background:rgba(255,255,255,.04); display:flex; align-items:center; justify-content:center; font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:12px; font-weight:800; color:rgba(246,242,232,.6); flex-shrink:0; letter-spacing:.01em; }
        .hh-course.focus-race .hh-course-code { background:rgba(0,200,81,.15); color:#00C851; }
        .hh-course-info { flex:1; min-width:0; }
        .hh-course-hippe { font-size:13px; font-weight:700; color:rgba(246,242,232,.82); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hh-course-nom { font-size:11px; color:rgba(246,242,232,.32); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
        .hh-course-meta { display:flex; align-items:center; gap:5px; margin-top:5px; }
        .hh-badge-sm { padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; letter-spacing:.06em; }
        .hh-course-time { font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; color:rgba(246,242,232,.35); flex-shrink:0; }

        /* PROOF */
        .hh-proof { margin:8px 10px 10px; padding:14px 16px; border-radius:10px; background:rgba(0,200,81,.05); border:1px solid rgba(0,200,81,.1); }
        .hh-proof-lbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(0,200,81,.55); margin-bottom:5px; }
        .hh-proof-val { font-family:var(--font-mono,'DM Mono',monospace); font-size:26px; font-weight:500; color:#00C851; line-height:1; margin-bottom:3px; }
        .hh-proof-sub { font-size:11px; color:rgba(246,242,232,.32); }

        /* PRO BANNER */
        .hh-pro-banner { margin:8px 10px 4px; padding:12px 14px; border-radius:10px; background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(212,175,55,.04)); border:1px solid rgba(212,175,55,.2); display:flex; align-items:center; gap:10px; cursor:pointer; transition:all .2s; }
        .hh-pro-banner:hover { background:rgba(212,175,55,.12); border-color:rgba(212,175,55,.35); }
        .hh-pro-banner-ico { font-size:20px; flex-shrink:0; }
        .hh-pro-banner-txt { flex:1; }
        .hh-pro-banner-title { font-size:13px; font-weight:700; color:#D4AF37; }
        .hh-pro-banner-sub { font-size:11px; color:rgba(212,175,55,.5); margin-top:1px; }
        .hh-pro-banner-arrow { color:rgba(212,175,55,.5); font-size:16px; }
      `}</style>

      <section className="hh-wrap">
        {/* ── LEFT ── */}
        <div className="hh-left">
          <Image
            src="/pmu-waiting-race.png"
            alt="Course hippique analysée par PMU Gagnant"
            fill priority
            sizes="(min-width:1024px) calc(100vw - 27rem), 100vw"
            className="hh-bg"
          />
          <div className="hh-overlay" />

          {/* STATS BAR */}
          <div className="hh-statsbar">
            <div className="hh-stat">
              <div className="hh-stat-lbl">Décision IA</div>
              <div className="hh-stat-val">
                <span className="hh-badge" data-tone={decision.tone} style={{fontSize:12,padding:"3px 10px"}}>{decision.label}</span>
                {" "}<span className="hh-engine">V9.2</span>
              </div>
            </div>
            <div className="hh-stat">
              <div className="hh-stat-lbl">Course focus</div>
              <div className="hh-stat-val" style={{color:"#00C851"}}>{focusCode}</div>
            </div>
            <div className="hh-stat">
              <div className="hh-stat-lbl">Tickets validés</div>
              <div className="hh-stat-val" style={{color:"#F6F2E8"}}>{stats.playable}</div>
            </div>
            <div className="hh-stat">
              <div className="hh-stat-lbl">ROI réel</div>
              <div className="hh-stat-val" style={{color:"#D4AF37"}}>{performanceValue}</div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="hh-content">
            <div className="hh-decision-row">
              <span className="hh-badge" data-tone={decision.tone}>{decision.label}</span>
              <span className="hh-engine">TURFEDGE V9.2</span>
              {isPro && (
                <span style={{padding:"3px 10px",borderRadius:6,background:"rgba(212,175,55,.1)",border:"1px solid rgba(212,175,55,.2)",fontSize:10,fontWeight:700,letterSpacing:".1em",color:"#D4AF37",textTransform:"uppercase"}}>
                  PRO
                </span>
              )}
            </div>

            <p className="hh-departure">
              Départ dans {formatMinutesLabel(focusRace?.minutesUntilStart)}
            </p>

            <div className="hh-tags">
              <span className="hh-tag green">Programme IA</span>
              <span className="hh-tag">{focusMeta}</span>
              <span className="hh-tag">{focusTime}</span>
            </div>

            <h1 className="hh-title">{focusCode} {focusTitle}</h1>
            <p className="hh-subtitle">{decision.text} Choisissez la course, vérifiez le cheval, ouvrez le ticket.</p>

            {/* TICKET : 3 cellules */}
            <div className="hh-ticket">
              {/* CHEVAL : verrouillé si non PRO */}
              <div className="hh-cell" style={{position:"relative"}}>
                <div className="hh-cell-lbl">Cheval</div>
                <div className="hh-cell-val" style={{filter:horseVisible?"none":"blur(6px)",userSelect:horseVisible?"auto":"none"}}>
                  {focusHorse}
                </div>
                {!isPro && hasHorse && (
                  <div className="hh-locked" onClick={onOpenPremium}>
                    <div className="hh-locked-ico">🔒</div>
                    <div className="hh-locked-txt">Premium</div>
                  </div>
                )}
              </div>

              <div className="hh-cell">
                <div className="hh-cell-lbl">Mise Kelly</div>
                <div className="hh-cell-val gold">{focusStake}</div>
              </div>

              <div className="hh-cell">
                <div className="hh-cell-lbl">Confiance</div>
                <div className="hh-cell-val green">
                  {focusRace ? `${scoreValue}/10` : "--"}
                </div>
              </div>
            </div>

            {/* SCORE BAR */}
            {focusRace && (
              <div className="hh-score-wrap">
                <div className="hh-score-header">
                  <span className="hh-score-lbl">Score VMAX</span>
                  <span className="hh-score-val">{scorePct}/100</span>
                </div>
                <div className="hh-score-bar">
                  <div className="hh-score-fill" style={{width:`${scorePct}%`}} />
                </div>
              </div>
            )}

            {/* BOUTONS : adaptatifs selon isPro */}
            <div className="hh-btns">
              <button type="button" className="hh-btn-main" onClick={onOpenFocus}>
                {isPro ? "Ouvrir la course →" : "Voir la course →"}
              </button>
              {!isPro && (
                <button type="button" className="hh-btn-sec" onClick={onOpenPremium}>
                  🔓 Débloquer le cheval
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── ASIDE : Programme ── */}
        <aside className="hh-aside">
          <div className="hh-aside-head">
            <div>
              <div className="hh-aside-title">Programme du jour</div>
              <div className="hh-aside-h">{stats.total} courses analysées</div>
            </div>
            <div className="hh-aside-count">{stats.playable}</div>
          </div>

          {/* Légende rapide */}
          <div style={{padding:"8px 14px 4px",display:"flex",alignItems:"center",gap:10,fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>
            <span style={{color:"#00C851"}}>● Jouer ({stats.playable})</span>
            <span style={{color:"#D4AF37"}}>● Surveiller</span>
            <span style={{color:"rgba(246,242,232,.25)"}}>● Passer</span>
          </div>

          <div className="hh-list">
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
                    className={`hh-course${isFocus ? " focus-race" : ""}`}
                  >
                    <div className="hh-course-code">{code}</div>
                    <div className="hh-course-info">
                      <div className="hh-course-hippe">{item.race.hippodrome}</div>
                      <div className="hh-course-nom">{item.race.nomCourse}</div>
                      <div className="hh-course-meta">
                        <span
                          className="hh-badge-sm"
                          style={{background:`${statusColor}18`,color:statusColor,border:`1px solid ${statusColor}28`}}
                        >
                          {statusLabel}
                        </span>
                        {item.race.estQuinte && (
                          <span className="hh-badge-sm" style={{background:"rgba(212,175,55,.1)",color:"#D4AF37",border:"1px solid rgba(212,175,55,.2)"}}>
                            Q+
                          </span>
                        )}
                        <span className="hh-badge-sm" style={{background:"rgba(255,255,255,.04)",color:"rgba(246,242,232,.3)",border:"1px solid rgba(255,255,255,.06)"}}>
                          {item.race.nombrePartants}p
                        </span>
                      </div>
                    </div>
                    <div className="hh-course-time">{item.race.heureDepart}</div>
                  </button>
                );
              })
            ) : (
              <div style={{padding:20,borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(212,175,55,.07)",fontSize:13,color:"rgba(246,242,232,.35)",textAlign:"center",lineHeight:1.6}}>
                Le programme charge les courses du jour.
              </div>
            )}
          </div>

          {/* PRO BANNER si non abonné */}
          {!isPro && (
            <button type="button" className="hh-pro-banner" onClick={onOpenPremium}>
              <div className="hh-pro-banner-ico">🔓</div>
              <div className="hh-pro-banner-txt">
                <div className="hh-pro-banner-title">Débloquer Premium</div>
                <div className="hh-pro-banner-sub">Voir le cheval · Alertes Telegram · ROI complet</div>
              </div>
              <div className="hh-pro-banner-arrow">›</div>
            </button>
          )}

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
