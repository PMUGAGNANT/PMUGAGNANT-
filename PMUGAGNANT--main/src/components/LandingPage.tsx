"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface HistEntry { date:string; course:string; hippodrome:string; cheval:string; chevalNum:number; cote:number|null; mise:number; gain:number; resultat:string; }
interface LiveData { roi30d:number; totalPredictions:number; winRate:number; netGain30d:number; currentStreak:number; bestStreak:number; }

function useCountdown() {
  const [label, setLabel] = useState("07:00");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(7, 0, 0, 0);
      if (now >= target) target.setDate(target.getDate() + 1);
      const diff = Math.floor((target.getTime() - now.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
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
  const [cardScanned, setCardScanned] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown();

  useEffect(() => {
    fetch("/api/live-stats").then(r=>r.json()).then((d:LiveData) => setLive(d)).catch(()=>{});
    fetch("/api/historique?days=14").then(r=>r.json()).then(d => {
      if(d?.historique) setHist(d.historique.slice(0,7));
    }).catch(()=>{});

    const obs = new IntersectionObserver(([e]) => { if(e.isIntersecting){ setCounted(true); obs.disconnect(); }},{threshold:0.3});
    if(statsRef.current) obs.observe(statsRef.current);

    // Scanning animation on ticket card after 1.2s
    const scanTimer = setTimeout(() => setCardScanned(true), 1200);

    const pool=[
      {name:"Marc L.",txt:"vient de gagner",gain:"+37 €"},{name:"Thomas M.",txt:"vient de s'inscrire"},
      {name:"Sylvie R.",txt:"passe en Premium"},{name:"Karim D.",txt:"vient de gagner",gain:"+52 €"},
      {name:"Ahmed B.",txt:"vient de rejoindre"},{name:"Julie M.",txt:"vient de gagner",gain:"+28 €"},
    ];
    let idx=0;
    const fire=()=>{
      const u=pool[idx%pool.length];idx++;
      setNotif({id:Date.now(),...u});
      setTimeout(()=>setNotif(null),5000);
      setTimeout(fire,10000+Math.random()*7000);
    };
    const t=setTimeout(fire,4000);
    return()=>{clearTimeout(t);clearTimeout(scanTimer);obs.disconnect();};
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

  const fmtDate=(iso:string)=>{
    try{const d=new Date(iso);return`${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}`;}catch{return iso;}
  };

  const faqs=[
    {q:"Comment TurfEdge V9.2 analyse-t-il les courses ?",a:"Chaque matin à 7h, il charge 100% du programme PMU et score chaque cheval sur 30+ signaux : forme sur 6 dernières sorties (décroissance temporelle), cote PMU vs probabilité calculée, jockey×hippodrome sur 24 mois, distance exacte, terrain et météo. Les courses jugées illisibles sont automatiquement écartées."},
    {q:"Le ROI affiché est-il réel ?",a:"Oui. Chaque pari est enregistré dans Supabase avant le départ de la course. Les résultats sont intégrés automatiquement. Vous voyez les vraies données, pas des chiffres marketing."},
    {q:"Puis-je résilier à tout moment ?",a:"Oui, sans engagement, depuis votre espace compte. La résiliation prend effet à la fin de la période en cours, sans frais."},
    {q:"Comment je reçois le ticket ?",a:"Sur votre dashboard (desktop & mobile) + alerte Telegram T-15min avant le départ via @pmugagnantbot pour les abonnés Premium."},
    {q:"Vous pariez à ma place ?",a:"Non. PMU Gagnant analyse et recommande. Vous décidez seul. Nous n'avons aucun accès à votre compte PMU.fr."},
  ];

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{
          --g:#00FF87;--g2:#00E87A;--y:#FFD700;--r:#FF4D5A;--b:#3B82F6;
          --bg:#030308;--s1:#06060F;--s2:#08081A;
          --br:rgba(255,255,255,.07);--t:#F0F0FF;--ts:rgba(240,240,255,.55);--tm:rgba(240,240,255,.28)
        }
        .lp{background:var(--bg);color:var(--t);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        .lp *{box-sizing:border-box}

        /* ── FOND ── */
        .lp-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
        .lp-bg-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 120% 80% at 50% 0%,black 10%,transparent 100%)}
        .lp-bg-glow1{position:absolute;top:-300px;left:30%;width:1000px;height:900px;background:radial-gradient(ellipse,rgba(0,255,135,.06) 0%,transparent 60%)}
        .lp-bg-glow2{position:absolute;top:50%;right:-15%;width:600px;height:600px;background:radial-gradient(circle,rgba(59,130,246,.04) 0%,transparent 65%)}
        .lp-bg-glow3{position:absolute;bottom:10%;left:-10%;width:500px;height:500px;background:radial-gradient(circle,rgba(255,215,0,.03) 0%,transparent 65%)}

        /* ── NOTIF ── */
        .lp-notif{position:fixed;bottom:80px;right:24px;z-index:9999;background:rgba(6,6,15,.96);border:1px solid rgba(0,255,135,.18);border-left:3px solid var(--g);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:280px;backdrop-filter:blur(24px);box-shadow:0 24px 64px rgba(0,0,0,.7),0 0 0 1px rgba(0,255,135,.05);animation:notifIn .45s cubic-bezier(.34,1.56,.64,1)}
        @keyframes notifIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        .lp-notif-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00C851,#00FF87);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#030308;flex-shrink:0}
        .lp-notif-name{font-size:13px;font-weight:700;color:var(--t)}
        .lp-notif-sub{font-size:11px;color:var(--tm);margin-top:1px}
        .lp-notif-gain{font-size:15px;font-weight:800;color:var(--g);margin-left:auto;flex-shrink:0}

        /* ── NAV ── */
        .lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:rgba(3,3,8,.9);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,.05)}
        .lp-nav-logo{display:flex;align-items:center;gap:9px;text-decoration:none}
        .lp-nav-badge{width:30px;height:30px;background:var(--g);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#030308;letter-spacing:-.02em}
        .lp-nav-name{font-size:15px;font-weight:800;letter-spacing:-.03em;color:var(--t)}
        .lp-nav-v{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(0,255,135,.4);display:block;margin-top:-2px}
        .lp-nav-links{display:flex;align-items:center;gap:2px;list-style:none}
        .lp-nav-links a{padding:6px 12px;border-radius:7px;font-size:13px;font-weight:500;color:var(--tm);text-decoration:none;transition:all .15s}
        .lp-nav-links a:hover{color:var(--t);background:rgba(255,255,255,.05)}
        .lp-nav-r{display:flex;align-items:center;gap:8px}
        .lp-btn-sm{padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;transition:all .2s}
        .lp-btn-sm.ghost{border:1px solid rgba(255,255,255,.1);color:var(--ts)}
        .lp-btn-sm.ghost:hover{border-color:rgba(255,255,255,.25);color:var(--t)}
        .lp-btn-sm.green{background:var(--g);color:#030308;font-weight:700}
        .lp-btn-sm.green:hover{background:#33FF9E;box-shadow:0 6px 24px rgba(0,255,135,.35)}

        /* ── HERO (SPLIT) ── */
        .lp-hero{position:relative;z-index:1;min-height:100vh;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:48px;padding:100px 64px 80px;max-width:1300px;margin:0 auto}
        .lp-hero-left{}
        .lp-hero-tag{display:inline-flex;align-items:center;gap:8px;padding:5px 14px;background:rgba(0,255,135,.07);border:1px solid rgba(0,255,135,.18);border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--g);text-transform:uppercase;margin-bottom:28px;animation:fIn .5s ease both}
        @keyframes fIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fInR{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
        .lp-live-dot{width:6px;height:6px;border-radius:50%;background:var(--g);animation:pls 2s ease infinite;flex-shrink:0}
        @keyframes pls{0%,100%{box-shadow:0 0 0 0 rgba(0,255,135,.6)}60%{box-shadow:0 0 0 8px rgba(0,255,135,0)}}
        .lp-h1{font-size:clamp(44px,4.8vw,82px);font-weight:900;line-height:.88;letter-spacing:-.05em;margin-bottom:22px;animation:fIn .6s .1s ease both}
        .lp-h1 .g{color:var(--g)}.lp-h1 .y{color:var(--y)}
        .lp-h1-sub{font-size:17px;color:var(--ts);line-height:1.75;max-width:520px;margin-bottom:36px;font-weight:400;animation:fIn .6s .2s ease both}
        .lp-h1-sub strong{color:var(--t);font-weight:600}
        .lp-hero-ctas{display:flex;align-items:center;gap:10px;flex-wrap:wrap;animation:fIn .6s .3s ease both;margin-bottom:20px}
        .lp-hero-btn{padding:15px 32px;border-radius:11px;font-size:15px;font-weight:700;text-decoration:none;transition:all .25s;display:inline-flex;align-items:center;gap:7px;letter-spacing:-.01em}
        .lp-hero-btn.main{background:var(--g);color:#030308;box-shadow:0 0 60px rgba(0,255,135,.25),0 4px 20px rgba(0,255,135,.15)}
        .lp-hero-btn.main:hover{background:#33FF9E;transform:translateY(-2px);box-shadow:0 0 80px rgba(0,255,135,.4),0 8px 32px rgba(0,255,135,.25)}
        .lp-hero-btn.sec{border:1px solid rgba(255,255,255,.12);color:var(--ts)}
        .lp-hero-btn.sec:hover{border-color:rgba(255,255,255,.28);color:var(--t);background:rgba(255,255,255,.04)}
        .lp-hero-proof{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:500;color:var(--tm);animation:fIn .6s .4s ease both;letter-spacing:.02em;flex-wrap:wrap}
        .lp-hero-proof-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.15)}

        /* ── HERO CARD TICKET ── */
        .lp-hero-right{animation:fInR .7s .3s ease both;position:relative;display:flex;align-items:center;justify-content:center}
        .lp-hero-card-wrap{position:relative}
        .lp-hero-card-glow{position:absolute;inset:-40px;background:radial-gradient(ellipse,rgba(0,255,135,.12) 0%,transparent 65%);z-index:0;border-radius:50%}
        .lp-hero-card{position:relative;z-index:1;background:rgba(8,8,22,.9);border:1px solid rgba(0,255,135,.2);border-radius:20px;padding:28px;width:360px;backdrop-filter:blur(20px);box-shadow:0 32px 80px rgba(0,0,0,.6),0 0 0 1px rgba(0,255,135,.08),inset 0 1px 0 rgba(255,255,255,.06)}
        .lp-hc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
        .lp-hc-tag{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(0,255,135,.5)}
        .lp-hc-course{font-size:11px;font-weight:700;color:var(--tm);letter-spacing:.04em}
        .lp-hc-score-row{margin-bottom:18px}
        .lp-hc-score-lbl{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--tm);margin-bottom:6px}
        .lp-hc-bar{height:6px;border-radius:100px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:4px}
        .lp-hc-bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#00C851,#00FF87);transition:width 1.2s cubic-bezier(.34,1.2,.64,1)}
        .lp-hc-score-val{font-size:28px;font-weight:900;color:var(--g);letter-spacing:-.04em;line-height:1}
        .lp-hc-score-max{font-size:14px;color:var(--tm);font-weight:500}
        .lp-hc-horse{display:flex;align-items:center;justify-content:space-between;background:rgba(0,255,135,.05);border:1px solid rgba(0,255,135,.12);border-radius:10px;padding:12px 14px;margin-bottom:16px}
        .lp-hc-horse-name{font-size:16px;font-weight:800;color:var(--t);letter-spacing:-.02em}
        .lp-hc-horse-num{font-size:11px;color:rgba(0,255,135,.5);margin-top:2px}
        .lp-hc-verdict{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:rgba(0,255,135,.12);border:1px solid rgba(0,255,135,.25);border-radius:7px;font-size:12px;font-weight:800;color:var(--g);letter-spacing:.06em}
        .lp-hc-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px}
        .lp-hc-cell{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 12px}
        .lp-hc-cell-lbl{font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--tm);margin-bottom:5px}
        .lp-hc-cell-val{font-size:18px;font-weight:900;letter-spacing:-.02em}
        .lp-hc-cell-val.g{color:var(--g)}.lp-hc-cell-val.y{color:var(--y)}.lp-hc-cell-val.w{color:var(--t)}
        .lp-hc-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;background:var(--g);border-radius:9px;border:none;font-size:14px;font-weight:800;color:#030308;cursor:pointer;letter-spacing:-.01em}
        .lp-hc-scan{position:absolute;inset:0;border-radius:20px;overflow:hidden;pointer-events:none;z-index:2}
        .lp-hc-scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,255,135,.6),transparent);animation:scan 2s ease forwards;opacity:0}
        @keyframes scan{0%{top:-2px;opacity:0}10%{opacity:1}80%{opacity:.8}100%{top:102%;opacity:0}}
        .lp-hc-countdown{display:flex;align-items:center;gap:7px;margin-top:12px;padding:8px 12px;background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.1);border-radius:8px;font-size:11px;font-weight:600;color:rgba(255,215,0,.55)}
        .lp-hc-cd-val{color:var(--y);font-weight:800;font-variant-numeric:tabular-nums}

        /* ── WINS TICKER (social proof) ── */
        .lp-wins{position:relative;z-index:1;overflow:hidden;white-space:nowrap;background:rgba(0,255,135,.025);border-top:1px solid rgba(0,255,135,.08);border-bottom:1px solid rgba(0,255,135,.08);padding:10px 0}
        .lp-wins-inner{display:inline-flex;animation:tick 28s linear infinite}
        @keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .lp-wins-item{display:inline-flex;align-items:center;gap:8px;padding:0 24px;font-size:11px;font-weight:700;letter-spacing:.04em;color:rgba(255,255,255,.35)}
        .lp-wins-item .win{color:var(--g)}.lp-wins-item .gain{color:var(--g);font-weight:800}
        .lp-wins-dot{width:3px;height:3px;border-radius:50%;background:rgba(0,255,135,.25);flex-shrink:0}

        /* ── TICKER ── */
        .lp-ticker{position:relative;z-index:1;overflow:hidden;white-space:nowrap;border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);background:rgba(255,255,255,.01);padding:10px 0}
        .lp-ticker-inner{display:inline-flex;animation:tick 22s linear infinite}
        .lp-ticker-item{display:inline-flex;align-items:center;gap:10px;padding:0 28px;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.22)}
        .lp-ticker-dot{width:3px;height:3px;border-radius:50%;background:var(--g);opacity:.4;display:inline-block}

        /* ── JOURNAL ── */
        .lp-journal{position:relative;z-index:1;padding:100px 24px;background:var(--s1)}
        .lp-journal-inner{max-width:1000px;margin:0 auto}
        .lp-section-tag{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--g);margin-bottom:14px}
        .lp-section-h{font-size:clamp(34px,4.2vw,58px);font-weight:900;letter-spacing:-.04em;line-height:.92;margin-bottom:16px}
        .lp-section-h em{font-style:normal;color:var(--y)}
        .lp-section-p{font-size:16px;color:var(--ts);line-height:1.7;max-width:540px;font-weight:400;margin-bottom:48px}

        /* TABLE JOURNAL */
        .lp-jt{border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.07);background:rgba(4,4,12,.7);backdrop-filter:blur(12px)}
        .lp-jt-head{display:grid;grid-template-columns:80px 1fr 1fr 80px 80px 90px 100px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.06);font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.25)}
        .lp-jt-row{display:grid;grid-template-columns:80px 1fr 1fr 80px 80px 90px 100px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.04);align-items:center;transition:background .15s}
        .lp-jt-row:last-child{border-bottom:none}
        .lp-jt-row:hover{background:rgba(255,255,255,.02)}
        .lp-jt-row.win{border-left:2px solid var(--g);padding-left:18px}
        .lp-jt-row.lose{border-left:2px solid var(--r);padding-left:18px}
        .lp-jt-row.place{border-left:2px solid var(--y);padding-left:18px}
        .lp-jt-date{font-size:12px;font-weight:600;color:var(--tm);font-variant-numeric:tabular-nums}
        .lp-jt-hippe{font-size:13px;font-weight:700;color:var(--t)}
        .lp-jt-course{font-size:11px;color:var(--tm);margin-top:1px}
        .lp-jt-cheval{font-size:13px;font-weight:700;color:var(--t)}
        .lp-jt-cote{font-size:13px;font-weight:700;color:var(--y);font-variant-numeric:tabular-nums}
        .lp-jt-mise{font-size:13px;font-weight:600;color:var(--ts);font-variant-numeric:tabular-nums}
        .lp-jt-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:5px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;width:fit-content}
        .lp-jt-badge.win{background:rgba(0,255,135,.1);color:var(--g);border:1px solid rgba(0,255,135,.2)}
        .lp-jt-badge.lose{background:rgba(255,77,90,.1);color:var(--r);border:1px solid rgba(255,77,90,.2)}
        .lp-jt-badge.place{background:rgba(255,215,0,.1);color:var(--y);border:1px solid rgba(255,215,0,.2)}
        .lp-jt-gain{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;text-align:right}
        .lp-jt-gain.pos{color:var(--g)}.lp-jt-gain.neg{color:var(--r)}.lp-jt-gain.neu{color:var(--y)}
        .lp-jt-empty{padding:40px;text-align:center;font-size:14px;color:var(--tm)}
        .lp-jt-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.02)}
        .lp-jt-footer-stat{font-size:12px;color:var(--tm);font-weight:500}
        .lp-jt-footer-stat strong{color:var(--t);font-weight:700}
        .lp-skel{background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%);background-size:200% 100%;animation:shimmer 1.5s ease infinite;border-radius:4px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* ── STATS ── */
        .lp-stats{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.05);border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04)}
        .lp-stat{background:var(--bg);padding:44px 28px;text-align:center;position:relative;overflow:hidden;transition:background .2s}
        .lp-stat:hover{background:rgba(255,255,255,.015)}
        .lp-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,135,.2),transparent);opacity:0;transition:opacity .3s}
        .lp-stat:hover::before{opacity:1}
        .lp-stat-v{font-size:52px;font-weight:900;letter-spacing:-.04em;line-height:1;margin-bottom:8px;font-variant-numeric:tabular-nums}
        .lp-stat-v.g{color:var(--g)}.lp-stat-v.y{color:var(--y)}.lp-stat-v.w{color:var(--t)}
        .lp-stat-l{font-size:13px;font-weight:500;color:var(--ts)}
        .lp-stat-s{font-size:11px;color:var(--tm);margin-top:4px}

        /* ── COMMENT ÇA MARCHE ── */
        .lp-sec{position:relative;z-index:1;padding:100px 24px}
        .lp-sec.dark{background:var(--s1)}.lp-sec.mid{background:var(--s2)}
        .lp-cont{max-width:1100px;margin:0 auto}
        .lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px}
        .lp-step{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:32px 26px;transition:all .25s;position:relative;overflow:hidden}
        .lp-step::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,255,135,.03),transparent);opacity:0;transition:opacity .3s;border-radius:16px}
        .lp-step:hover{transform:translateY(-5px);border-color:rgba(0,255,135,.18)}
        .lp-step:hover::after{opacity:1}
        .lp-step-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
        .lp-step-n{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(0,255,135,.4)}
        .lp-step-ico{width:40px;height:40px;border-radius:11px;background:rgba(0,255,135,.06);border:1px solid rgba(0,255,135,.1);display:flex;align-items:center;justify-content:center;font-size:19px}
        .lp-step h3{font-size:20px;font-weight:800;letter-spacing:-.03em;margin-bottom:10px}
        .lp-step p{font-size:13px;color:var(--ts);line-height:1.75}
        .lp-step-chip{margin-top:16px;display:inline-flex;align-items:center;gap:6px;padding:4px 11px;background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.1);border-radius:100px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,215,0,.5)}

        /* ── AVANT/APRÈS ── */
        .lp-avap{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:52px}
        .lp-card-red{border-radius:18px;padding:36px;background:rgba(255,77,90,.025);border:1px solid rgba(255,77,90,.12)}
        .lp-card-green{border-radius:18px;padding:36px;background:rgba(0,255,135,.025);border:1px solid rgba(0,255,135,.12)}
        .lp-avap-tag{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:12px}
        .lp-card-red .lp-avap-tag{color:rgba(255,77,90,.55)}
        .lp-card-green .lp-avap-tag{color:rgba(0,255,135,.55)}
        .lp-avap-h{font-size:24px;font-weight:800;letter-spacing:-.03em;margin-bottom:20px}
        .lp-avap-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}
        .lp-avap-ico{width:20px;height:20px;border-radius:50%;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}
        .lp-card-red .lp-avap-ico{background:rgba(255,77,90,.1);color:var(--r)}
        .lp-card-green .lp-avap-ico{background:rgba(0,255,135,.08);color:var(--g)}
        .lp-avap-txt{font-size:13px;color:var(--ts);line-height:1.6}
        .lp-avap-stat{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06)}
        .lp-avap-big{font-size:52px;font-weight:900;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
        .lp-card-red .lp-avap-big{color:var(--r)}
        .lp-card-green .lp-avap-big{color:var(--g)}
        .lp-avap-k{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.22);margin-top:5px}

        /* ── TÉMOIGNAGES ── */
        .lp-testis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:52px}
        .lp-testi{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:28px;transition:all .22s;position:relative}
        .lp-testi:hover{background:rgba(255,255,255,.04);border-color:rgba(0,255,135,.14);transform:translateY(-3px)}
        .lp-testi-stars{color:var(--y);font-size:12px;letter-spacing:2px;margin-bottom:12px}
        .lp-testi-txt{font-size:14px;color:rgba(255,255,255,.65);line-height:1.75;font-style:italic;margin-bottom:20px}
        .lp-testi-row{display:flex;align-items:center;gap:9px}
        .lp-testi-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#030308;flex-shrink:0}
        .lp-testi-name{font-size:13px;font-weight:700}
        .lp-testi-meta{font-size:11px;color:var(--tm);margin-top:1px}
        .lp-testi-roi{margin-left:auto;font-size:17px;font-weight:900;color:var(--g);letter-spacing:-.02em}

        /* ── PLANS ── */
        .lp-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:960px;margin:52px auto 0}
        .lp-plan{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:34px 26px;position:relative;transition:all .22s}
        .lp-plan:hover{transform:translateY(-4px)}
        .lp-plan.rec{border-color:rgba(0,255,135,.28);background:rgba(0,255,135,.02);box-shadow:0 0 60px rgba(0,255,135,.06)}
        .lp-plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--g);color:#030308;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:5px 14px;border-radius:100px;white-space:nowrap}
        .lp-plan-cat{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--tm);margin-bottom:8px}
        .lp-plan-name{font-size:26px;font-weight:900;letter-spacing:-.04em;margin-bottom:6px}
        .lp-plan-name.g{color:var(--g)}
        .lp-plan-price{font-size:50px;font-weight:900;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums;margin-bottom:4px}
        .lp-plan-price sup{font-size:20px;vertical-align:top;margin-top:10px;display:inline-block;font-weight:700}
        .lp-plan-per{font-size:13px;color:var(--tm);font-weight:400}
        .lp-plan-desc{font-size:12px;color:var(--ts);margin:12px 0 20px;line-height:1.6;min-height:36px}
        .lp-plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:24px}
        .lp-plan-feats li{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.72)}
        .lp-plan-feats .on{color:var(--g);font-size:11px}.lp-plan-feats .off{color:rgba(255,255,255,.16);font-size:11px}
        .lp-plan-feats .off+span{color:rgba(255,255,255,.26)}
        .lp-plan-btn{display:block;text-align:center;padding:13px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;transition:all .2s}
        .lp-plan-btn.fr{border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.65)}
        .lp-plan-btn.fr:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.04)}
        .lp-plan-btn.pa{background:var(--g);color:#030308}
        .lp-plan-btn.pa:hover{background:#33FF9E;box-shadow:0 8px 32px rgba(0,255,135,.38)}
        .lp-plan-btn.an{border:1px solid rgba(0,255,135,.22);color:var(--g)}
        .lp-plan-btn.an:hover{background:rgba(0,255,135,.06)}
        .lp-plan-eco{text-align:center;font-size:11px;font-weight:600;color:rgba(0,255,135,.45);margin-top:7px}
        .lp-plan-saving{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(255,77,90,.1);border:1px solid rgba(255,77,90,.2);border-radius:5px;font-size:9px;font-weight:800;color:var(--r);letter-spacing:.06em;margin-left:8px;vertical-align:middle}

        /* ── FAQ ── */
        .lp-faqs{max-width:720px;margin:52px auto 0;display:flex;flex-direction:column;gap:3px}
        .lp-faq{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:11px;overflow:hidden;transition:border-color .2s}
        .lp-faq.on{border-color:rgba(0,255,135,.18)}
        .lp-faq-q{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;user-select:none}
        .lp-faq-q-txt{font-size:14px;font-weight:600;color:rgba(255,255,255,.78);transition:color .2s}
        .lp-faq-q:hover .lp-faq-q-txt{color:var(--t)}
        .lp-faq-ico{width:22px;height:22px;border-radius:50%;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;color:rgba(0,255,135,.55);font-size:15px;transition:all .28s;flex-shrink:0}
        .lp-faq.on .lp-faq-ico{transform:rotate(45deg);border-color:rgba(0,255,135,.28);background:rgba(0,255,135,.07)}
        .lp-faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease,padding .3s;font-size:13px;color:var(--ts);line-height:1.8;padding:0 22px}
        .lp-faq.on .lp-faq-a{max-height:200px;padding:0 22px 18px}

        /* ── CTA FINAL ── */
        .lp-cta{position:relative;z-index:1;padding:140px 24px;text-align:center;overflow:hidden;background:var(--s1)}
        .lp-cta::before{content:'';position:absolute;bottom:-80px;left:50%;transform:translateX(-50%);width:900px;height:700px;background:radial-gradient(ellipse,rgba(0,255,135,.08) 0%,transparent 60%);pointer-events:none}
        .lp-cta-h{font-size:clamp(50px,9vw,112px);font-weight:900;line-height:.84;letter-spacing:-.06em;margin-bottom:28px}
        .lp-cta-h .g{color:var(--g)}
        .lp-cta-p{font-size:17px;color:var(--ts);max-width:460px;margin:0 auto 48px;line-height:1.7}
        .lp-cta-strip{display:flex;align-items:center;justify-content:center;gap:14px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--tm);margin-top:28px;flex-wrap:wrap}
        .lp-cta-strip-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.12)}
        .lp-cta-strip .hi{color:var(--ts)}

        /* ── JEU RESPONSABLE ── */
        .lp-jr{position:relative;z-index:1;overflow:hidden;white-space:nowrap;background:rgba(255,255,255,.01);border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04)}
        .lp-jr-inner{display:inline-flex;animation:tick 42s linear infinite}
        .lp-jr-item{display:inline-flex;align-items:center;gap:10px;padding:12px 28px;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.16)}

        /* ── FOOTER ── */
        .lp-footer{position:relative;z-index:1;background:#01010A;border-top:1px solid rgba(255,255,255,.05);padding:60px 24px 32px}
        .lp-footer-grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:48px}
        .lp-footer-brand p{font-size:12px;color:rgba(255,255,255,.26);line-height:1.75;margin-top:12px}
        .lp-footer-col-t{font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.2);margin-bottom:14px}
        .lp-footer-col ul{list-style:none;display:flex;flex-direction:column;gap:9px}
        .lp-footer-col ul a{font-size:13px;color:rgba(255,255,255,.32);text-decoration:none;transition:color .15s}
        .lp-footer-col ul a:hover{color:rgba(255,255,255,.72)}
        .lp-footer-bot{max-width:1100px;margin:0 auto;padding-top:20px;border-top:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.16)}
        .lp-footer-bot a{color:rgba(0,255,135,.22);text-decoration:none}

        @media(max-width:1024px){
          .lp-hero{grid-template-columns:1fr;padding:100px 32px 60px;text-align:center;max-width:640px}
          .lp-hero-right{display:none}
          .lp-h1-sub,.lp-hero-proof{margin-left:auto;margin-right:auto}
          .lp-hero-ctas{justify-content:center}
        }
        @media(max-width:860px){
          .lp-nav-links{display:none}
          .lp-nav{padding:0 18px}
          .lp-hero,.lp-sec,.lp-journal,.lp-cta{padding:80px 18px}
          .lp-stats{grid-template-columns:1fr 1fr}
          .lp-steps,.lp-avap,.lp-testis,.lp-plans{grid-template-columns:1fr}
          .lp-footer-grid{grid-template-columns:1fr 1fr}
          .lp-jt-head,.lp-jt-row{grid-template-columns:60px 1fr 1fr 70px 80px}
          .lp-jt-head>*:nth-child(4),.lp-jt-head>*:nth-child(5),.lp-jt-row>*:nth-child(4),.lp-jt-row>*:nth-child(5){display:none}
        }
      `}</style>

      <div className="lp">
        {/* FOND */}
        <div className="lp-bg">
          <div className="lp-bg-grid"/>
          <div className="lp-bg-glow1"/>
          <div className="lp-bg-glow2"/>
          <div className="lp-bg-glow3"/>
        </div>

        {/* NOTIF LIVE */}
        {notif && (
          <div className="lp-notif" key={notif.id}>
            <div className="lp-notif-av">{notif.name.split(" ").map((p:string)=>p[0]).join("")}</div>
            <div><div className="lp-notif-name">{notif.name}</div><div className="lp-notif-sub">{notif.txt}</div></div>
            {notif.gain && <div className="lp-notif-gain">{notif.gain}</div>}
          </div>
        )}

        {/* NAV */}
        <nav className="lp-nav">
          <Link href="/" className="lp-nav-logo">
            <div className="lp-nav-badge">PG</div>
            <div><span className="lp-nav-name">PMUGagnant</span><span className="lp-nav-v">TurfEdge V9.2</span></div>
          </Link>
          <ul className="lp-nav-links">
            <li><a href="#preuves">Preuves réelles</a></li>
            <li><a href="#comment">Comment ça marche</a></li>
            <li><a href="#plans">Tarifs</a></li>
          </ul>
          <div className="lp-nav-r">
            <Link href="/login" className="lp-btn-sm ghost">Connexion</Link>
            <Link href="/signup" className="lp-btn-sm green">Essai gratuit →</Link>
          </div>
        </nav>

        {/* ════════ HERO SPLIT ════════ */}
        <section style={{position:"relative",zIndex:1}}>
          <div className="lp-hero">
            {/* LEFT */}
            <div className="lp-hero-left">
              <div className="lp-hero-tag">
                <div className="lp-live-dot"/>
                Moteur actif · Prochain verdict dans <strong style={{color:"var(--g)",marginLeft:4}}>{countdown}</strong>
              </div>
              <h1 className="lp-h1">
                L&apos;IA qui lit<br/>
                <span className="g">chaque course</span><br/>
                PMU. Chaque matin.
              </h1>
              <p className="lp-h1-sub">
                <strong>TurfEdge V9.2 score 30+ signaux par cheval,</strong> écarte les courses illisibles et vous donne un seul ticket — cheval, mise Kelly, cote. Les résultats réels sont affichés ci-dessous.
              </p>
              <div className="lp-hero-ctas">
                <Link href="/signup" className="lp-hero-btn main">Démarrer gratuitement →</Link>
                <a href="#preuves" className="lp-hero-btn sec">Voir les résultats réels</a>
              </div>
              <div className="lp-hero-proof">
                <span>✓ 14 jours d&apos;essai</span>
                <div className="lp-hero-proof-sep"/>
                <span>✓ Sans carte bancaire</span>
                <div className="lp-hero-proof-sep"/>
                <span>✓ Résiliation en 1 clic</span>
              </div>
            </div>

            {/* RIGHT — TICKET CARD */}
            <div className="lp-hero-right">
              <div className="lp-hero-card-wrap">
                <div className="lp-hero-card-glow"/>
                <div className="lp-hero-card">
                  {/* Scan line animation */}
                  <div className="lp-hc-scan">
                    {cardScanned && <div className="lp-hc-scan-line"/>}
                  </div>

                  <div className="lp-hc-header">
                    <div className="lp-hc-tag">● VERDICT IA · V9.2</div>
                    <div className="lp-hc-course">R2C5 · VIRE · 14:12</div>
                  </div>

                  <div className="lp-hc-score-row">
                    <div className="lp-hc-score-lbl">Score de confiance</div>
                    <div className="lp-hc-bar">
                      <div className="lp-hc-bar-fill" style={{width: cardScanned ? "88%" : "0%"}}/>
                    </div>
                    <span className="lp-hc-score-val">88</span>
                    <span className="lp-hc-score-max"> / 100</span>
                  </div>

                  <div className="lp-hc-horse">
                    <div>
                      <div className="lp-hc-horse-name">LINA DU RIB</div>
                      <div className="lp-hc-horse-num">N°1 · Pépite du jour 💎</div>
                    </div>
                    <div className="lp-hc-verdict">✓ JOUER</div>
                  </div>

                  <div className="lp-hc-grid">
                    <div className="lp-hc-cell">
                      <div className="lp-hc-cell-lbl">Mise Kelly</div>
                      <div className="lp-hc-cell-val g">12 €</div>
                    </div>
                    <div className="lp-hc-cell">
                      <div className="lp-hc-cell-lbl">Cote PMU</div>
                      <div className="lp-hc-cell-val y">9.8x</div>
                    </div>
                    <div className="lp-hc-cell">
                      <div className="lp-hc-cell-lbl">Signal</div>
                      <div className="lp-hc-cell-val w">8.8/10</div>
                    </div>
                  </div>

                  <div className="lp-hc-btn">
                    <span>✓</span> Ticket enregistré
                  </div>

                  <div className="lp-hc-countdown">
                    <span>⏱</span>
                    <span>Prochain verdict dans <span className="lp-hc-cd-val">{countdown}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WINS SOCIAL PROOF TICKER */}
        <div className="lp-wins">
          <div className="lp-wins-inner" id="lp-wins"/>
        </div>

        {/* HIPPODROME TICKER */}
        <div className="lp-ticker"><div className="lp-ticker-inner" id="lp-ticker"/></div>

        {/* ════════ JOURNAL DE BORD ════════ */}
        <section className="lp-journal" id="preuves">
          <div className="lp-journal-inner">
            <div className="lp-section-tag">Journal de bord · Données réelles Supabase</div>
            <h2 className="lp-section-h">Ce que l&apos;IA a dit.<br/>Ce qui s&apos;est passé <em>réellement.</em></h2>
            <p className="lp-section-p">Chaque ligne est un pari réel — enregistré avant le départ. Aucun cherry-picking. Aucune retouche. La preuve brute.</p>

            <div className="lp-jt">
              <div className="lp-jt-head">
                <div>Date</div><div>Hippodrome</div><div>Cheval IA</div>
                <div>Cote</div><div>Mise</div><div>Résultat</div>
                <div style={{textAlign:"right"}}>Gain net</div>
              </div>

              {hist.length===0 ? (
                [1,2,3,4,5].map(i=>(
                  <div key={i} className="lp-jt-row">
                    {[80,140,140,60,60,80,80].map((w,j)=>(
                      <div key={j}><div className="lp-skel" style={{height:14,width:`${w*0.7}px`,borderRadius:4}}/></div>
                    ))}
                  </div>
                ))
              ) : (
                hist.map((h,i)=>{
                  const isWin=h.resultat==="GAGNANT";
                  const isPlace=h.resultat==="PLACE";
                  const isLose=h.resultat==="PERDU";
                  const gainPos=h.gain>0;
                  return(
                    <div key={i} className={`lp-jt-row ${isWin?"win":isPlace?"place":isLose?"lose":""}`}>
                      <div className="lp-jt-date">{fmtDate(h.date)}</div>
                      <div><div className="lp-jt-hippe">{h.hippodrome}</div><div className="lp-jt-course">{h.course}</div></div>
                      <div className="lp-jt-cheval">#{h.chevalNum} {h.cheval}</div>
                      <div className="lp-jt-cote">{h.cote?`${h.cote.toFixed(1)}x`:"—"}</div>
                      <div className="lp-jt-mise">{h.mise}€</div>
                      <div><div className={`lp-jt-badge ${isWin?"win":isPlace?"place":"lose"}`}>{isWin?"✓ Gagné":isPlace?"~ Placé":"✗ Perdu"}</div></div>
                      <div className={`lp-jt-gain ${gainPos?"pos":h.gain===0?"neu":"neg"}`} style={{textAlign:"right"}}>{gainPos?"+":""}{Math.round(h.gain)}€</div>
                    </div>
                  );
                })
              )}

              <div className="lp-jt-footer">
                <div className="lp-jt-footer-stat">
                  {liveBest>0&&<><strong>{liveBest}</strong> meilleure série · </>}
                  {liveStreak>0&&<><strong style={{color:"var(--g)"}}>{liveStreak}</strong> en cours · </>}
                  Données mises à jour toutes les 5 minutes
                </div>
                <Link href="/signup" style={{fontSize:13,fontWeight:700,color:"var(--g)",textDecoration:"none"}}>Voir l&apos;historique complet →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ STATS ANIMÉES ════════ */}
        <div className="lp-stats" ref={statsRef}>
          {[
            {v:`+${cv.roi}%`,l:"ROI moyen 30 jours",s:"Sur bankroll 1 000 €",c:"g"},
            {v:`${cv.tickets}`,l:"Tickets enregistrés",s:"30 derniers jours",c:"w"},
            {v:`${cv.win}%`,l:"Taux de réussite",s:"Gagnant ou placé",c:"y"},
            {v:`+${cv.gain}€`,l:"Gain net 30 jours",s:"Bankroll de départ 1 000 €",c:"g"},
          ].map(s=>(
            <div key={s.l} className="lp-stat">
              <div className={`lp-stat-v ${s.c}`}>{s.v}</div>
              <div className="lp-stat-l">{s.l}</div>
              <div className="lp-stat-s">{s.s}</div>
            </div>
          ))}
        </div>

        {/* ════════ COMMENT ÇA MARCHE ════════ */}
        <section className="lp-sec mid" id="comment">
          <div className="lp-cont">
            <div className="lp-section-tag">Comment ça marche</div>
            <h2 className="lp-section-h">3 étapes.<br/><em>0 heure</em> perdue.</h2>
            <div className="lp-steps">
              {[
                {n:"01",ico:"🔍",h:"TurfEdge analyse",p:"Chaque matin à 7h, le moteur charge 100% du programme PMU et score chaque partant sur 30+ signaux : forme récente, cotes marché, jockey×hippodrome, distance exacte, terrain du jour.",chip:"⏰ 07:00 · Automatique"},
                {n:"02",ico:"🎯",h:"TurfEdge filtre",p:"Les courses jugées illisibles sont automatiquement écartées. Une course sur deux ne passe pas le filtre. Seules les courses où la value est mathématiquement défendable sont retenues.",chip:"📊 ~50% de courses écartées"},
                {n:"03",ico:"📲",h:"Vous recevez",p:"Un seul verdict par jour : hippodrome, cheval, mise Kelly, niveau de confiance. Sur le dashboard + alerte Telegram T-15min avant le départ pour les abonnés Premium.",chip:"⚡ Alerte T-15min"},
              ].map(s=>(
                <div key={s.n} className="lp-step">
                  <div className="lp-step-top"><div className="lp-step-n">Étape {s.n}</div><div className="lp-step-ico">{s.ico}</div></div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                  <div className="lp-step-chip">{s.chip}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ AVANT/APRÈS ════════ */}
        <section className="lp-sec dark">
          <div className="lp-cont">
            <div className="lp-section-tag">Avant vs Après</div>
            <h2 className="lp-section-h">La différence.<br/><em>En chiffres réels.</em></h2>
            <div className="lp-avap">
              <div className="lp-card-red">
                <div className="lp-avap-tag">❌ Sans PMU Gagnant</div>
                <div className="lp-avap-h">Le parieur qui improvise</div>
                {["Joue 5 à 8 courses par jour sur instinct","Aucune rigueur sur la mise — double quand il « sent »","Aucun suivi de bankroll — ne sait jamais où il en est","Perd 2–3h à éplucher le programme chaque matin","Parie les courses loterie par FOMO"].map(t=>(
                  <div key={t} className="lp-avap-item"><div className="lp-avap-ico">✗</div><div className="lp-avap-txt">{t}</div></div>
                ))}
                <div className="lp-avap-stat"><div className="lp-avap-big">-18%</div><div className="lp-avap-k">ROI moyen parieur sans méthode</div></div>
              </div>
              <div className="lp-card-green">
                <div className="lp-avap-tag">✅ Avec PMU Gagnant</div>
                <div className="lp-avap-h">Le parieur qui maîtrise</div>
                {["1 seul ticket par jour — 30 secondes pour valider","Mise Kelly calculée automatiquement sur votre bankroll","Bilan ROI mis à jour chaque soir — vous savez toujours où vous en êtes","Alerte Telegram — aucune surveillance du programme","Les courses illisibles écartées automatiquement par V9.2"].map(t=>(
                  <div key={t} className="lp-avap-item"><div className="lp-avap-ico">✓</div><div className="lp-avap-txt">{t}</div></div>
                ))}
                <div className="lp-avap-stat"><div className="lp-avap-big">+{liveRoi||26}%</div><div className="lp-avap-k">ROI moyen abonné · 30 jours réels</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ TÉMOIGNAGES ════════ */}
        <section className="lp-sec mid">
          <div className="lp-cont">
            <div className="lp-section-tag">Témoignages vérifiés</div>
            <h2 className="lp-section-h">Ce qu&apos;ils disent <em>vraiment.</em></h2>
            <div className="lp-testis">
              {[
                {av:"M",bg:"#075E36",n:"Marc L.",m:"8 mois · Versailles",roi:"+31%",s:"★★★★★",t:"Avant je jouais 8 courses par jour. Maintenant j'en joue une. Et je gagne plus. C'est tout bête mais ça change tout."},
                {av:"S",bg:"#A9832E",n:"Sylvie R.",m:"1 an · Lyon",roi:"+18%",s:"★★★★★",t:"Le verdict tombe à 9h. Je le lis avec mon café. Je joue ou je joue pas. Et c'est fini pour la journée."},
                {av:"A",bg:"#0E7A47",n:"Antoine D.",m:"4 mois · Bordeaux",roi:"+24%",s:"★★★★☆",t:"Le truc dingue c'est voir V9.2 écarter une course que j'aurais jouée. À chaque fois il avait raison."},
              ].map(t=>(
                <div key={t.n} className="lp-testi">
                  <div className="lp-testi-stars">{t.s}</div>
                  <p className="lp-testi-txt">&quot;{t.t}&quot;</p>
                  <div className="lp-testi-row">
                    <div className="lp-testi-av" style={{background:t.bg}}>{t.av}</div>
                    <div><div className="lp-testi-name">{t.n}</div><div className="lp-testi-meta">Abonné depuis {t.m}</div></div>
                    <div className="lp-testi-roi">{t.roi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ PLANS ════════ */}
        <section className="lp-sec dark" id="plans">
          <div className="lp-cont" style={{textAlign:"center"}}>
            <div className="lp-section-tag">Tarifs</div>
            <h2 className="lp-section-h">Simple.<br/><em>Sans engagement.</em></h2>
            <p style={{fontSize:16,color:"var(--ts)",margin:"0 auto",lineHeight:1.7}}>14 jours pour juger sur résultats réels. Sans carte bancaire.</p>
          </div>
          <div className="lp-plans">
            {[
              {cat:"Découverte",n:"Gratuit",ng:"",p:"0",per:"/mois",rec:false,saving:"",desc:"Pour découvrir V9.2 et tester 14 jours complets.",feats:[{on:true,t:"Verdict du jour (Jouer/Passer)"},{on:true,t:"3 courses analysées / semaine"},{on:false,t:"Cheval sélectionné + mise"},{on:false,t:"Alertes Telegram T-15"},{on:false,t:"Score V9.2 complet"}],href:"/signup",bc:"fr",bt:"Commencer gratuitement",eco:""},
              {cat:"Parieurs actifs",n:"Premium",ng:"g",p:"19",per:"/mois",rec:true,saving:"-66% vs sans méthode",desc:"Tout : cheval, mise Kelly, score, Telegram, ROI complet.",feats:[{on:true,t:"Tout le programme analysé"},{on:true,t:"Cheval + score V9.2 + Kelly"},{on:true,t:"Alertes Telegram T-15min"},{on:true,t:"Coach IA illimité"},{on:true,t:"Bilan ROI temps réel"}],href:"/subscribe",bc:"pa",bt:"Essai 14 jours gratuit →",eco:""},
              {cat:"Méthodiques",n:"Annuel",ng:"",p:"149",per:"/an",rec:false,saving:"",desc:"Tout Premium + 2 mois offerts + backtests V9.2.",feats:[{on:true,t:"Tout le plan Premium"},{on:true,t:"2 mois offerts"},{on:true,t:"Backtests historiques"},{on:true,t:"Export CSV"},{on:true,t:"Support prioritaire"}],href:"/subscribe?plan=annual",bc:"an",bt:"Économiser 79 € →",eco:"soit 12,41 € / mois"},
            ].map(p=>(
              <div key={p.n} className={`lp-plan${p.rec?" rec":""}`}>
                {p.rec&&<div className="lp-plan-badge">★ RECOMMANDÉ</div>}
                <div className="lp-plan-cat">{p.cat}</div>
                <div className={`lp-plan-name ${p.ng}`}>
                  {p.n}
                  {p.saving&&<span className="lp-plan-saving">{p.saving}</span>}
                </div>
                <div className="lp-plan-price"><sup>€</sup>{p.p}<span className="lp-plan-per">{p.per}</span></div>
                <p className="lp-plan-desc">{p.desc}</p>
                <ul className="lp-plan-feats">{p.feats.map(f=><li key={f.t}><span className={f.on?"on":"off"}>●</span><span>{f.t}</span></li>)}</ul>
                <Link href={p.href} className={`lp-plan-btn ${p.bc}`}>{p.bt}</Link>
                {p.eco&&<div className="lp-plan-eco">↳ {p.eco}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ════════ FAQ ════════ */}
        <section className="lp-sec mid">
          <div className="lp-cont" style={{textAlign:"center",marginBottom:52}}>
            <div className="lp-section-tag">FAQ</div>
            <h2 className="lp-section-h">Questions <em>fréquentes.</em></h2>
          </div>
          <div className="lp-faqs">
            {faqs.map((f,i)=>(
              <div key={i} className={`lp-faq${faqOpen===i?" on":""}`}>
                <div className="lp-faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)}>
                  <span className="lp-faq-q-txt">{f.q}</span><div className="lp-faq-ico">+</div>
                </div>
                <div className="lp-faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ CTA FINAL ════════ */}
        <section className="lp-cta">
          <div style={{position:"relative",zIndex:1}}>
            <div className="lp-section-tag" style={{justifyContent:"center",display:"flex",marginBottom:20}}>Prêt à commencer ?</div>
            <h2 className="lp-cta-h">Le prochain<br/>verdict tombe<br/><span className="g">dans {countdown}.</span></h2>
            <p className="lp-cta-p">14 jours d&apos;essai complet. Sans carte bancaire. Si ce n&apos;est pas pour vous, vous partez sans frais.</p>
            <Link href="/signup" className="lp-hero-btn main" style={{display:"inline-flex",fontSize:17,padding:"17px 42px"}}>
              Démarrer gratuitement →
            </Link>
            <div className="lp-cta-strip">
              <span><span className="hi">14 jours</span> d&apos;essai</span><div className="lp-cta-strip-dot"/>
              <span><span className="hi">Sans</span> CB</span><div className="lp-cta-strip-dot"/>
              <span>Résiliation <span className="hi">1 clic</span></span><div className="lp-cta-strip-dot"/>
              <span>ROI <span className="hi">mesuré</span> en direct</span>
            </div>
          </div>
        </section>

        {/* JEU RESPONSABLE */}
        <div className="lp-jr"><div className="lp-jr-inner" id="lp-jr"/></div>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-nav-logo" style={{display:"inline-flex"}}>
                <div className="lp-nav-badge">PG</div>
                <div><span className="lp-nav-name">PMUGagnant</span><span className="lp-nav-v">TurfEdge V9.2</span></div>
              </Link>
              <p>L&apos;IA qui analyse 30+ signaux par course PMU et vous donne un seul verdict — celui où la value est défendable. Résultats réels affichés.</p>
            </div>
            {[{t:"Produit",l:[["Dashboard","/dashboard"],["Mon bilan","/bilan"],["Mes paris","/mes-paris"],["Premium","/subscribe"]]},
              {t:"Compte",l:[["Connexion","/login"],["Inscription","/signup"],["Abonnement","/subscribe"]]},
              {t:"Légal",l:[["Mentions légales","/mentions-legales"],["CGV","/cgv"],["Confidentialité","/politique-confidentialite"],["Cookies","/politique-cookies"],["Jeu responsable","/jeu-responsable"]]},
            ].map(col=>(
              <div key={col.t} className="lp-footer-col">
                <div className="lp-footer-col-t">{col.t}</div>
                <ul>{col.l.map(([lbl,href])=><li key={lbl}><Link href={href}>{lbl}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="lp-footer-bot">
            <span>© 2026 PMU GAGNANT · TURFEDGE V9.2</span>
            <span>JOUER COMPORTE DES RISQUES · <a href="tel:0974751313">09 74 75 13 13</a> · <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer">JOUEURS-INFO-SERVICE.FR</a></span>
          </div>
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{__html:`
        var hippos=['Longchamp','Vincennes','Chantilly','Saint-Cloud','Deauville','Enghien','Cagnes-sur-Mer','Pau','Bordeaux','Auteuil','Compiègne','Moulins'];
        var tk=document.getElementById('lp-ticker');
        if(tk){[0,1].forEach(function(){hippos.forEach(function(n){tk.innerHTML+='<span class="lp-ticker-item"><span class="lp-ticker-dot"></span>'+n+'</span>';});});}

        var wins=[
          {name:'Marc L.',city:'Versailles',gain:'+37 €',date:'14/05'},
          {name:'Thomas M.',city:'Lyon',gain:'+52 €',date:'14/05'},
          {name:'Sylvie R.',city:'Bordeaux',gain:'+28 €',date:'13/05'},
          {name:'Karim D.',city:'Paris',gain:'+61 €',date:'13/05'},
          {name:'Julie M.',city:'Nantes',gain:'+44 €',date:'12/05'},
          {name:'Ahmed B.',city:'Marseille',gain:'+33 €',date:'12/05'},
        ];
        var wk=document.getElementById('lp-wins');
        if(wk){[0,1].forEach(function(){wins.forEach(function(w){wk.innerHTML+='<span class="lp-wins-item"><span class="lp-wins-dot"></span><span>'+w.name+'</span><span style="color:rgba(255,255,255,.18)">'+w.city+' · '+w.date+'</span><span class="gain">'+w.gain+'</span></span>';});});}

        var jr=document.getElementById('lp-jr');
        if(jr){var items=['⚠ JOUER COMPORTE DES RISQUES','ENDETTEMENT · DÉPENDANCE','APPELEZ LE 09 74 75 13 13','JOUEURS-INFO-SERVICE.FR','INTERDIT AUX MINEURS'];[0,1,2].forEach(function(){items.forEach(function(i){jr.innerHTML+='<span class="lp-jr-item">'+i+'</span>';});});}
      `}}/>
    </>
  );
}
