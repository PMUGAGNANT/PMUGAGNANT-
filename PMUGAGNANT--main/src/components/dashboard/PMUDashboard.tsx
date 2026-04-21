'use client'

import { useEffect, useState } from 'react'
import type { PredictionRow, RaceSummary, RunnerOutcomeRow } from '@/lib/types'

export interface PMUDashboardProps {
  race?: RaceSummary | null
  predictions?: PredictionRow[]
  roiMois?: number | null
  tauxReussite?: number | null
  nbPronostics?: number | null
  bankroll?: number | null
  miseConseillee?: number | null
  derniereSynchro?: string
  algoVersion?: string
  runnerOutcomes?: RunnerOutcomeRow[]
}

function formatClock(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatPercent(value: number | null | undefined, signed = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  const rounded = Math.round(value)
  return `${signed && rounded > 0 ? '+' : ''}${rounded}%`
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return String(Math.max(0, Math.round(value)))
}

function formatEuro(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${Math.max(0, Math.round(value))} EUR`
}

function formatSignedEuro(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${value >= 0 ? '+' : ''}${Math.round(value)} EUR`
}

export default function PMUDashboard({
  race = null,
  predictions = [],
  roiMois = null,
  tauxReussite = null,
  nbPronostics = null,
  bankroll = null,
  miseConseillee = null,
  derniereSynchro,
  algoVersion = 'VMAX',
  runnerOutcomes = [],
}: PMUDashboardProps) {
  const [sent, setSent] = useState(false)
  const [synced, setSynced] = useState(() => derniereSynchro ?? formatClock(new Date()))

  useEffect(() => {
    const t = setInterval(() => {
      setSynced(formatClock(new Date()))
    }, 60000)
    return () => clearInterval(t)
  }, [])

  const sorted = [...predictions]
    .filter((p) => !p.non_partant)
    .sort((a, b) => {
      const aStake = a.mise_simulee ?? 0
      const bStake = b.mise_simulee ?? 0
      if (aStake > 0 && bStake <= 0) return -1
      if (aStake <= 0 && bStake > 0) return 1
      return (
        (b.score_blended ?? b.score_cheval ?? b.score_final_pari ?? 0) -
        (a.score_blended ?? a.score_cheval ?? a.score_final_pari ?? 0)
      )
    })
    .slice(0, 7)

  const raceName = race ? race.nomCourse || `R${race.reunion}C${race.course}` : 'Course en attente'
  const raceInfo = race
    ? `${race.hippodrome} - ${race.discipline} - ${race.heureDepart}`
    : 'donnees insuffisantes'

  function kellyTier(mise: number): string {
    if (mise >= 10) return 'A'
    if (mise >= 6) return 'B'
    return 'C'
  }

  function getEdge(p: PredictionRow): number | null {
    if (typeof p.value === 'number') return Math.round(p.value)
    return null
  }

  const outcomeByHorse = new Map(runnerOutcomes.map((row) => [row.cheval_num, row]))

  function getRealGain(p: PredictionRow) {
    const outcome = outcomeByHorse.get(p.cheval_num)
    const stake = p.mise_simulee ?? 0
    if (!outcome || stake <= 0) return null
    const betType = p.pari_conseille ?? 'GAGNANT'
    if (betType === 'PLACE') {
      const gain = outcome.resultat_place ? stake * (outcome.rapport_place ?? 0) : 0
      return gain - stake
    }
    const gain = outcome.resultat_gagnant ? stake * (outcome.rapport_gagnant ?? 0) : 0
    return gain - stake
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="pmu-wrap">
        <header className="pmu-hd">
          <div className="pmu-logo">TurfEdge <em>VMAX</em></div>
          <button className="pmu-tg-btn" onClick={() => setSent(true)} disabled={sent}>
            {sent ? 'Abonne !' : 'Recevoir sur Telegram'}
          </button>
        </header>

        <section className="pmu-hero">
          <div>
            <div className="pmu-eyebrow">ROI ce mois</div>
            <div className="pmu-roi-num">{formatPercent(roiMois, true)}</div>
            <div className="pmu-roi-sub">
              Sur <span>{formatCount(nbPronostics)} pronostics</span> - Bankroll {formatEuro(bankroll)}
            </div>
          </div>
          <div className="pmu-mini-stats">
            <div><div className="pmu-ms-val">{formatPercent(tauxReussite)}</div><div className="pmu-ms-lbl">taux de reussite</div></div>
            <div><div className="pmu-ms-val">{formatEuro(miseConseillee)}</div><div className="pmu-ms-lbl">mise conseillee</div></div>
          </div>
        </section>

        <div className="pmu-race-line">
          <span className="pmu-race-name">{raceName}</span>
          <span className="pmu-sep">-</span>
          <span className="pmu-race-info">{raceInfo}</span>
          <div className="pmu-live-pill"><div className="pmu-live-dot" />LIVE</div>
        </div>

        <div>
          <div className="pmu-t-head">
            <div />
            <div className="pmu-th">Cheval</div>
            <div className="pmu-th">Score VMAX</div>
            <div className="pmu-th pmu-r">Edge</div>
            <div className="pmu-th pmu-r">Mise</div>
          </div>

          {sorted.map((p, i) => {
            const stake = p.mise_simulee ?? 0
            const active = stake > 0
            const rank = active ? i + 1 : 99
            const rc = rank === 1 ? 'r1' : rank === 2 ? 'r2' : rank === 3 ? 'r3' : 'out'
            const score = p.score_blended ?? p.score_cheval ?? p.score_final_pari ?? 0
            const edge = getEdge(p)
            const cote = p.cote_depart ?? p.cote_matin
            const realGain = getRealGain(p)

            return (
              <div key={p.cheval_num} className={`pmu-t-row ${rc}`}>
                <div className={`pmu-num${active ? ' sel' : ''}`}>{p.cheval_num}</div>
                <div>
                  <div className="pmu-h-name">{p.cheval_nom}</div>
                  <div className="pmu-h-sub">
                    {cote ? `Cote ${cote.toFixed(1)}x` : 'Cote N/A'}
                    {p.decision === 'VALIDE' ? ' - VALIDE' : p.decision === 'SURVEILLANCE' ? ' - SURV.' : ''}
                  </div>
                </div>
                <div className="pmu-score-col">
                  <div className={`pmu-score-big${active ? '' : ' lo'}`}>{Math.round(score)}</div>
                  <div className="pmu-score-track">
                    <div className={`pmu-score-fill${active ? '' : ' lo'}`} style={{ width: `${Math.min(100, score)}%` }} />
                  </div>
                </div>
                <div className="pmu-edge-col">
                  {edge !== null
                    ? <span className={`pmu-edge-val ${edge > 8 ? 'up' : edge < 0 ? 'dn' : 'flat'}`}>{edge > 0 ? '+' : ''}{edge}%</span>
                    : <span className="pmu-edge-val flat">--</span>
                  }
                </div>
                <div className="pmu-mise-col">
                  {realGain !== null
                    ? <div className={`pmu-real-gain ${realGain >= 0 ? 'up' : 'dn'}`}>{formatSignedEuro(realGain)}</div>
                    : active
                      ? <><div className="pmu-mise-amount">{formatEuro(stake)}</div><div className="pmu-mise-sub">Kelly {kellyTier(stake)}</div></>
                      : <div className="pmu-mise-none">pas joue</div>
                  }
                </div>
              </div>
            )
          })}
          {sorted.length === 0 ? (
            <div className="pmu-t-empty">donnees insuffisantes</div>
          ) : null}
        </div>

        <footer className="pmu-ft">
          <span>Synchro PMU {synced} - VMAX v{algoVersion}</span>
          <span>Cotes marche en confirmation uniquement</span>
        </footer>
      </div>
    </>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,300&display=swap');
.pmu-wrap{--bg:#0A0908;--s2:#181510;--bdr:rgba(201,168,76,0.13);--g:#C9A84C;--txt:#EDE8DF;--txt2:#6A6258;--grn:#52C27A;background:var(--bg);border-radius:16px;border:1px solid var(--bdr);overflow:hidden;font-family:'DM Mono',monospace;color:var(--txt);width:100%}
.pmu-hd{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;border-bottom:1px solid var(--bdr)}
.pmu-logo{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--g)}
.pmu-logo em{font-style:italic;font-weight:300;color:var(--txt2);font-size:16px;margin-left:6px}
.pmu-tg-btn{display:flex;align-items:center;gap:8px;background:var(--g);color:#0A0908;font-size:11px;font-family:'DM Mono',monospace;padding:9px 18px;border-radius:6px;border:none;cursor:pointer;font-weight:500;transition:opacity 0.2s}
.pmu-tg-btn:hover{opacity:0.85}.pmu-tg-btn:disabled{opacity:0.6;cursor:default}
.pmu-hero{padding:40px 32px 32px;border-bottom:1px solid var(--bdr);display:flex;align-items:flex-end;justify-content:space-between}
.pmu-eyebrow{font-size:10px;color:var(--txt2);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.pmu-roi-num{font-family:'Cormorant Garamond',serif;font-size:80px;font-weight:700;color:var(--grn);line-height:1;letter-spacing:-2px}
.pmu-roi-sub{font-size:12px;color:var(--txt2);margin-top:10px}.pmu-roi-sub span{color:var(--txt)}
.pmu-mini-stats{display:flex;flex-direction:column;gap:16px;text-align:right}
.pmu-ms-val{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;color:var(--txt);line-height:1}
.pmu-ms-lbl{font-size:10px;color:var(--txt2);margin-top:3px}
.pmu-race-line{padding:14px 32px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pmu-race-name{font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;color:var(--txt2)}
.pmu-sep{color:var(--bdr);font-size:18px}.pmu-race-info{font-size:11px;color:var(--txt2)}
.pmu-live-pill{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10px;color:var(--grn);letter-spacing:1px}
.pmu-live-dot{width:6px;height:6px;border-radius:50%;background:var(--grn);animation:pmublink 1.4s infinite}
@keyframes pmublink{0%,100%{opacity:1}50%{opacity:0.3}}
.pmu-t-head{display:grid;grid-template-columns:40px 1fr 120px 80px 80px;padding:10px 32px;gap:12px;border-bottom:1px solid var(--bdr)}
.pmu-th{font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:1.5px}.pmu-th.pmu-r,.pmu-r{text-align:right}
.pmu-t-row{display:grid;grid-template-columns:40px 1fr 120px 80px 80px;padding:20px 32px;gap:12px;align-items:center;border-bottom:1px solid var(--bdr);transition:background 0.12s;position:relative;animation:pmuup 0.35s ease both}
.pmu-t-row:last-child{border-bottom:none}.pmu-t-row:hover{background:rgba(201,168,76,0.03)}
.pmu-t-row.r1{border-left:2px solid var(--g);background:rgba(201,168,76,0.04)}
.pmu-t-row.r2{border-left:2px solid rgba(201,168,76,0.4)}
.pmu-t-row.r3{border-left:2px solid rgba(201,168,76,0.18)}
.pmu-t-row.out{border-left:2px solid transparent;opacity:0.45}
@keyframes pmuup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pmu-num{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--txt2);line-height:1}
.pmu-num.sel{color:var(--g)}.pmu-h-name{font-size:14px;color:var(--txt)}.pmu-h-sub{font-size:10px;color:var(--txt2);margin-top:3px}
.pmu-score-col{display:flex;flex-direction:column;gap:6px}
.pmu-score-big{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--g);line-height:1}
.pmu-score-big.lo{color:var(--txt2);font-weight:300}
.pmu-score-track{height:2px;background:var(--s2);border-radius:1px;overflow:hidden}
.pmu-score-fill{height:100%;border-radius:1px;background:var(--g);opacity:0.7}
.pmu-score-fill.lo{background:var(--txt2);opacity:0.3}
.pmu-edge-col{text-align:right}.pmu-edge-val{font-size:13px}
.pmu-edge-val.up{color:var(--grn)}.pmu-edge-val.dn,.pmu-edge-val.flat{color:var(--txt2)}
.pmu-mise-col{text-align:right}
.pmu-mise-amount{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:var(--txt);line-height:1}
.pmu-real-gain{font-family:'DM Mono',monospace;font-size:13px;font-weight:500}.pmu-real-gain.up{color:var(--grn)}.pmu-real-gain.dn{color:#FF4D5A}
.pmu-mise-none{color:var(--txt2);font-size:13px;font-family:'DM Mono',monospace}
.pmu-mise-sub{font-size:9px;color:var(--txt2);margin-top:3px}
.pmu-t-empty{padding:22px 32px;border-bottom:1px solid var(--bdr);font-size:12px;color:var(--txt2)}
.pmu-ft{padding:14px 32px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;font-size:10px;color:var(--txt2);flex-wrap:wrap;gap:8px}
@media(max-width:600px){
  .pmu-hd,.pmu-hero,.pmu-race-line,.pmu-t-head,.pmu-t-row,.pmu-ft{padding-left:16px;padding-right:16px}
  .pmu-roi-num{font-size:56px}
  .pmu-t-head,.pmu-t-row{grid-template-columns:32px 1fr 80px 60px 64px;gap:8px}
}
`
