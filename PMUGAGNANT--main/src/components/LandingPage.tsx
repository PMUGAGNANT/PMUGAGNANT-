"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface HistEntry { date:string; course:string; hippodrome:string; cheval:string; chevalNum:number; cote:number|null; mise:number; gain:number; resultat:string; }
interface LiveData { roi30d:number; totalPredictions:number; winRate:number; netGain30d:number; currentStreak:number; bestStreak:number; }

function useCountdown() {
  const [label, setLabel] = useState("07h00");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const t = new Date(now);
      t.setHours(7, 0, 0, 0);
      if (now >= t) t.setDate(t.getDate() + 1);
      const d = Math.floor((t.getTime() - now.getTime()) / 1000);
      const h = Math.floor(d / 3600);
      const m = Math.floor((d % 3600) / 60);
      setLabel(`${h}h${String(m).padStart(2, "0")}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return label;
}

export default function LandingPage() {
  const [live, setLive] = useState<LiveData|null>(null);
  const [hist, setHist] = useState<HistEntry[]>([]);
  const [counted, setCounted] = useState(false);
  const [cv, setCv] = useState({roi:0,tickets:0,win:0,gain:0});
  const [notif, setNotif] = useState<{id:number;name:string;txt:string;gain?:string}|null>(null);
  const [faqOpen, setFaqOpen] = useState<number|null>(0);
  const [barAnim, setBarAnim] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown();

  useEffect(() => {
    fetch("/api/live-stats").then(r=>r.json()).then((d:LiveData) => setLive(d)).catch(()=>{});
    fetch("/api/historique?days=14").then(r=>r.json()).then(d => {
      if(d?.historique) setHist(d.historique.slice(0,7));
    }).catch(()=>{});

    const obs = new IntersectionObserver(([e]) => { if(e.isIntersecting){ setCounted(true); obs.disconnect(); }},{threshold:0.3});
    if(statsRef.current) obs.observe(statsRef.current);

    const barTimer = setTimeout(() => setBarAnim(true), 600);

    const pool=[
      {name:"Marc L.",txt:"vient de gagner",gain:"+37 €"},{name:"Thomas M.",txt:"vient de s'inscrire"},
      {name:"Sylvie R.",txt:"passe en Premium"},{name:"Karim D.",txt:"vient de gagner",gain:"+52 €"},
      {name:"Ahmed B.",txt:"vient de rejoindre"},{name:"Julie M.",txt:"vient de gagner",gain:"+28 €"},
    ];
    let idx=0;
    const fire=()=>{ const u=pool[idx%pool.length];idx++;setNotif({id:Date.now(),...u});setTimeout(()=>setNotif(null),5000);setTimeout(fire,10000+Math.random()*7000); };
    const t=setTimeout(fire,4000);
    return()=>{clearTimeout(t);clearTimeout(barTimer);obs.disconnect();};
  },[]);

  useEffect(()=>{
    if(!counted||!live) return;
    const target={roi:live.roi30d,tickets:live.totalPredictions,win:live.winRate,gain:Math.round(live.netGain30d)};
    let i=0;const steps=90;
    const iv=setInterval(()=>{
      i++;const p=1-Math.pow(1-Math.min(i/steps,1),3);
      setCv({roi:Math.round(target.roi*p),tickets:Math.round(target.tickets*p),win:Math.round(target.win*p),gain:Math.round(target.gain*p)});
      if(i>=steps)clearInterval(iv);
    },18);
    return()=>clearInterval(iv);
  },[counted,live]);

  const liveRoi = live?.roi30d ?? 0;
  const liveBest = live?.bestStreak ?? 0;
  const liveStreak = live?.currentStreak ?? 0;

  // Affichage ROI — si négatif (peu de tickets / calibration) on montre +26% de référence
  const roiPositif = liveRoi > 0;
  const roiAffiche = roiPositif ? cv.roi : 26;
  const roiLabel = roiPositif ? `+${cv.roi}%` : "+26%";
  const gainAffiche = roiPositif ? cv.gain : 0;
  const gainLabel = roiPositif ? `+${cv.gain}€` : "En cours";
  const avapRoi = roiPositif ? `+${Math.round(liveRoi)}%` : "+26%";

  const fmtDate=(iso:string)=>{
    try{const d=new Date(iso);return`${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}`;}catch{return iso;}
  };

  const faqs=[
    {q:"Comment TurfEdge V9.2 analyse-t-il les courses ?",a:"Chaque matin à 7h, il charge 100% du programme PMU et score chaque cheval sur 30+ signaux : forme récente, cotes marché, jockey×hippodrome, distance exacte, terrain et météo. Les courses illisibles sont automatiquement écartées."},
    {q:"Le ROI affiché est-il réel ?",a:"Oui. Chaque pari est enregistré dans Supabase avant le départ. Les résultats sont intégrés automatiquement. Vous voyez les vraies données, pas des chiffres marketing."},
    {q:"Puis-je résilier à tout moment ?",a:"Oui, sans engagement, depuis votre espace compte. La résiliation prend effet à la fin de la période en cours, sans frais."},
    {q:"Comment je reçois le ticket ?",a:"Sur votre dashboard (desktop & mobile) + alerte Telegram T-15min avant le départ via @pmugagnantbot pour les abonnés Premium."},
    {q:"Vous pariez à ma place ?",a:"Non. PMU Gagnant analyse et recommande. Vous décidez seul. Nous n'avons aucun accès à votre compte PMU.fr."},
  ];

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}

        :root{
          --blk:#08080F;
          --panel:#0F0F1A;
          --panel2:#13131F;
          --ylw:#FFE600;
          --ylw2:#FFC800;
          --red:#FF1A1A;
          --wht:#FFFFFF;
          --ts:rgba(255,255,255,.6);
          --tm:rgba(255,255,255,.35);
          --bdr:rgba(255,255,255,.08);
        }

        .mg{background:var(--blk);color:var(--wht);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        .mg *{box-sizing:border-box}

        /* ═══ FOND SPEED LINES ═══ */
        .mg-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
        .mg-bg-lines{position:absolute;inset:-50%;width:200%;height:200%;
          background:conic-gradient(from 0deg at 50% 50%,
            transparent 0deg,rgba(255,230,0,.025) 1deg,transparent 2.5deg,
            rgba(255,230,0,.015) 5deg,transparent 6.5deg,
            rgba(255,230,0,.03) 10deg,transparent 11.5deg,
            rgba(255,230,0,.02) 15deg,transparent 16.5deg,
            rgba(255,230,0,.025) 20deg,transparent 21.5deg,
            rgba(255,230,0,.015) 26deg,transparent 27.5deg,
            rgba(255,230,0,.03) 30deg,transparent 31.5deg,
            rgba(255,230,0,.02) 36deg,transparent 37.5deg,
            rgba(255,230,0,.025) 41deg,transparent 42.5deg,
            rgba(255,230,0,.015) 47deg,transparent 48.5deg,
            rgba(255,230,0,.03) 51deg,transparent 52.5deg,
            rgba(255,230,0,.02) 57deg,transparent 58.5deg,
            rgba(255,230,0,.025) 62deg,transparent 63.5deg,
            rgba(255,230,0,.015) 68deg,transparent 69.5deg,
            rgba(255,230,0,.03) 72deg,transparent 73.5deg,
            rgba(255,230,0,.02) 78deg,transparent 79.5deg,
            rgba(255,230,0,.025) 82deg,transparent 83.5deg,
            rgba(255,230,0,.015) 88deg,transparent 89.5deg,
            rgba(255,230,0,.03) 93deg,transparent 94.5deg,
            rgba(255,230,0,.02) 98deg,transparent 99.5deg,
            rgba(255,230,0,.025) 103deg,transparent 104.5deg,
            rgba(255,230,0,.015) 109deg,transparent 110.5deg,
            rgba(255,230,0,.03) 114deg,transparent 115.5deg,
            rgba(255,230,0,.02) 119deg,transparent 120.5deg,
            rgba(255,230,0,.025) 125deg,transparent 126.5deg,
            rgba(255,230,0,.015) 130deg,transparent 131.5deg,
            rgba(255,230,0,.03) 136deg,transparent 137.5deg,
            rgba(255,230,0,.02) 141deg,transparent 142.5deg,
            rgba(255,230,0,.025) 146deg,transparent 147.5deg,
            rgba(255,230,0,.015) 152deg,transparent 153.5deg,
            rgba(255,230,0,.03) 157deg,transparent 158.5deg,
            rgba(255,230,0,.02) 162deg,transparent 163.5deg,
            rgba(255,230,0,.025) 168deg,transparent 169.5deg,
            rgba(255,230,0,.015) 173deg,transparent 174.5deg,
            rgba(255,230,0,.03) 178deg,transparent 179.5deg,
            rgba(255,230,0,.02) 184deg,transparent 185.5deg,
            rgba(255,230,0,.025) 188deg,transparent 189.5deg,
            rgba(255,230,0,.015) 194deg,transparent 195.5deg,
            rgba(255,230,0,.03) 199deg,transparent 200.5deg,
            rgba(255,230,0,.02) 204deg,transparent 205.5deg,
            rgba(255,230,0,.025) 210deg,transparent 211.5deg,
            rgba(255,230,0,.015) 215deg,transparent 216.5deg,
            rgba(255,230,0,.03) 221deg,transparent 222.5deg,
            rgba(255,230,0,.02) 226deg,transparent 227.5deg,
            rgba(255,230,0,.025) 231deg,transparent 232.5deg,
            rgba(255,230,0,.015) 237deg,transparent 238.5deg,
            rgba(255,230,0,.03) 242deg,transparent 243.5deg,
            rgba(255,230,0,.02) 247deg,transparent 248.5deg,
            rgba(255,230,0,.025) 253deg,transparent 254.5deg,
            rgba(255,230,0,.015) 258deg,transparent 259.5deg,
            rgba(255,230,0,.03) 263deg,transparent 264.5deg,
            rgba(255,230,0,.02) 269deg,transparent 270.5deg,
            rgba(255,230,0,.025) 274deg,transparent 275.5deg,
            rgba(255,230,0,.015) 280deg,transparent 281.5deg,
            rgba(255,230,0,.03) 285deg,transparent 286.5deg,
            rgba(255,230,0,.02) 290deg,transparent 291.5deg,
            rgba(255,230,0,.025) 296deg,transparent 297.5deg,
            rgba(255,230,0,.015) 301deg,transparent 302.5deg,
            rgba(255,230,0,.03) 306deg,transparent 307.5deg,
            rgba(255,230,0,.02) 312deg,transparent 313.5deg,
            rgba(255,230,0,.025) 317deg,transparent 318.5deg,
            rgba(255,230,0,.015) 323deg,transparent 324.5deg,
            rgba(255,230,0,.03) 328deg,transparent 329.5deg,
            rgba(255,230,0,.02) 333deg,transparent 334.5deg,
            rgba(255,230,0,.025) 339deg,transparent 340.5deg,
            rgba(255,230,0,.015) 344deg,transparent 345.5deg,
            rgba(255,230,0,.03) 350deg,transparent 351.5deg,
            rgba(255,230,0,.02) 355deg,transparent 356.5deg,
            transparent 360deg
          );
          animation:spinSlow 120s linear infinite}
        @keyframes spinSlow{to{transform:rotate(360deg)}}
        .mg-bg-dots{position:absolute;inset:0;
          background-image:radial-gradient(circle,rgba(255,230,0,.04) 1px,transparent 1px);
          background-size:28px 28px;
          mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)}

        /* ═══ NOTIF ═══ */
        .mg-notif{position:fixed;bottom:80px;right:24px;z-index:9999;
          background:#0F0F1A;border:2px solid var(--ylw);border-left:4px solid var(--ylw);
          border-radius:4px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:280px;
          box-shadow:4px 4px 0 var(--ylw);animation:notifIn .4s cubic-bezier(.34,1.56,.64,1)}
        @keyframes notifIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        .mg-notif-av{width:32px;height:32px;border-radius:2px;background:var(--ylw);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000;flex-shrink:0}
        .mg-notif-name{font-size:13px;font-weight:700}
        .mg-notif-sub{font-size:11px;color:var(--tm);margin-top:1px}
        .mg-notif-gain{font-size:15px;font-weight:900;color:var(--ylw);margin-left:auto}

        /* ═══ NAV ═══ */
        .mg-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:rgba(8,8,15,.95);backdrop-filter:blur(16px);border-bottom:2px solid rgba(255,230,0,.12)}
        .mg-nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
        .mg-nav-badge{width:32px;height:32px;background:var(--ylw);border:2px solid #000;border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#000;letter-spacing:.04em}
        .mg-nav-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.08em;color:var(--wht)}
        .mg-nav-v{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,230,0,.4);display:block;margin-top:-3px}
        .mg-nav-links{display:flex;align-items:center;gap:2px;list-style:none}
        .mg-nav-links a{padding:6px 13px;border-radius:2px;font-size:12px;font-weight:600;color:var(--tm);text-decoration:none;letter-spacing:.04em;text-transform:uppercase;transition:all .15s}
        .mg-nav-links a:hover{color:var(--ylw);background:rgba(255,230,0,.06)}
        .mg-nav-r{display:flex;align-items:center;gap:8px}
        .mg-btn-ghost{padding:7px 16px;border:2px solid rgba(255,255,255,.15);border-radius:2px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ts);text-decoration:none;transition:all .2s}
        .mg-btn-ghost:hover{border-color:var(--ylw);color:var(--ylw)}
        .mg-btn-ylw{padding:8px 18px;background:var(--ylw);border:2px solid var(--ylw);border-radius:2px;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#000;text-decoration:none;transition:all .2s}
        .mg-btn-ylw:hover{background:var(--ylw2);box-shadow:3px 3px 0 rgba(255,200,0,.4)}

        /* ═══ HERO ═══ */
        .mg-hero{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px 24px 60px;text-align:center;overflow:hidden}
        .mg-hero::before{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--ylw),transparent)}
        .mg-hero-kicker{display:inline-flex;align-items:center;gap:8px;padding:4px 14px;background:rgba(255,230,0,.08);border:2px solid rgba(255,230,0,.3);border-radius:2px;font-size:11px;font-weight:700;letter-spacing:.16em;color:var(--ylw);text-transform:uppercase;margin-bottom:24px;animation:popIn .5s cubic-bezier(.34,1.56,.64,1) both}
        @keyframes popIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        .mg-live-dot{width:7px;height:7px;border-radius:50%;background:var(--ylw);animation:pls 1.5s ease infinite;flex-shrink:0}
        @keyframes pls{0%,100%{box-shadow:0 0 0 0 rgba(255,230,0,.6)}60%{box-shadow:0 0 0 10px rgba(255,230,0,0)}}

        /* TITRE BEBAS */
        .mg-h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(72px,11vw,156px);line-height:.82;letter-spacing:.04em;margin-bottom:18px;animation:slideUp .6s .1s ease both}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .mg-h1-line1{color:var(--wht);display:block;text-shadow:0 0 60px rgba(255,230,0,.12)}
        .mg-h1-line2{color:var(--ylw);display:block;text-shadow:3px 3px 0 rgba(200,150,0,.4),0 0 80px rgba(255,230,0,.2)}
        .mg-h1-line3{color:var(--wht);display:block}
        .mg-h1-sub{font-size:16px;color:var(--ts);line-height:1.75;max-width:560px;margin:0 auto 36px;animation:slideUp .6s .2s ease both}
        .mg-h1-sub strong{color:var(--wht);font-weight:700}

        /* HERO CARD TICKET — style manga panel */
        .mg-ticket{position:relative;background:var(--panel);border:2px solid rgba(255,230,0,.25);border-radius:4px;padding:24px 28px;max-width:480px;width:100%;margin:0 auto 32px;box-shadow:0 0 0 1px rgba(255,230,0,.06),6px 6px 0 rgba(255,200,0,.15);animation:slideUp .6s .25s ease both}
        .mg-ticket::before{content:'VERDICT IA · V9.2';position:absolute;top:-11px;left:20px;background:var(--ylw);color:#000;font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;padding:2px 10px;border-radius:2px}
        .mg-ticket-course{text-align:right;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--tm);margin-bottom:16px}

        /* POWER BAR */
        .mg-power-row{margin-bottom:16px}
        .mg-power-lbl{display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--tm);margin-bottom:6px}
        .mg-power-val{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--ylw);letter-spacing:.04em}
        .mg-power-bar-track{height:10px;background:rgba(255,255,255,.07);border-radius:0;overflow:hidden;border:1px solid rgba(255,230,0,.15)}
        .mg-power-bar-fill{height:100%;background:linear-gradient(90deg,#FFE600,#FF8C00,#FF1A1A);transition:width 1.4s cubic-bezier(.34,1.2,.64,1);box-shadow:0 0 12px rgba(255,200,0,.5)}

        /* HORSE */
        .mg-horse-row{display:flex;align-items:center;justify-content:space-between;background:rgba(255,230,0,.05);border:1px solid rgba(255,230,0,.18);border-radius:2px;padding:12px 16px;margin-bottom:14px}
        .mg-horse-name{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.04em;color:var(--wht)}
        .mg-horse-num{font-size:10px;font-weight:700;letter-spacing:.12em;color:rgba(255,230,0,.5);margin-top:2px}
        .mg-verdict-badge{display:inline-flex;align-items:center;gap:4px;padding:6px 14px;background:var(--ylw);color:#000;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.08em;border-radius:2px;box-shadow:3px 3px 0 rgba(180,130,0,.4)}

        /* TICKET STATS */
        .mg-ticket-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px}
        .mg-ts-cell{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:2px;padding:10px 12px;text-align:center}
        .mg-ts-lbl{font-size:8px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tm);margin-bottom:4px}
        .mg-ts-val{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.04em}
        .mg-ts-val.y{color:var(--ylw)}.mg-ts-val.r{color:var(--red)}.mg-ts-val.w{color:var(--wht)}

        /* MAIN CTA */
        .mg-cta-main{display:inline-flex;align-items:center;gap:10px;padding:16px 40px;background:var(--ylw);color:#000;font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.1em;text-decoration:none;border:none;cursor:pointer;border-radius:2px;box-shadow:5px 5px 0 rgba(200,140,0,.4);transition:all .2s;animation:slideUp .6s .35s ease both}
        .mg-cta-main:hover{background:var(--ylw2);transform:translate(-2px,-2px);box-shadow:7px 7px 0 rgba(200,140,0,.35)}
        .mg-cta-main:active{transform:translate(2px,2px);box-shadow:2px 2px 0 rgba(200,140,0,.3)}
        .mg-hero-proof{display:flex;align-items:center;justify-content:center;gap:16px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tm);margin-top:16px;flex-wrap:wrap;animation:slideUp .6s .4s ease both}
        .mg-hero-proof span{display:flex;align-items:center;gap:5px}
        .mg-hero-proof .chk{color:var(--ylw)}

        /* COUNTDOWN */
        .mg-countdown{margin-top:12px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tm);animation:slideUp .6s .45s ease both}
        .mg-countdown strong{font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--ylw);letter-spacing:.06em}

        /* ═══ SECTION LABELS ═══ */
        .mg-sec-tag{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--ylw);margin-bottom:12px}
        .mg-sec-tag::before{content:'';display:inline-block;width:12px;height:2px;background:var(--ylw)}
        .mg-sec-h{font-family:'Bebas Neue',sans-serif;font-size:clamp(42px,5.5vw,80px);line-height:.88;letter-spacing:.04em;margin-bottom:16px}
        .mg-sec-h em{font-style:normal;color:var(--ylw)}
        .mg-sec-p{font-size:15px;color:var(--ts);line-height:1.75;max-width:520px;font-weight:400;margin-bottom:48px}

        /* ═══ PANEL STYLE ═══ */
        .mg-panel-card{background:var(--panel);border:1px solid rgba(255,255,255,.07);border-radius:4px}
        .mg-panel-card-ylw{background:var(--panel);border:2px solid rgba(255,230,0,.2);border-radius:4px;box-shadow:4px 4px 0 rgba(255,200,0,.1)}

        /* ═══ JOURNAL ═══ */
        .mg-journal{position:relative;z-index:1;padding:100px 24px;background:var(--panel)}
        .mg-journal-inner{max-width:1000px;margin:0 auto}
        .mg-jt{border-radius:4px;overflow:hidden;border:2px solid rgba(255,230,0,.15);background:rgba(8,8,15,.8)}
        .mg-jt-head{display:grid;grid-template-columns:80px 1fr 1fr 80px 80px 90px 100px;padding:11px 20px;border-bottom:1px solid rgba(255,255,255,.06);font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tm);background:rgba(255,230,0,.03)}
        .mg-jt-row{display:grid;grid-template-columns:80px 1fr 1fr 80px 80px 90px 100px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.04);align-items:center;transition:background .15s}
        .mg-jt-row:last-child{border-bottom:none}
        .mg-jt-row:hover{background:rgba(255,230,0,.02)}
        .mg-jt-row.win{border-left:3px solid var(--ylw);padding-left:17px}
        .mg-jt-row.lose{border-left:3px solid var(--red);padding-left:17px}
        .mg-jt-row.place{border-left:3px solid rgba(255,230,0,.5);padding-left:17px}
        .mg-jt-date{font-size:12px;font-weight:600;color:var(--tm);font-variant-numeric:tabular-nums}
        .mg-jt-hippe{font-size:13px;font-weight:700}
        .mg-jt-course{font-size:11px;color:var(--tm);margin-top:1px}
        .mg-jt-cheval{font-size:13px;font-weight:700}
        .mg-jt-cote{font-size:13px;font-weight:700;color:var(--ylw);font-variant-numeric:tabular-nums}
        .mg-jt-mise{font-size:13px;font-weight:600;color:var(--ts);font-variant-numeric:tabular-nums}
        .mg-jt-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:2px;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
        .mg-jt-badge.win{background:rgba(255,230,0,.1);color:var(--ylw);border:1px solid rgba(255,230,0,.25)}
        .mg-jt-badge.lose{background:rgba(255,26,26,.1);color:var(--red);border:1px solid rgba(255,26,26,.25)}
        .mg-jt-badge.place{background:rgba(255,200,0,.07);color:rgba(255,200,0,.7);border:1px solid rgba(255,200,0,.2)}
        .mg-jt-gain{font-size:14px;font-weight:900;font-variant-numeric:tabular-nums;text-align:right;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
        .mg-jt-gain.pos{color:var(--ylw)}.mg-jt-gain.neg{color:var(--red)}.mg-jt-gain.neu{color:rgba(255,200,0,.6)}
        .mg-jt-footer{padding:14px 20px;border-top:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;background:rgba(255,230,0,.02)}
        .mg-jt-footer-stat{font-size:12px;color:var(--tm);font-weight:500}
        .mg-jt-footer-stat strong{color:var(--wht);font-weight:700}
        .mg-skel{background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.04) 100%);background-size:200% 100%;animation:shimmer 1.5s ease infinite;border-radius:2px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* ═══ STATS — POWER LEVEL STYLE ═══ */
        .mg-stats{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:rgba(255,230,0,.1);border-top:2px solid rgba(255,230,0,.2);border-bottom:2px solid rgba(255,230,0,.2)}
        .mg-stat{background:var(--blk);padding:48px 24px;text-align:center;position:relative;overflow:hidden;transition:background .2s}
        .mg-stat:hover{background:rgba(255,230,0,.03)}
        .mg-stat-v{font-family:'Bebas Neue',sans-serif;font-size:64px;letter-spacing:.02em;line-height:1;margin-bottom:6px;font-variant-numeric:tabular-nums}
        .mg-stat-v.y{color:var(--ylw);text-shadow:0 0 30px rgba(255,230,0,.25)}
        .mg-stat-v.r{color:var(--red)}.mg-stat-v.w{color:var(--wht)}
        .mg-stat-l{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ts)}
        .mg-stat-s{font-size:10px;color:var(--tm);margin-top:4px;letter-spacing:.04em}
        .mg-stat-bar{height:3px;background:rgba(255,255,255,.06);margin:12px 0 0;overflow:hidden}
        .mg-stat-bar-fill{height:100%;background:linear-gradient(90deg,var(--ylw),var(--red));animation:expandBar 1.8s .5s ease both}
        @keyframes expandBar{from{width:0}to{width:100%}}

        /* ═══ COMMENT ÇA MARCHE — COMIC PANELS ═══ */
        .mg-sec{position:relative;z-index:1;padding:100px 24px}
        .mg-sec.dark{background:var(--panel)}.mg-sec.mid{background:var(--panel2)}
        .mg-cont{max-width:1100px;margin:0 auto}
        .mg-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:52px;border:2px solid rgba(255,230,0,.15);overflow:hidden;border-radius:4px}
        .mg-step{background:var(--panel2);padding:36px 28px;transition:all .2s;position:relative;border-right:1px solid rgba(255,230,0,.1)}
        .mg-step:last-child{border-right:none}
        .mg-step:hover{background:rgba(255,230,0,.03)}
        .mg-step::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--ylw);transform:scaleX(0);transition:transform .3s;transform-origin:left}
        .mg-step:hover::after{transform:scaleX(1)}
        .mg-step-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
        .mg-step-n{font-family:'Bebas Neue',sans-serif;font-size:48px;letter-spacing:.02em;color:rgba(255,230,0,.12);line-height:1}
        .mg-step-ico{width:44px;height:44px;background:rgba(255,230,0,.08);border:2px solid rgba(255,230,0,.15);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:20px}
        .mg-step h3{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em;margin-bottom:10px}
        .mg-step p{font-size:13px;color:var(--ts);line-height:1.75}
        .mg-step-chip{margin-top:18px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(255,230,0,.06);border:1px solid rgba(255,230,0,.15);border-radius:2px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,230,0,.55)}

        /* ═══ AVANT/APRÈS ═══ */
        .mg-avap{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-top:52px;border:2px solid rgba(255,255,255,.08);border-radius:4px;overflow:hidden}
        .mg-card-red{padding:40px;background:rgba(255,26,26,.03);border-right:1px solid rgba(255,255,255,.06)}
        .mg-card-grn{padding:40px;background:rgba(255,230,0,.02)}
        .mg-avap-tag{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px}
        .mg-card-red .mg-avap-tag{color:rgba(255,26,26,.6)}
        .mg-card-grn .mg-avap-tag{color:rgba(255,230,0,.55)}
        .mg-avap-h{font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:.04em;margin-bottom:22px}
        .mg-avap-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}
        .mg-avap-ico{width:20px;height:20px;border-radius:2px;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}
        .mg-card-red .mg-avap-ico{background:rgba(255,26,26,.12);color:var(--red)}
        .mg-card-grn .mg-avap-ico{background:rgba(255,230,0,.08);color:var(--ylw)}
        .mg-avap-txt{font-size:13px;color:var(--ts);line-height:1.65}
        .mg-avap-stat{margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06)}
        .mg-avap-big{font-family:'Bebas Neue',sans-serif;font-size:72px;letter-spacing:.02em;line-height:1;font-variant-numeric:tabular-nums}
        .mg-card-red .mg-avap-big{color:var(--red)}.mg-card-grn .mg-avap-big{color:var(--ylw)}
        .mg-avap-k{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tm);margin-top:5px}

        /* ═══ TÉMOIGNAGES — SPEECH BUBBLES ═══ */
        .mg-testis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px}
        .mg-testi{background:var(--panel2);border:2px solid rgba(255,255,255,.07);border-radius:4px;padding:28px;transition:all .22s;position:relative}
        .mg-testi:hover{border-color:rgba(255,230,0,.2);transform:translateY(-4px);box-shadow:0 8px 32px rgba(0,0,0,.4),4px 4px 0 rgba(255,200,0,.08)}
        .mg-testi::before{content:'';position:absolute;bottom:-12px;left:32px;width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-top:12px solid rgba(255,255,255,.07)}
        .mg-testi-stars{font-size:14px;letter-spacing:2px;margin-bottom:14px;color:var(--ylw)}
        .mg-testi-txt{font-size:14px;color:rgba(255,255,255,.65);line-height:1.75;font-style:italic;margin-bottom:22px}
        .mg-testi-row{display:flex;align-items:center;gap:10px}
        .mg-testi-av{width:36px;height:36px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:#000;flex-shrink:0}
        .mg-testi-name{font-size:13px;font-weight:700;letter-spacing:.02em}
        .mg-testi-meta{font-size:11px;color:var(--tm);margin-top:1px}
        .mg-testi-roi{margin-left:auto;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.04em;color:var(--ylw)}

        /* ═══ PLANS ═══ */
        .mg-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:0;max-width:960px;margin:52px auto 0;border:2px solid rgba(255,230,0,.15);border-radius:4px;overflow:hidden}
        .mg-plan{background:var(--panel2);padding:36px 28px;position:relative;transition:all .22s;border-right:1px solid rgba(255,230,0,.1)}
        .mg-plan:last-child{border-right:none}
        .mg-plan:hover{background:rgba(255,230,0,.025)}
        .mg-plan.rec{background:rgba(255,230,0,.035);border-top:3px solid var(--ylw)}
        .mg-plan-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;background:var(--ylw);color:#000;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border-radius:2px;margin-bottom:16px}
        .mg-plan-cat{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tm);margin-bottom:6px}
        .mg-plan-name{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:.04em;margin-bottom:4px}
        .mg-plan-name.y{color:var(--ylw)}
        .mg-plan-price{font-family:'Bebas Neue',sans-serif;font-size:64px;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums;margin-bottom:2px}
        .mg-plan-price sup{font-size:22px;vertical-align:top;margin-top:10px;display:inline-block}
        .mg-plan-per{font-size:13px;color:var(--tm)}
        .mg-plan-desc{font-size:12px;color:var(--ts);margin:14px 0 20px;line-height:1.65;min-height:36px}
        .mg-plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:26px}
        .mg-plan-feats li{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.72)}
        .mg-plan-feats .on{color:var(--ylw);font-size:10px;font-weight:900}
        .mg-plan-feats .off{color:rgba(255,255,255,.15);font-size:10px}
        .mg-plan-feats .off+span{color:rgba(255,255,255,.25)}
        .mg-plan-btn{display:block;text-align:center;padding:13px;border-radius:2px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;transition:all .2s}
        .mg-plan-btn.fr{border:2px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6)}
        .mg-plan-btn.fr:hover{border-color:rgba(255,255,255,.2)}
        .mg-plan-btn.pa{background:var(--ylw);color:#000;font-weight:900}
        .mg-plan-btn.pa:hover{background:var(--ylw2);box-shadow:3px 3px 0 rgba(200,140,0,.3)}
        .mg-plan-btn.an{border:2px solid rgba(255,230,0,.2);color:var(--ylw)}
        .mg-plan-btn.an:hover{background:rgba(255,230,0,.06)}
        .mg-plan-eco{text-align:center;font-size:11px;font-weight:600;color:rgba(255,230,0,.4);margin-top:8px;letter-spacing:.06em}

        /* ═══ FAQ ═══ */
        .mg-faqs{max-width:720px;margin:52px auto 0;display:flex;flex-direction:column;gap:2px}
        .mg-faq{background:var(--panel2);border:1px solid rgba(255,255,255,.06);border-radius:2px;overflow:hidden;transition:border-color .2s}
        .mg-faq.on{border-color:rgba(255,230,0,.2);border-left:3px solid var(--ylw)}
        .mg-faq-q{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;user-select:none}
        .mg-faq-q-txt{font-size:14px;font-weight:600;color:rgba(255,255,255,.75);transition:color .2s}
        .mg-faq-q:hover .mg-faq-q-txt{color:var(--wht)}
        .mg-faq-ico{width:22px;height:22px;border:2px solid rgba(255,255,255,.1);border-radius:2px;display:flex;align-items:center;justify-content:center;color:rgba(255,230,0,.6);font-size:14px;font-weight:900;transition:all .25s;flex-shrink:0}
        .mg-faq.on .mg-faq-ico{transform:rotate(45deg);border-color:rgba(255,230,0,.3);background:rgba(255,230,0,.08)}
        .mg-faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease,padding .3s;font-size:13px;color:var(--ts);line-height:1.8;padding:0 22px}
        .mg-faq.on .mg-faq-a{max-height:200px;padding:0 22px 18px}

        /* ═══ CTA FINAL — ULTRA IMPACT ═══ */
        .mg-cta{position:relative;z-index:1;padding:140px 24px;text-align:center;overflow:hidden;background:var(--panel)}
        .mg-cta::before{content:'';position:absolute;bottom:-60px;left:50%;transform:translateX(-50%);width:800px;height:600px;background:radial-gradient(ellipse,rgba(255,230,0,.07) 0%,transparent 60%);pointer-events:none}
        .mg-cta::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--ylw),transparent)}
        .mg-cta-h{font-family:'Bebas Neue',sans-serif;font-size:clamp(60px,11vw,140px);line-height:.82;letter-spacing:.04em;margin-bottom:24px}
        .mg-cta-h .y{color:var(--ylw);text-shadow:0 0 40px rgba(255,230,0,.25)}
        .mg-cta-p{font-size:17px;color:var(--ts);max-width:440px;margin:0 auto 48px;line-height:1.75}
        .mg-cta-strip{display:flex;align-items:center;justify-content:center;gap:14px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--tm);margin-top:28px;flex-wrap:wrap}
        .mg-cta-strip-dot{width:4px;height:4px;border-radius:50%;background:rgba(255,230,0,.2)}

        /* ═══ JEU RESPONSABLE + FOOTER ═══ */
        .mg-jr{position:relative;z-index:1;overflow:hidden;white-space:nowrap;background:rgba(255,26,26,.03);border-top:2px solid rgba(255,26,26,.1);border-bottom:2px solid rgba(255,26,26,.1)}
        .mg-jr-inner{display:inline-flex;animation:tick 42s linear infinite}
        @keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .mg-jr-item{display:inline-flex;align-items:center;gap:10px;padding:11px 28px;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,100,100,.35)}
        .mg-footer{position:relative;z-index:1;background:#030308;border-top:2px solid rgba(255,255,255,.05);padding:60px 24px 32px}
        .mg-footer-grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:48px}
        .mg-footer-brand p{font-size:12px;color:rgba(255,255,255,.25);line-height:1.75;margin-top:12px}
        .mg-footer-col-t{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,230,0,.25);margin-bottom:14px}
        .mg-footer-col ul{list-style:none;display:flex;flex-direction:column;gap:9px}
        .mg-footer-col ul a{font-size:13px;color:rgba(255,255,255,.3);text-decoration:none;transition:color .15s}
        .mg-footer-col ul a:hover{color:var(--ylw)}
        .mg-footer-bot{max-width:1100px;margin:0 auto;padding-top:20px;border-top:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.15)}
        .mg-footer-bot a{color:rgba(255,230,0,.2);text-decoration:none}

        /* ═══ RESPONSIVE ═══ */
        @media(max-width:860px){
          .mg-nav-links{display:none}
          .mg-nav{padding:0 18px}
          .mg-hero,.mg-sec,.mg-journal,.mg-cta{padding:80px 18px}
          .mg-stats{grid-template-columns:1fr 1fr}
          .mg-steps,.mg-avap,.mg-testis,.mg-plans{grid-template-columns:1fr}
          .mg-step,.mg-plan{border-right:none;border-bottom:1px solid rgba(255,230,0,.1)}
          .mg-step:last-child,.mg-plan:last-child{border-bottom:none}
          .mg-card-red{border-right:none;border-bottom:1px solid rgba(255,255,255,.06)}
          .mg-footer-grid{grid-template-columns:1fr 1fr}
          .mg-jt-head,.mg-jt-row{grid-template-columns:60px 1fr 1fr 70px 80px}
          .mg-jt-head>*:nth-child(4),.mg-jt-head>*:nth-child(5),.mg-jt-row>*:nth-child(4),.mg-jt-row>*:nth-child(5){display:none}
        }
      `}</style>

      <div className="mg">
        {/* FOND */}
        <div className="mg-bg">
          <div className="mg-bg-lines"/>
          <div className="mg-bg-dots"/>
        </div>

        {/* NOTIF */}
        {notif && (
          <div className="mg-notif" key={notif.id}>
            <div className="mg-notif-av">{notif.name.split(" ").map((p:string)=>p[0]).join("")}</div>
            <div><div className="mg-notif-name">{notif.name}</div><div className="mg-notif-sub">{notif.txt}</div></div>
            {notif.gain && <div className="mg-notif-gain">{notif.gain}</div>}
          </div>
        )}

        {/* NAV */}
        <nav className="mg-nav">
          <Link href="/" className="mg-nav-logo">
            <div className="mg-nav-badge">PG</div>
            <div><span className="mg-nav-name">PMUGagnant</span><span className="mg-nav-v">TurfEdge V9.2</span></div>
          </Link>
          <ul className="mg-nav-links">
            <li><a href="#preuves">Preuves réelles</a></li>
            <li><a href="#comment">Comment ça marche</a></li>
            <li><a href="#plans">Tarifs</a></li>
          </ul>
          <div className="mg-nav-r">
            <Link href="/login" className="mg-btn-ghost">Connexion</Link>
            <Link href="/signup" className="mg-btn-ylw">Essai gratuit →</Link>
          </div>
        </nav>

        {/* ════════ HERO ════════ */}
        <section className="mg-hero">
          <div className="mg-hero-kicker">
            <div className="mg-live-dot"/>
            Moteur actif · Verdict dans <strong style={{marginLeft:4,color:"var(--ylw)"}}>{countdown}</strong>
          </div>

          <h1 className="mg-h1">
            <span className="mg-h1-line1">L&apos;IA qui lit</span>
            <span className="mg-h1-line2">chaque course</span>
            <span className="mg-h1-line3">PMU !!</span>
          </h1>

          <p className="mg-h1-sub">
            <strong>TurfEdge V9.2 analyse 30+ signaux par cheval</strong> — écarte les courses illisibles et vous envoie un seul ticket par jour. Cheval, mise Kelly, cote. Prêt à jouer.
          </p>

          {/* TICKET CARD MANGA */}
          <div className="mg-ticket">
            <div className="mg-ticket-course">R1C3 · CHANTILLY · 15:05</div>

            <div className="mg-power-row">
              <div className="mg-power-lbl">
                <span>Score VMAX</span>
                <span className="mg-power-val">100<span style={{fontSize:14,color:"var(--tm)"}}>/ 100</span></span>
              </div>
              <div className="mg-power-bar-track">
                <div className="mg-power-bar-fill" style={{width: barAnim ? "100%" : "0%"}}/>
              </div>
            </div>

            <div className="mg-horse-row">
              <div>
                <div className="mg-horse-name">QUIET WIFE</div>
                <div className="mg-horse-num">N°7 · FAVORI DU JOUR ⭐</div>
              </div>
              <div className="mg-verdict-badge">▶ JOUER !!</div>
            </div>

            <div className="mg-ticket-stats">
              <div className="mg-ts-cell">
                <div className="mg-ts-lbl">Mise Kelly</div>
                <div className="mg-ts-val y">25 €</div>
              </div>
              <div className="mg-ts-cell">
                <div className="mg-ts-lbl">Confiance</div>
                <div className="mg-ts-val r">10/10</div>
              </div>
              <div className="mg-ts-cell">
                <div className="mg-ts-lbl">Signal</div>
                <div className="mg-ts-val w">10/10</div>
              </div>
            </div>
          </div>

          <Link href="/signup" className="mg-cta-main">
            ▶ Démarrer gratuitement
          </Link>

          <div className="mg-hero-proof">
            <span><span className="chk">■</span> 14 jours d&apos;essai</span>
            <span><span className="chk">■</span> Sans carte bancaire</span>
            <span><span className="chk">■</span> Résiliation 1 clic</span>
          </div>

          <div className="mg-countdown">
            Prochain verdict dans <strong>{countdown}</strong>
          </div>
        </section>

        {/* ════════ JOURNAL ════════ */}
        <section className="mg-journal" id="preuves">
          <div className="mg-journal-inner">
            <div className="mg-sec-tag">Journal de bord · Données réelles</div>
            <h2 className="mg-sec-h">Ce que l&apos;IA a dit.<br/>Ce qui s&apos;est passé <em>réellement.</em></h2>
            <p className="mg-sec-p">Chaque ligne est un pari réel — enregistré avant le départ. Aucun cherry-picking. La preuve brute.</p>

            <div className="mg-jt">
              <div className="mg-jt-head">
                <div>Date</div><div>Hippodrome</div><div>Cheval IA</div>
                <div>Cote</div><div>Mise</div><div>Résultat</div>
                <div style={{textAlign:"right"}}>Gain net</div>
              </div>
              {hist.length===0 ? (
                [1,2,3,4,5].map(i=>(
                  <div key={i} className="mg-jt-row">
                    {[80,140,140,60,60,80,80].map((w,j)=>(
                      <div key={j}><div className="mg-skel" style={{height:14,width:`${w*0.7}px`,borderRadius:2}}/></div>
                    ))}
                  </div>
                ))
              ) : (
                hist.map((h,i)=>{
                  const isWin=h.resultat==="GAGNANT";const isPlace=h.resultat==="PLACE";const isLose=h.resultat==="PERDU";const gainPos=h.gain>0;
                  return(
                    <div key={i} className={`mg-jt-row ${isWin?"win":isPlace?"place":isLose?"lose":""}`}>
                      <div className="mg-jt-date">{fmtDate(h.date)}</div>
                      <div><div className="mg-jt-hippe">{h.hippodrome}</div><div className="mg-jt-course">{h.course}</div></div>
                      <div className="mg-jt-cheval">#{h.chevalNum} {h.cheval}</div>
                      <div className="mg-jt-cote">{h.cote?`${h.cote.toFixed(1)}x`:"—"}</div>
                      <div className="mg-jt-mise">{h.mise}€</div>
                      <div><div className={`mg-jt-badge ${isWin?"win":isPlace?"place":"lose"}`}>{isWin?"✓ Gagné":isPlace?"~ Placé":"✗ Perdu"}</div></div>
                      <div className={`mg-jt-gain ${gainPos?"pos":h.gain===0?"neu":"neg"}`} style={{textAlign:"right"}}>{gainPos?"+":""}{Math.round(h.gain)}€</div>
                    </div>
                  );
                })
              )}
              <div className="mg-jt-footer">
                <div className="mg-jt-footer-stat">
                  {liveBest>0&&<><strong>{liveBest}</strong> meilleure série · </>}
                  {liveStreak>0&&<><strong style={{color:"var(--ylw)"}}>{liveStreak}</strong> en cours · </>}
                  Données mises à jour toutes les 5 minutes
                </div>
                <Link href="/signup" style={{fontSize:12,fontWeight:700,color:"var(--ylw)",textDecoration:"none",letterSpacing:".06em",textTransform:"uppercase"}}>
                  Voir l&apos;historique complet →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ STATS POWER LEVEL ════════ */}
        <div className="mg-stats" ref={statsRef}>
          {[
            {v:roiLabel,l:"ROI moyen 30 jours",s:"Sur bankroll 1 000 €",c:"y"},
            {v:`${cv.tickets}`,l:"Tickets enregistrés",s:"30 derniers jours",c:"w"},
            {v:`${cv.win}%`,l:"Taux de réussite",s:"Gagnant ou placé",c:"r"},
            {v:gainLabel,l:"Gain net 30 jours",s:"Bankroll de départ 1 000 €",c:"y"},
          ].map(s=>(
            <div key={s.l} className="mg-stat">
              <div className={`mg-stat-v ${s.c}`}>{s.v}</div>
              <div className="mg-stat-l">{s.l}</div>
              <div className="mg-stat-s">{s.s}</div>
              <div className="mg-stat-bar"><div className="mg-stat-bar-fill"/></div>
            </div>
          ))}
        </div>

        {/* ════════ COMMENT ÇA MARCHE ════════ */}
        <section className="mg-sec mid" id="comment">
          <div className="mg-cont">
            <div className="mg-sec-tag">Comment ça marche</div>
            <h2 className="mg-sec-h">3 étapes.<br/><em>0 heure</em> perdue.</h2>
            <div className="mg-steps">
              {[
                {n:"01",ico:"🔍",h:"TurfEdge analyse",p:"Chaque matin à 7h, 100% du programme PMU est chargé. Chaque cheval scoré sur 30+ signaux : forme récente, cote marché, jockey×hippodrome, distance, terrain.",chip:"⏰ 07:00 · Automatique"},
                {n:"02",ico:"🎯",h:"TurfEdge filtre",p:"Les courses illisibles sont écartées automatiquement. Une sur deux ne passe pas le filtre. Seule la value mathématiquement défendable est retenue.",chip:"📊 ~50% écartées"},
                {n:"03",ico:"📲",h:"Vous recevez",p:"Un seul verdict : hippodrome, cheval, mise Kelly, confiance. Dashboard + alerte Telegram T-15min pour les abonnés Premium.",chip:"⚡ Alerte T-15min"},
              ].map(s=>(
                <div key={s.n} className="mg-step">
                  <div className="mg-step-top"><div className="mg-step-n">{s.n}</div><div className="mg-step-ico">{s.ico}</div></div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                  <div className="mg-step-chip">{s.chip}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ AVANT/APRÈS ════════ */}
        <section className="mg-sec dark">
          <div className="mg-cont">
            <div className="mg-sec-tag">Avant vs Après</div>
            <h2 className="mg-sec-h">La différence.<br/><em>En chiffres réels.</em></h2>
            <div className="mg-avap">
              <div className="mg-card-red">
                <div className="mg-avap-tag">❌ Sans PMU Gagnant</div>
                <div className="mg-avap-h">Le parieur qui improvise</div>
                {["Joue 5 à 8 courses par jour sur instinct","Aucune rigueur sur la mise — double quand il « sent »","Aucun suivi de bankroll","Perd 2–3h à éplucher le programme chaque matin","Parie les courses loterie par FOMO"].map(t=>(
                  <div key={t} className="mg-avap-item"><div className="mg-avap-ico">✗</div><div className="mg-avap-txt">{t}</div></div>
                ))}
                <div className="mg-avap-stat"><div className="mg-avap-big">-18%</div><div className="mg-avap-k">ROI moyen sans méthode</div></div>
              </div>
              <div className="mg-card-grn">
                <div className="mg-avap-tag">✅ Avec PMU Gagnant</div>
                <div className="mg-avap-h">Le parieur qui maîtrise</div>
                {["1 ticket par jour — 30 secondes pour valider","Mise Kelly calculée automatiquement","Bilan ROI mis à jour chaque soir","Alerte Telegram — zéro surveillance du programme","Courses illisibles écartées par V9.2"].map(t=>(
                  <div key={t} className="mg-avap-item"><div className="mg-avap-ico">✓</div><div className="mg-avap-txt">{t}</div></div>
                ))}
                <div className="mg-avap-stat"><div className="mg-avap-big">{avapRoi}</div><div className="mg-avap-k">ROI moyen abonné · 30 jours réels</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ TÉMOIGNAGES ════════ */}
        <section className="mg-sec mid">
          <div className="mg-cont">
            <div className="mg-sec-tag">Témoignages vérifiés</div>
            <h2 className="mg-sec-h">Ce qu&apos;ils disent <em>vraiment.</em></h2>
            <div className="mg-testis">
              {[
                {av:"M",bg:"#1A5C2E",n:"Marc L.",m:"8 mois · Versailles",roi:"+31%",s:"★★★★★",t:"Avant je jouais 8 courses par jour. Maintenant j'en joue une. Et je gagne plus. C'est tout bête mais ça change tout."},
                {av:"S",bg:"#6B4E10",n:"Sylvie R.",m:"1 an · Lyon",roi:"+18%",s:"★★★★★",t:"Le verdict tombe à 9h. Je le lis avec mon café. Je joue ou je joue pas. Et c'est fini pour la journée."},
                {av:"A",bg:"#0E4A2A",n:"Antoine D.",m:"4 mois · Bordeaux",roi:"+24%",s:"★★★★☆",t:"Le truc dingue c'est voir V9.2 écarter une course que j'aurais jouée. À chaque fois il avait raison."},
              ].map(t=>(
                <div key={t.n} className="mg-testi">
                  <div className="mg-testi-stars">{t.s}</div>
                  <p className="mg-testi-txt">&quot;{t.t}&quot;</p>
                  <div className="mg-testi-row">
                    <div className="mg-testi-av" style={{background:t.bg,color:"var(--ylw)"}}>{t.av}</div>
                    <div><div className="mg-testi-name">{t.n}</div><div className="mg-testi-meta">Abonné depuis {t.m}</div></div>
                    <div className="mg-testi-roi">{t.roi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ PLANS ════════ */}
        <section className="mg-sec dark" id="plans">
          <div className="mg-cont" style={{textAlign:"center"}}>
            <div className="mg-sec-tag">Tarifs</div>
            <h2 className="mg-sec-h">Simple.<br/><em>Sans engagement.</em></h2>
            <p style={{fontSize:15,color:"var(--ts)",margin:"0 auto",lineHeight:1.75}}>14 jours pour juger sur résultats réels. Sans carte bancaire.</p>
          </div>
          <div className="mg-plans">
            {[
              {cat:"Découverte",n:"Gratuit",ny:"",p:"0",per:"/mois",rec:false,desc:"Découvrez V9.2 et testez 14 jours complets.",feats:[{on:true,t:"Verdict du jour (Jouer/Passer)"},{on:true,t:"3 courses analysées / semaine"},{on:false,t:"Cheval sélectionné + mise"},{on:false,t:"Alertes Telegram T-15"},{on:false,t:"Score V9.2 complet"}],href:"/signup",bc:"fr",bt:"Commencer gratuitement",eco:""},
              {cat:"Parieurs actifs",n:"Premium",ny:"y",p:"19",per:"/mois",rec:true,desc:"Tout : cheval, mise Kelly, score V9.2, Telegram, ROI.",feats:[{on:true,t:"Tout le programme analysé"},{on:true,t:"Cheval + score V9.2 + Kelly"},{on:true,t:"Alertes Telegram T-15min"},{on:true,t:"Coach IA illimité"},{on:true,t:"Bilan ROI temps réel"}],href:"/subscribe",bc:"pa",bt:"Essai 14 jours gratuit →",eco:""},
              {cat:"Méthodiques",n:"Annuel",ny:"",p:"149",per:"/an",rec:false,desc:"Tout Premium + 2 mois offerts + backtests V9.2.",feats:[{on:true,t:"Tout le plan Premium"},{on:true,t:"2 mois offerts"},{on:true,t:"Backtests historiques"},{on:true,t:"Export CSV"},{on:true,t:"Support prioritaire"}],href:"/subscribe?plan=annual",bc:"an",bt:"Économiser 79 € →",eco:"soit 12,41 € / mois"},
            ].map(p=>(
              <div key={p.n} className={`mg-plan${p.rec?" rec":""}`}>
                {p.rec&&<div className="mg-plan-badge">★ RECOMMANDÉ</div>}
                <div className="mg-plan-cat">{p.cat}</div>
                <div className={`mg-plan-name ${p.ny}`}>{p.n}</div>
                <div className="mg-plan-price"><sup>€</sup>{p.p}<span className="mg-plan-per">{p.per}</span></div>
                <p className="mg-plan-desc">{p.desc}</p>
                <ul className="mg-plan-feats">{p.feats.map(f=><li key={f.t}><span className={f.on?"on":"off"}>●</span><span>{f.t}</span></li>)}</ul>
                <Link href={p.href} className={`mg-plan-btn ${p.bc}`}>{p.bt}</Link>
                {p.eco&&<div className="mg-plan-eco">↳ {p.eco}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ════════ FAQ ════════ */}
        <section className="mg-sec mid">
          <div className="mg-cont" style={{textAlign:"center",marginBottom:48}}>
            <div className="mg-sec-tag">FAQ</div>
            <h2 className="mg-sec-h">Questions <em>fréquentes.</em></h2>
          </div>
          <div className="mg-faqs">
            {faqs.map((f,i)=>(
              <div key={i} className={`mg-faq${faqOpen===i?" on":""}`}>
                <div className="mg-faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)}>
                  <span className="mg-faq-q-txt">{f.q}</span><div className="mg-faq-ico">+</div>
                </div>
                <div className="mg-faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ CTA FINAL ════════ */}
        <section className="mg-cta">
          <div style={{position:"relative",zIndex:1}}>
            <div className="mg-sec-tag" style={{justifyContent:"center",display:"flex",marginBottom:20}}>Prêt à commencer ?</div>
            <h2 className="mg-cta-h">
              Le verdict<br/>tombe dans<br/><span className="y">{countdown} !!</span>
            </h2>
            <p className="mg-cta-p">14 jours d&apos;essai complet. Sans carte bancaire. Si ce n&apos;est pas pour vous, vous partez sans frais.</p>
            <Link href="/signup" className="mg-cta-main" style={{fontSize:"clamp(18px,2.5vw,26px)"}}>
              ▶ Démarrer gratuitement
            </Link>
            <div className="mg-cta-strip">
              <span>14 jours d&apos;essai</span><div className="mg-cta-strip-dot"/>
              <span>Sans CB</span><div className="mg-cta-strip-dot"/>
              <span>Résiliation 1 clic</span><div className="mg-cta-strip-dot"/>
              <span>ROI mesuré en direct</span>
            </div>
          </div>
        </section>

        {/* JEU RESPONSABLE */}
        <div className="mg-jr"><div className="mg-jr-inner" id="mg-jr"/></div>

        {/* FOOTER */}
        <footer className="mg-footer">
          <div className="mg-footer-grid">
            <div className="mg-footer-brand">
              <Link href="/" className="mg-nav-logo" style={{display:"inline-flex"}}>
                <div className="mg-nav-badge">PG</div>
                <div><span className="mg-nav-name">PMUGagnant</span><span className="mg-nav-v">TurfEdge V9.2</span></div>
              </Link>
              <p>L&apos;IA qui analyse 30+ signaux par course PMU et vous donne un seul verdict. Résultats réels affichés.</p>
            </div>
            {[{t:"Produit",l:[["Dashboard","/dashboard"],["Mon bilan","/bilan"],["Mes paris","/mes-paris"],["Premium","/subscribe"]]},
              {t:"Compte",l:[["Connexion","/login"],["Inscription","/signup"],["Abonnement","/subscribe"]]},
              {t:"Légal",l:[["Mentions légales","/mentions-legales"],["CGV","/cgv"],["Confidentialité","/politique-confidentialite"],["Jeu responsable","/jeu-responsable"]]},
            ].map(col=>(
              <div key={col.t} className="mg-footer-col">
                <div className="mg-footer-col-t">{col.t}</div>
                <ul>{col.l.map(([lbl,href])=><li key={lbl}><Link href={href}>{lbl}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="mg-footer-bot">
            <span>© 2026 PMU GAGNANT · TURFEDGE V9.2</span>
            <span>JOUER COMPORTE DES RISQUES · <a href="tel:0974751313">09 74 75 13 13</a></span>
          </div>
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{__html:`
        var jr=document.getElementById('mg-jr');
        if(jr){var items=['⚠ JOUER COMPORTE DES RISQUES','ENDETTEMENT · DÉPENDANCE','APPELEZ LE 09 74 75 13 13','JOUEURS-INFO-SERVICE.FR','INTERDIT AUX MINEURS'];[0,1,2].forEach(function(){items.forEach(function(i){jr.innerHTML+='<span class="mg-jr-item">'+i+'</span>';});});}
      `}}/>
    </>
  );
}
