'use client'

import { useState, useEffect } from 'react'

const DEMO_DATA = {
  roiMois: 18.4,
  tauxReussite: 64,
  nbPronostics: 87,
  bankroll: 600,
  miseConseillee: 12,
  race: { nom: 'Prix de la Forêt de Rambouillet', hippodrome: 'Vincennes', discipline: 'Attelé', heure: '20h10' },
  horses: [
    { numero: 7,  nom: 'IDYLLE DE GUEZ',    jockey: 'E. Raffin',     cote: 3.8, scoreVmax: 92, edge: 31,  mise: 12, kellyTier: 'A' },
    { numero: 3,  nom: 'FLORIA DU CHÊNE',   jockey: 'Y. Maumy',      cote: 5.2, scoreVmax: 84, edge: 18,  mise: 8,  kellyTier: 'B' },
    { numero: 11, nom: 'KING DU FOREZ',     jockey: 'P. Vercruysse', cote: 7.1, scoreVmax: 79, edge: 4,   mise: 5,  kellyTier: 'C' },
    { numero: 1,  nom: 'DARIUS DES LANDES', jockey: 'C. Martens',    cote: 4.5, scoreVmax: 67, edge: -6,  mise: null, kellyTier: null },
    { numero: 5,  nom: 'ELECTRA SPEED',     jockey: 'J. Boco',       cote: 6.9, scoreVmax: 61, edge: -12, mise: null, kellyTier: null },
  ],
  derniereSynchro: '20:05',
  algoVersion: '9.2',
}

export default function PMUDashboard({ data = DEMO_DATA }) {
  const [sent, setSent] = useState(false)
  const [synced, setSynced] = useState(data.derniereSynchro)

  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date()
      setSynced(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
    }, 60000)
    return () => clearInterval(t)
  }, [])

  const sorted = [...data.horses].sort((a, b) => {
    if (a.mise && !b.mise) return -1
    if (!a.mise && b.mise) return 1
    return b.scoreVmax - a.scoreVmax
  })

  return (
    <>
      <style>{CSS}</style>
      <div className="wrap">
        <header className="hd">
          <div className="logo">PMU Gagnant <em>VMAX</em></div>
          <button className="tg-btn" onClick={() => setSent(true)} disabled={sent}>
            {sent ? '✓ Abonné !' : '✈ Recevoir sur Telegram'}
          </button>
        </header>
        <section className="hero">
          <div>
            <div className="eyebrow">ROI ce mois</div>
            <div className="roi-num">+{Math.round(data.roiMois)}%</div>
            <div className="roi-sub">Sur <span>{data.nbPronostics} pronostics</span> · Bankroll {data.bankroll} €</div>
          </div>
          <div className="mini-stats">
            <div><div className="ms-val">{data.tauxReussite}%</div><div className="ms-lbl">taux de réussite</div></div>
            <div><div className="ms-val">{data.miseConseillee} €</div><div className="ms-lbl">mise conseillée</div></div>
          </div>
        </section>
        <div className="race-line">
          <span className="race-name">{data.race.nom}</span>
          <span className="sep">·</span>
          <span className="race-info">{data.race.hippodrome} · {data.race.discipline} · {data.race.heure}</span>
          <div className="live-pill"><div className="live-dot" />LIVE</div>
        </div>
        <div>
          <div className="t-head">
            <div /><div className="th">Cheval</div>
            <div className="th">Score VMAX</div>
            <div className="th r">Edge</div>
            <div className="th r">Mise</div>
          </div>
          {sorted.map((h, i) => {
            const active = h.mise !== null
            const rank = active ? i + 1 : 99
            const rc = rank===1?'r1':rank===2?'r2':rank===3?'r3':'out'
            return (
              <div key={h.numero} className={`t-row ${rc}`}>
                <div className={`num${active?' sel':''}`}>{h.numero}</div>
                <div><div className="h-name">{h.nom}</div><div className="h-sub">{h.jockey} · Cote {h.cote}×</div></div>
                <div className="score-col">
                  <div className={`score-big${active?'':' lo'}`}>{h.scoreVmax}</div>
                  <div className="score-track"><div className={`score-fill${active?'':' lo'}`} style={{width:`${h.scoreVmax}%`}} /></div>
                </div>
                <div className="edge-col">
                  <span className={`edge-val ${h.edge>8?'up':h.edge<0?'dn':'flat'}`}>{h.edge>0?'+':''}{h.edge}%</span>
                </div>
                <div className="mise-col">
                  {active
                    ? <><div className="mise-amount">{h.mise} €</div><div className="mise-sub">Kelly {h.kellyTier}</div></>
                    : <div className="mise-none">pas joué</div>}
                </div>
              </div>
            )
          })}
        </div>
        <footer className="ft">
          <span>Synchro PMU {synced} · VMAX v{data.algoVersion}</span>
          <span>Cotes marché en confirmation uniquement</span>
        </footer>
      </div>
    </>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,300&display=swap');
.wrap{--bg:#0A0908;--s2:#181510;--bdr:rgba(201,168,76,0.13);--g:#C9A84C;--txt:#EDE8DF;--txt2:#6A6258;--grn:#52C27A;background:var(--bg);border-radius:16px;border:1px solid var(--bdr);overflow:hidden;font-family:'DM Mono',monospace;color:var(--txt);width:100%}
.hd{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;border-bottom:1px solid var(--bdr)}
.logo{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--g)}
.logo em{font-style:italic;font-weight:300;color:var(--txt2);font-size:16px;margin-left:6px}
.tg-btn{display:flex;align-items:center;gap:8px;background:var(--g);color:#0A0908;font-size:11px;font-family:'DM Mono',monospace;padding:9px 18px;border-radius:6px;border:none;cursor:pointer;font-weight:500;transition:opacity 0.2s}
.tg-btn:hover{opacity:0.85}.tg-btn:disabled{opacity:0.6;cursor:default}
.hero{padding:40px 32px 32px;border-bottom:1px solid var(--bdr);display:flex;align-items:flex-end;justify-content:space-between}
.eyebrow{font-size:10px;color:var(--txt2);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.roi-num{font-family:'Cormorant Garamond',serif;font-size:80px;font-weight:700;color:var(--grn);line-height:1;letter-spacing:-2px}
.roi-sub{font-size:12px;color:var(--txt2);margin-top:10px}.roi-sub span{color:var(--txt)}
.mini-stats{display:flex;flex-direction:column;gap:16px;text-align:right}
.ms-val{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;color:var(--txt);line-height:1}
.ms-lbl{font-size:10px;color:var(--txt2);margin-top:3px}
.race-line{padding:14px 32px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:12px}
.race-name{font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;color:var(--txt2)}
.sep{color:var(--bdr);font-size:18px}.race-info{font-size:11px;color:var(--txt2)}
.live-pill{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10px;color:var(--grn);letter-spacing:1px}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--grn);animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
.t-head{display:grid;grid-template-columns:40px 1fr 120px 80px 80px;padding:10px 32px;gap:12px;border-bottom:1px solid var(--bdr)}
.th{font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:1.5px}.th.r{text-align:right}
.t-row{display:grid;grid-template-columns:40px 1fr 120px 80px 80px;padding:20px 32px;gap:12px;align-items:center;border-bottom:1px solid var(--bdr);cursor:pointer;transition:background 0.12s;position:relative;animation:up 0.35s ease both}
.t-row:last-child{border-bottom:none}.t-row:hover{background:rgba(201,168,76,0.03)}
.t-row.r1{border-left:2px solid var(--g);background:rgba(201,168,76,0.04)}
.t-row.r2{border-left:2px solid rgba(201,168,76,0.4)}
.t-row.r3{border-left:2px solid rgba(201,168,76,0.18)}
.t-row.out{border-left:2px solid transparent;opacity:0.45}
@keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.num{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--txt2);line-height:1}
.num.sel{color:var(--g)}.h-name{font-size:14px;color:var(--txt)}.h-sub{font-size:10px;color:var(--txt2);margin-top:3px}
.score-col{display:flex;flex-direction:column;gap:6px}
.score-big{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--g);line-height:1}
.score-big.lo{color:var(--txt2);font-weight:300}
.score-track{height:2px;background:var(--s2);border-radius:1px;overflow:hidden}
.score-fill{height:100%;border-radius:1px;background:var(--g);opacity:0.7}
.score-fill.lo{background:var(--txt2);opacity:0.3}
.edge-col{text-align:right}.edge-val{font-size:13px}
.edge-val.up{color:var(--grn)}.edge-val.dn,.edge-val.flat{color:var(--txt2)}
.mise-col{text-align:right}
.mise-amount{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:var(--txt);line-height:1}
.mise-none{color:var(--txt2);font-size:13px;font-family:'DM Mono',monospace}
.mise-sub{font-size:9px;color:var(--txt2);margin-top:3px}
.ft{padding:14px 32px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;font-size:10px;color:var(--txt2)}
`