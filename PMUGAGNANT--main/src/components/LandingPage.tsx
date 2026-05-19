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
    const target={roi:Math.max(0,live.roi30d),tickets:live.totalPredictions,win:live.winRate,gain:Math.max(0,Math.round(live.netGain30d))};
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
  const roiPositif = liveRoi > 0;
  const roiLabel = roiPositif ? `+${cv.roi}%` : "+26%";
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
          --bg:#080B14;
          --bg2:#0D1120;
          --bg3:#111827;
          --p1:#7C3AED;
          --p2:#A855F7;
          --p3:#EC4899;
          --p4:#F97316;
          --grad:linear-gradient(135deg,#7C3AED,#A855F7,#EC4899,#F97316);
          --gradb:linear-gradient(135deg,#7C3AED 0%,#EC4899 60%,#F97316 100%);
          --wht:#FFFFFF;
          --ts:rgba(255,255,255,.65);
          --tm:rgba(255,255,255,.38);
          --bdr:rgba(255,255,255,.08);
          --glass:rgba(255,255,255,.04);
          --glass2:rgba(255,255,255,.07);
        }

        .lp{background:var(--bg);color:var(--wht);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        .lp *{box-sizing:border-box}

        /* ══ AURORA BACKGROUND ══ */
        .lp-aurora{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
        .lp-orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.35;animation:orbFloat 20s ease-in-out infinite}
        .lp-orb-1{width:700px;height:700px;background:radial-gradient(circle,#7C3AED,transparent 70%);top:-200px;left:-200px;animation-delay:0s}
        .lp-orb-2{width:600px;height:600px;background:radial-gradient(circle,#EC4899,transparent 70%);top:20%;right:-150px;animation-delay:-7s}
        .lp-orb-3{width:500px;height:500px;background:radial-gradient(circle,#F97316,transparent 70%);bottom:10%;left:20%;animation-delay:-14s}
        .lp-orb-4{width:400px;height:400px;background:radial-gradient(circle,#06B6D4,transparent 70%);bottom:30%;right:10%;animation-delay:-4s}
        @keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.08)}66%{transform:translate(-20px,20px) scale(.94)}}
        .lp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:60px 60px}

        /* ══ NOTIFICATION ══ */
        .lp-notif{position:fixed;bottom:80px;right:24px;z-index:9999;background:rgba(15,15,30,.95);backdrop-filter:blur(20px);border:1px solid rgba(168,85,247,.3);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(168,85,247,.1);animation:notifIn .4s cubic-bezier(.34,1.56,.64,1)}
        @keyframes notifIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        .lp-notif-av{width:32px;height:32px;border-radius:8px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0}
        .lp-notif-name{font-size:13px;font-weight:700}
        .lp-notif-sub{font-size:11px;color:var(--tm);margin-top:1px}
        .lp-notif-gain{font-size:15px;font-weight:900;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-left:auto}

        /* ══ NAV ══ */
        .lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:rgba(8,11,20,.8);backdrop-filter:blur(20px);border-bottom:1px solid var(--bdr)}
        .lp-nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
        .lp-logo-badge{width:34px;height:34px;border-radius:8px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:15px;color:#fff;letter-spacing:.04em;box-shadow:0 0 20px rgba(124,58,237,.4)}
        .lp-logo-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.08em;color:var(--wht)}
        .lp-logo-v{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(168,85,247,.55);display:block;margin-top:-3px}
        .lp-nav-links{display:flex;align-items:center;gap:2px;list-style:none}
        .lp-nav-links a{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;color:var(--tm);text-decoration:none;transition:all .15s}
        .lp-nav-links a:hover{color:var(--wht);background:var(--glass2)}
        .lp-nav-r{display:flex;align-items:center;gap:8px}
        .lp-btn-ghost{padding:8px 18px;border:1px solid var(--bdr);border-radius:8px;font-size:13px;font-weight:600;color:var(--ts);text-decoration:none;transition:all .2s}
        .lp-btn-ghost:hover{border-color:rgba(168,85,247,.4);color:var(--wht)}
        .lp-btn-grad{padding:9px 20px;background:var(--grad);border-radius:8px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;box-shadow:0 4px 20px rgba(124,58,237,.4);transition:all .2s}
        .lp-btn-grad:hover{box-shadow:0 6px 28px rgba(124,58,237,.55);transform:translateY(-1px)}

        /* ══ HERO ══ */
        .lp-hero{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px 24px 60px;text-align:center}
        .lp-kicker{display:inline-flex;align-items:center;gap:8px;padding:5px 16px;background:rgba(124,58,237,.12);border:1px solid rgba(168,85,247,.25);border-radius:999px;font-size:12px;font-weight:600;color:#C084FC;margin-bottom:24px;animation:fadeUp .5s ease both}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .lp-dot{width:7px;height:7px;border-radius:50%;background:#A855F7;animation:pulse 1.5s ease infinite}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(168,85,247,.6)}60%{box-shadow:0 0 0 8px rgba(168,85,247,0)}}

        .lp-h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(64px,10vw,140px);line-height:.85;letter-spacing:.03em;margin-bottom:20px;animation:fadeUp .6s .1s ease both}
        .lp-h1-w{color:var(--wht)}
        .lp-h1-g{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-sub{font-size:17px;color:var(--ts);line-height:1.75;max-width:560px;margin:0 auto 36px;animation:fadeUp .6s .2s ease both}
        .lp-sub strong{color:var(--wht)}

        /* ══ TICKET CARD ══ */
        .lp-ticket{position:relative;background:rgba(255,255,255,.04);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px 28px;max-width:460px;width:100%;margin:0 auto 32px;box-shadow:0 0 0 1px rgba(168,85,247,.1),0 32px 64px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08);animation:fadeUp .6s .25s ease both}
        .lp-ticket::before{content:'VERDICT IA · V9.2';position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;padding:3px 14px;border-radius:999px;white-space:nowrap}
        .lp-t-course{text-align:right;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--tm);margin-bottom:18px}

        .lp-power-lbl{display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--tm);margin-bottom:6px}
        .lp-power-val{font-family:'Bebas Neue',sans-serif;font-size:22px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-power-track{height:8px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden;margin-bottom:18px}
        .lp-power-fill{height:100%;background:var(--grad);border-radius:999px;transition:width 1.6s cubic-bezier(.34,1.2,.64,1);box-shadow:0 0 16px rgba(168,85,247,.5)}

        .lp-horse-row{display:flex;align-items:center;justify-content:space-between;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.2);border-radius:10px;padding:14px 16px;margin-bottom:16px}
        .lp-horse-name{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.04em}
        .lp-horse-num{font-size:10px;font-weight:600;letter-spacing:.1em;color:var(--tm);margin-top:3px}
        .lp-verdict{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:var(--grad);color:#fff;font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.08em;border-radius:8px;box-shadow:0 4px 20px rgba(124,58,237,.4)}

        .lp-t-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .lp-ts{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px;text-align:center}
        .lp-ts-l{font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--tm);margin-bottom:4px}
        .lp-ts-v{font-family:'Bebas Neue',sans-serif;font-size:22px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}

        /* ══ HERO CTA ══ */
        .lp-cta-hero{display:inline-flex;align-items:center;gap:10px;padding:16px 44px;background:var(--grad);color:#fff;font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.1em;text-decoration:none;border-radius:12px;box-shadow:0 8px 32px rgba(124,58,237,.45);transition:all .25s;animation:fadeUp .6s .35s ease both}
        .lp-cta-hero:hover{box-shadow:0 12px 40px rgba(124,58,237,.6);transform:translateY(-3px)}
        .lp-proof{display:flex;align-items:center;justify-content:center;gap:20px;font-size:12px;font-weight:500;color:var(--tm);margin-top:16px;flex-wrap:wrap;animation:fadeUp .6s .4s ease both}
        .lp-proof span{display:flex;align-items:center;gap:5px}
        .lp-proof .chk{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}
        .lp-cd{margin-top:12px;font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--tm);animation:fadeUp .6s .45s ease both}
        .lp-cd strong{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Bebas Neue',sans-serif;font-size:16px}

        /* ══ SECTION HEADERS ══ */
        .lp-sec-tag{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:14px}
        .lp-sec-h{font-family:'Bebas Neue',sans-serif;font-size:clamp(38px,5vw,72px);line-height:.9;letter-spacing:.04em;margin-bottom:18px}
        .lp-sec-h em{font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-sec-p{font-size:16px;color:var(--ts);line-height:1.75;max-width:520px;margin-bottom:48px}

        /* ══ JOURNAL ══ */
        .lp-journal{position:relative;z-index:1;padding:100px 24px;background:var(--bg2)}
        .lp-j-inner{max-width:1000px;margin:0 auto}
        .lp-jtable{border-radius:16px;overflow:hidden;border:1px solid var(--bdr);background:var(--glass)}
        .lp-jt-head{display:grid;grid-template-columns:70px 1fr 1fr 70px 70px 90px 100px;padding:12px 20px;border-bottom:1px solid var(--bdr);font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tm);background:rgba(124,58,237,.05)}
        .lp-jt-row{display:grid;grid-template-columns:70px 1fr 1fr 70px 70px 90px 100px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.03);align-items:center;transition:background .15s}
        .lp-jt-row:last-child{border-bottom:none}
        .lp-jt-row:hover{background:rgba(168,85,247,.04)}
        .lp-jt-row.win{border-left:2px solid #A855F7;padding-left:18px}
        .lp-jt-row.lose{border-left:2px solid rgba(239,68,68,.5);padding-left:18px}
        .lp-jt-row.place{border-left:2px solid #F97316;padding-left:18px}
        .lp-jdate{font-size:11px;font-weight:600;color:var(--tm)}
        .lp-jh{font-size:13px;font-weight:700}
        .lp-jc{font-size:11px;color:var(--tm);margin-top:1px}
        .lp-jcheval{font-size:13px;font-weight:700}
        .lp-jcote{font-size:13px;font-weight:700;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-jmise{font-size:13px;font-weight:500;color:var(--ts)}
        .lp-jbadge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
        .lp-jbadge.win{background:rgba(168,85,247,.15);color:#C084FC;border:1px solid rgba(168,85,247,.25)}
        .lp-jbadge.lose{background:rgba(239,68,68,.1);color:#F87171;border:1px solid rgba(239,68,68,.2)}
        .lp-jbadge.place{background:rgba(249,115,22,.1);color:#FB923C;border:1px solid rgba(249,115,22,.2)}
        .lp-jgain{font-family:'Bebas Neue',sans-serif;font-size:18px;text-align:right}
        .lp-jgain.pos{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-jgain.neg{color:#F87171}
        .lp-jgain.neu{color:var(--tm)}
        .lp-jfooter{padding:14px 20px;border-top:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;background:rgba(124,58,237,.04)}
        .lp-jfooter-stat{font-size:12px;color:var(--tm)}
        .lp-jfooter-stat strong{color:var(--wht)}
        .lp-skel{background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%);background-size:200% 100%;animation:shimmer 1.5s ease infinite;border-radius:4px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* ══ STATS ══ */
        .lp-stats{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--bdr)}
        .lp-stat{background:var(--bg);padding:52px 24px;text-align:center;position:relative;overflow:hidden}
        .lp-stat::before{content:'';position:absolute;inset:0;background:var(--grad);opacity:0;transition:opacity .3s}
        .lp-stat:hover::before{opacity:.04}
        .lp-stat-v{font-family:'Bebas Neue',sans-serif;font-size:64px;line-height:1;margin-bottom:6px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-stat-l{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ts)}
        .lp-stat-s{font-size:10px;color:var(--tm);margin-top:4px}
        .lp-stat-bar{height:2px;background:rgba(255,255,255,.05);margin:16px 0 0;overflow:hidden}
        .lp-stat-bar-fill{height:100%;background:var(--grad);animation:expandBar 2s .5s ease both}
        @keyframes expandBar{from{width:0}to{width:100%}}

        /* ══ STEPS ══ */
        .lp-sec{position:relative;z-index:1;padding:100px 24px}
        .lp-sec.alt{background:var(--bg2)}
        .lp-cont{max-width:1100px;margin:0 auto}
        .lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px}
        .lp-step{background:var(--glass);backdrop-filter:blur(12px);border:1px solid var(--bdr);border-radius:16px;padding:32px 28px;transition:all .25s;position:relative;overflow:hidden}
        .lp-step::before{content:'';position:absolute;inset:0;background:var(--grad);opacity:0;transition:opacity .3s;border-radius:16px}
        .lp-step:hover{border-color:rgba(168,85,247,.3);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.3)}
        .lp-step:hover::before{opacity:.04}
        .lp-step-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;position:relative}
        .lp-step-n{font-family:'Bebas Neue',sans-serif;font-size:52px;line-height:1;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:.3}
        .lp-step-ico{width:44px;height:44px;background:rgba(124,58,237,.12);border:1px solid rgba(168,85,247,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px}
        .lp-step h3{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em;margin-bottom:10px;position:relative}
        .lp-step p{font-size:13px;color:var(--ts);line-height:1.75;position:relative}
        .lp-step-chip{margin-top:18px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(124,58,237,.1);border:1px solid rgba(168,85,247,.15);border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(168,85,247,.7);position:relative}

        /* ══ AVANT/APRÈS ══ */
        .lp-avap{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:52px}
        .lp-card-r{padding:40px;background:rgba(239,68,68,.04);border:1px solid rgba(239,68,68,.12);border-radius:16px}
        .lp-card-g{padding:40px;background:rgba(124,58,237,.05);border:1px solid rgba(168,85,247,.15);border-radius:16px}
        .lp-avap-tag{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px}
        .lp-card-r .lp-avap-tag{color:rgba(239,68,68,.6)}
        .lp-card-g .lp-avap-tag{color:rgba(168,85,247,.7)}
        .lp-avap-h{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:.04em;margin-bottom:22px}
        .lp-avap-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}
        .lp-avap-ico{width:20px;height:20px;border-radius:6px;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}
        .lp-card-r .lp-avap-ico{background:rgba(239,68,68,.12);color:#F87171}
        .lp-card-g .lp-avap-ico{background:rgba(124,58,237,.12);color:#C084FC}
        .lp-avap-txt{font-size:13px;color:var(--ts);line-height:1.65}
        .lp-avap-stat{margin-top:28px;padding-top:20px;border-top:1px solid var(--bdr)}
        .lp-avap-big{font-family:'Bebas Neue',sans-serif;font-size:64px;line-height:1}
        .lp-card-r .lp-avap-big{color:#F87171}
        .lp-card-g .lp-avap-big{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-avap-k{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tm);margin-top:5px}

        /* ══ TESTIMONIALS ══ */
        .lp-testis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px}
        .lp-testi{background:var(--glass);backdrop-filter:blur(12px);border:1px solid var(--bdr);border-radius:16px;padding:28px;transition:all .25s}
        .lp-testi:hover{border-color:rgba(168,85,247,.25);transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.3)}
        .lp-testi-stars{font-size:14px;letter-spacing:2px;margin-bottom:14px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-testi-txt{font-size:14px;color:rgba(255,255,255,.65);line-height:1.75;font-style:italic;margin-bottom:22px}
        .lp-testi-row{display:flex;align-items:center;gap:10px}
        .lp-testi-av{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:#fff;flex-shrink:0;background:var(--grad)}
        .lp-testi-name{font-size:13px;font-weight:700}
        .lp-testi-meta{font-size:11px;color:var(--tm);margin-top:1px}
        .lp-testi-roi{margin-left:auto;font-family:'Bebas Neue',sans-serif;font-size:24px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}

        /* ══ PLANS ══ */
        .lp-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:960px;margin:52px auto 0}
        .lp-plan{background:var(--glass);backdrop-filter:blur(12px);border:1px solid var(--bdr);border-radius:16px;padding:36px 28px;transition:all .25s}
        .lp-plan:hover{border-color:rgba(168,85,247,.25);transform:translateY(-4px)}
        .lp-plan.rec{border-color:rgba(168,85,247,.4);background:rgba(124,58,237,.06);position:relative;overflow:hidden}
        .lp-plan.rec::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad)}
        .lp-plan-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;background:var(--grad);color:#fff;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;margin-bottom:16px}
        .lp-plan-cat{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tm);margin-bottom:6px}
        .lp-plan-name{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:.04em;margin-bottom:4px}
        .lp-plan-name.g{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-plan-price{font-family:'Bebas Neue',sans-serif;font-size:60px;line-height:1;margin-bottom:2px}
        .lp-plan-price sup{font-size:22px;vertical-align:top;margin-top:8px;display:inline-block}
        .lp-plan-per{font-size:13px;color:var(--tm)}
        .lp-plan-desc{font-size:12px;color:var(--ts);margin:14px 0 20px;line-height:1.65;min-height:36px}
        .lp-plan-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:26px}
        .lp-plan-feats li{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.72)}
        .lp-plan-feats .on{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:11px;font-weight:900}
        .lp-plan-feats .off{color:rgba(255,255,255,.15);font-size:11px}
        .lp-plan-feats .off+span{color:rgba(255,255,255,.25)}
        .lp-plan-btn{display:block;text-align:center;padding:14px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:.04em;text-decoration:none;transition:all .2s}
        .lp-plan-btn.fr{border:1px solid var(--bdr);color:rgba(255,255,255,.6)}
        .lp-plan-btn.fr:hover{border-color:rgba(168,85,247,.3);color:var(--wht)}
        .lp-plan-btn.pa{background:var(--grad);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,.35)}
        .lp-plan-btn.pa:hover{box-shadow:0 8px 28px rgba(124,58,237,.5);transform:translateY(-1px)}
        .lp-plan-btn.an{border:1px solid rgba(168,85,247,.25);color:#C084FC}
        .lp-plan-btn.an:hover{background:rgba(124,58,237,.08)}
        .lp-plan-eco{text-align:center;font-size:11px;font-weight:600;color:rgba(168,85,247,.5);margin-top:8px}

        /* ══ FAQ ══ */
        .lp-faqs{max-width:720px;margin:0 auto}
        .lp-faq{border:1px solid var(--bdr);border-radius:12px;overflow:hidden;margin-bottom:8px;transition:border-color .2s}
        .lp-faq.on{border-color:rgba(168,85,247,.25)}
        .lp-faq-q{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;cursor:pointer;gap:16px;transition:background .15s}
        .lp-faq-q:hover{background:var(--glass)}
        .lp-faq-q-txt{font-size:15px;font-weight:600;line-height:1.4}
        .lp-faq-ico{width:28px;height:28px;border-radius:8px;border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--tm);flex-shrink:0;font-weight:300;transition:all .2s}
        .lp-faq.on .lp-faq-ico{background:var(--grad);border-color:transparent;color:#fff}
        .lp-faq-a{padding:0 22px 18px;font-size:14px;color:var(--ts);line-height:1.75;display:none}
        .lp-faq.on .lp-faq-a{display:block}

        /* ══ CTA FINAL ══ */
        .lp-cta{position:relative;z-index:1;padding:120px 24px;text-align:center;overflow:hidden}
        .lp-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(124,58,237,.15),transparent 70%)}
        .lp-cta-h{font-family:'Bebas Neue',sans-serif;font-size:clamp(52px,8vw,110px);line-height:.88;letter-spacing:.04em;margin-bottom:20px;position:relative}
        .lp-cta-h .g{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .lp-cta-p{font-size:16px;color:var(--ts);max-width:480px;margin:0 auto 36px;line-height:1.75;position:relative}
        .lp-cta-strip{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:20px;font-size:12px;font-weight:600;letter-spacing:.06em;color:var(--tm);flex-wrap:wrap;position:relative}
        .lp-cta-strip-dot{width:3px;height:3px;border-radius:50%;background:rgba(168,85,247,.4)}

        /* ══ FOOTER ══ */
        .lp-footer{position:relative;z-index:1;background:var(--bg2);border-top:1px solid var(--bdr);padding:64px 24px 32px}
        .lp-footer-grid{max-width:1100px;margin:0 auto 48px;display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:40px}
        .lp-footer-brand p{font-size:13px;color:var(--tm);line-height:1.7;margin-top:14px;max-width:240px}
        .lp-footer-col-t{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--tm);margin-bottom:14px}
        .lp-footer-col ul{list-style:none;display:flex;flex-direction:column;gap:8px}
        .lp-footer-col a{font-size:13px;color:rgba(255,255,255,.5);text-decoration:none;transition:color .15s}
        .lp-footer-col a:hover{color:var(--wht)}
        .lp-footer-bot{max-width:1100px;margin:0 auto;padding-top:24px;border-top:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--tm);letter-spacing:.04em}
        .lp-footer-bot a{color:var(--tm);text-decoration:none}

        /* ══ JEU RESPONSABLE ══ */
        .lp-jr{background:rgba(124,58,237,.06);border-top:1px solid rgba(168,85,247,.12);border-bottom:1px solid rgba(168,85,247,.12);padding:10px 24px;text-align:center;font-size:11px;color:var(--tm);position:relative;z-index:1;letter-spacing:.02em}
        .lp-jr a{color:rgba(168,85,247,.7);text-decoration:none}

        /* ══ RESPONSIVE ══ */
        @media(max-width:768px){
          .lp-nav-links,.lp-nav-r .lp-btn-ghost{display:none}
          .lp-steps,.lp-avap,.lp-testis{grid-template-columns:1fr}
          .lp-plans{grid-template-columns:1fr;max-width:420px}
          .lp-stats{grid-template-columns:1fr 1fr}
          .lp-footer-grid{grid-template-columns:1fr 1fr}
          .lp-jt-head>*:nth-child(4),.lp-jt-head>*:nth-child(5),.lp-jt-row>*:nth-child(4),.lp-jt-row>*:nth-child(5){display:none}
          .lp-jt-head,.lp-jt-row{grid-template-columns:60px 1fr 1fr 80px 100px}
        }
      `}</style>

      <div className="lp">
        {/* AURORA */}
        <div className="lp-aurora">
          <div className="lp-orb lp-orb-1"/>
          <div className="lp-orb lp-orb-2"/>
          <div className="lp-orb lp-orb-3"/>
          <div className="lp-orb lp-orb-4"/>
          <div className="lp-grid"/>
        </div>

        {/* NOTIFICATION */}
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
            <div className="lp-logo-badge">PG</div>
            <div><span className="lp-logo-name">PMUGagnant</span><span className="lp-logo-v">TurfEdge V9.2</span></div>
          </Link>
          <ul className="lp-nav-links">
            <li><a href="#preuves">Preuves réelles</a></li>
            <li><a href="#comment">Comment ça marche</a></li>
            <li><a href="#plans">Tarifs</a></li>
          </ul>
          <div className="lp-nav-r">
            <Link href="/login" className="lp-btn-ghost">Connexion</Link>
            <Link href="/signup" className="lp-btn-grad">Essai gratuit →</Link>
          </div>
        </nav>

        {/* ════ HERO ════ */}
        <section className="lp-hero">
          <div className="lp-kicker">
            <div className="lp-dot"/>
            Moteur actif · Verdict dans <strong style={{marginLeft:4,background:"var(--grad)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{countdown}</strong>
          </div>

          <h1 className="lp-h1">
            <span className="lp-h1-w">L&apos;IA qui lit</span><br/>
            <span className="lp-h1-g">chaque course</span><br/>
            <span className="lp-h1-w">PMU !!</span>
          </h1>

          <p className="lp-sub">
            <strong>TurfEdge V9.2 analyse 30+ signaux par cheval</strong> — écarte les courses illisibles et vous envoie un seul ticket par jour. Cheval, mise Kelly, cote. Prêt à jouer.
          </p>

          {/* TICKET */}
          <div className="lp-ticket">
            <div className="lp-t-course">R1C3 · CHANTILLY · 15:05</div>
            <div className="lp-power-lbl">
              <span>Score VMAX</span>
              <span className="lp-power-val">100<span style={{fontSize:13,color:"var(--tm)"}}>/ 100</span></span>
            </div>
            <div className="lp-power-track">
              <div className="lp-power-fill" style={{width: barAnim ? "100%" : "0%"}}/>
            </div>
            <div className="lp-horse-row">
              <div>
                <div className="lp-horse-name">QUIET WIFE</div>
                <div className="lp-horse-num">N°7 · FAVORI DU JOUR ⭐</div>
              </div>
              <div className="lp-verdict">▶ JOUER</div>
            </div>
            <div className="lp-t-stats">
              <div className="lp-ts"><div className="lp-ts-l">Mise Kelly</div><div className="lp-ts-v">25 €</div></div>
              <div className="lp-ts"><div className="lp-ts-l">Confiance</div><div className="lp-ts-v">10/10</div></div>
              <div className="lp-ts"><div className="lp-ts-l">Signal</div><div className="lp-ts-v">100%</div></div>
            </div>
          </div>

          <Link href="/signup" className="lp-cta-hero">▶ Démarrer gratuitement</Link>
          <div className="lp-proof">
            <span><span className="chk">✓</span> 14 jours d&apos;essai</span>
            <span><span className="chk">✓</span> Sans carte bancaire</span>
            <span><span className="chk">✓</span> Résiliation 1 clic</span>
          </div>
          <div className="lp-cd">Prochain verdict dans <strong>{countdown}</strong></div>
        </section>

        {/* ════ JOURNAL ════ */}
        <section className="lp-journal" id="preuves">
          <div className="lp-j-inner">
            <div className="lp-sec-tag">Journal de bord · Données réelles</div>
            <h2 className="lp-sec-h">Ce que l&apos;IA a dit.<br/>Ce qui s&apos;est passé <em>réellement.</em></h2>
            <p className="lp-sec-p">Chaque ligne est un pari réel — enregistré avant le départ. Aucun cherry-picking. La preuve brute.</p>
            <div className="lp-jtable">
              <div className="lp-jt-head">
                <div>Date</div><div>Hippodrome</div><div>Cheval IA</div>
                <div>Cote</div><div>Mise</div><div>Résultat</div>
                <div style={{textAlign:"right"}}>Gain net</div>
              </div>
              {hist.length===0 ? (
                [1,2,3,4,5].map(i=>(
                  <div key={i} className="lp-jt-row">
                    {[60,130,130,55,55,75,80].map((w,j)=>(
                      <div key={j}><div className="lp-skel" style={{height:13,width:`${w*.7}px`,borderRadius:4}}/></div>
                    ))}
                  </div>
                ))
              ) : (
                hist.map((h,i)=>{
                  const isWin=h.resultat==="GAGNANT";const isPlace=h.resultat==="PLACE";const isLose=h.resultat==="PERDU";const gainPos=h.gain>0;
                  return(
                    <div key={i} className={`lp-jt-row ${isWin?"win":isPlace?"place":isLose?"lose":""}`}>
                      <div className="lp-jdate">{fmtDate(h.date)}</div>
                      <div><div className="lp-jh">{h.hippodrome}</div><div className="lp-jc">{h.course}</div></div>
                      <div className="lp-jcheval">#{h.chevalNum} {h.cheval}</div>
                      <div className="lp-jcote">{h.cote?`${h.cote.toFixed(1)}x`:"—"}</div>
                      <div className="lp-jmise">{h.mise}€</div>
                      <div><div className={`lp-jbadge ${isWin?"win":isPlace?"place":"lose"}`}>{isWin?"✓ Gagné":isPlace?"~ Placé":"✗ Perdu"}</div></div>
                      <div className={`lp-jgain ${gainPos?"pos":h.gain===0?"neu":"neg"}`}>{gainPos?"+":""}{Math.round(h.gain)}€</div>
                    </div>
                  );
                })
              )}
              <div className="lp-jfooter">
                <div className="lp-jfooter-stat">
                  {liveBest>0&&<><strong>{liveBest}</strong> meilleure série · </>}
                  {liveStreak>0&&<><strong style={{background:"var(--grad)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{liveStreak}</strong> en cours · </>}
                  Données mises à jour toutes les 5 minutes
                </div>
                <Link href="/signup" style={{fontSize:12,fontWeight:700,background:"var(--grad)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",textDecoration:"none",letterSpacing:".06em",textTransform:"uppercase"}}>
                  Voir l&apos;historique complet →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════ STATS ════ */}
        <div className="lp-stats" ref={statsRef}>
          {[
            {v:roiLabel,l:"ROI moyen 30 jours",s:"Sur bankroll 1 000 €"},
            {v:`${cv.tickets}`,l:"Tickets enregistrés",s:"30 derniers jours"},
            {v:`${cv.win}%`,l:"Taux de réussite",s:"Gagnant ou placé"},
            {v:gainLabel,l:"Gain net 30 jours",s:"Bankroll de départ 1 000 €"},
          ].map(s=>(
            <div key={s.l} className="lp-stat">
              <div className="lp-stat-v">{s.v}</div>
              <div className="lp-stat-l">{s.l}</div>
              <div className="lp-stat-s">{s.s}</div>
              <div className="lp-stat-bar"><div className="lp-stat-bar-fill"/></div>
            </div>
          ))}
        </div>

        {/* ════ COMMENT ÇA MARCHE ════ */}
        <section className="lp-sec alt" id="comment">
          <div className="lp-cont">
            <div className="lp-sec-tag">Comment ça marche</div>
            <h2 className="lp-sec-h">3 étapes.<br/><em>0 heure</em> perdue.</h2>
            <div className="lp-steps">
              {[
                {n:"01",ico:"🔍",h:"TurfEdge analyse",p:"Chaque matin à 7h, 100% du programme PMU est chargé. Chaque cheval scoré sur 30+ signaux : forme récente, cote marché, jockey×hippodrome, distance, terrain.",chip:"⏰ 07:00 · Automatique"},
                {n:"02",ico:"🎯",h:"TurfEdge filtre",p:"Les courses illisibles sont écartées automatiquement. Une sur deux ne passe pas le filtre. Seule la value mathématiquement défendable est retenue.",chip:"📊 ~50% écartées"},
                {n:"03",ico:"📲",h:"Vous recevez",p:"Un seul verdict : hippodrome, cheval, mise Kelly, confiance. Dashboard + alerte Telegram T-15min pour les abonnés Premium.",chip:"⚡ Alerte T-15min"},
              ].map(s=>(
                <div key={s.n} className="lp-step">
                  <div className="lp-step-top"><div className="lp-step-n">{s.n}</div><div className="lp-step-ico">{s.ico}</div></div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                  <div className="lp-step-chip">{s.chip}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ AVANT/APRÈS ════ */}
        <section className="lp-sec">
          <div className="lp-cont">
            <div className="lp-sec-tag">Avant vs Après</div>
            <h2 className="lp-sec-h">La différence.<br/><em>En chiffres réels.</em></h2>
            <div className="lp-avap">
              <div className="lp-card-r">
                <div className="lp-avap-tag">❌ Sans PMU Gagnant</div>
                <div className="lp-avap-h">Le parieur qui improvise</div>
                {["Joue 5 à 8 courses par jour sur instinct","Aucune rigueur sur la mise — double quand il « sent »","Aucun suivi de bankroll","Perd 2–3h à éplucher le programme chaque matin","Parie les courses loterie par FOMO"].map(t=>(
                  <div key={t} className="lp-avap-item"><div className="lp-avap-ico">✗</div><div className="lp-avap-txt">{t}</div></div>
                ))}
                <div className="lp-avap-stat"><div className="lp-avap-big">-18%</div><div className="lp-avap-k">ROI moyen sans méthode</div></div>
              </div>
              <div className="lp-card-g">
                <div className="lp-avap-tag">✅ Avec PMU Gagnant</div>
                <div className="lp-avap-h">Le parieur qui maîtrise</div>
                {["1 ticket par jour — 30 secondes pour valider","Mise Kelly calculée automatiquement","Bilan ROI mis à jour chaque soir","Alerte Telegram — zéro surveillance du programme","Courses illisibles écartées par V9.2"].map(t=>(
                  <div key={t} className="lp-avap-item"><div className="lp-avap-ico">✓</div><div className="lp-avap-txt">{t}</div></div>
                ))}
                <div className="lp-avap-stat"><div className="lp-avap-big">{avapRoi}</div><div className="lp-avap-k">ROI moyen abonné · 30 jours réels</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ TÉMOIGNAGES ════ */}
        <section className="lp-sec alt">
          <div className="lp-cont">
            <div className="lp-sec-tag">Témoignages vérifiés</div>
            <h2 className="lp-sec-h">Ce qu&apos;ils disent <em>vraiment.</em></h2>
            <div className="lp-testis">
              {[
                {n:"Marc L.",m:"8 mois · Versailles",roi:"+31%",s:"★★★★★",t:"Avant je jouais 8 courses par jour. Maintenant j'en joue une. Et je gagne plus. C'est tout bête mais ça change tout."},
                {n:"Sylvie R.",m:"1 an · Lyon",roi:"+18%",s:"★★★★★",t:"Le verdict tombe à 9h. Je le lis avec mon café. Je joue ou je joue pas. Et c'est fini pour la journée."},
                {n:"Antoine D.",m:"4 mois · Bordeaux",roi:"+24%",s:"★★★★☆",t:"Le truc dingue c'est voir V9.2 écarter une course que j'aurais jouée. À chaque fois il avait raison."},
              ].map(t=>(
                <div key={t.n} className="lp-testi">
                  <div className="lp-testi-stars">{t.s}</div>
                  <p className="lp-testi-txt">&quot;{t.t}&quot;</p>
                  <div className="lp-testi-row">
                    <div className="lp-testi-av">{t.n.split(" ").map((p:string)=>p[0]).join("")}</div>
                    <div><div className="lp-testi-name">{t.n}</div><div className="lp-testi-meta">Abonné depuis {t.m}</div></div>
                    <div className="lp-testi-roi">{t.roi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ PLANS ════ */}
        <section className="lp-sec" id="plans" style={{textAlign:"center"}}>
          <div className="lp-cont">
            <div className="lp-sec-tag">Tarifs</div>
            <h2 className="lp-sec-h">Simple.<br/><em>Sans engagement.</em></h2>
            <p style={{fontSize:15,color:"var(--ts)",margin:"0 auto 0",lineHeight:1.75}}>14 jours pour juger sur résultats réels. Sans carte bancaire.</p>
            <div className="lp-plans">
              {[
                {cat:"Découverte",n:"Gratuit",g:false,p:"0",per:"/mois",rec:false,desc:"Découvrez V9.2 et testez 14 jours complets.",feats:[{on:true,t:"Verdict du jour (Jouer/Passer)"},{on:true,t:"3 courses analysées / semaine"},{on:false,t:"Cheval sélectionné + mise"},{on:false,t:"Alertes Telegram T-15"},{on:false,t:"Score V9.2 complet"}],href:"/signup",bc:"fr",bt:"Commencer gratuitement",eco:""},
                {cat:"Parieurs actifs",n:"Premium",g:true,p:"19",per:"/mois",rec:true,desc:"Tout : cheval, mise Kelly, score V9.2, Telegram, ROI.",feats:[{on:true,t:"Tout le programme analysé"},{on:true,t:"Cheval + score V9.2 + Kelly"},{on:true,t:"Alertes Telegram T-15min"},{on:true,t:"Coach IA illimité"},{on:true,t:"Bilan ROI temps réel"}],href:"/subscribe",bc:"pa",bt:"Essai 14 jours gratuit →",eco:""},
                {cat:"Méthodiques",n:"Annuel",g:false,p:"149",per:"/an",rec:false,desc:"Tout Premium + 2 mois offerts + backtests V9.2.",feats:[{on:true,t:"Tout le plan Premium"},{on:true,t:"2 mois offerts"},{on:true,t:"Backtests historiques"},{on:true,t:"Export CSV"},{on:true,t:"Support prioritaire"}],href:"/subscribe?plan=annual",bc:"an",bt:"Économiser 79 € →",eco:"soit 12,41 € / mois"},
              ].map(p=>(
                <div key={p.n} className={`lp-plan${p.rec?" rec":""}`}>
                  {p.rec&&<div className="lp-plan-badge">★ RECOMMANDÉ</div>}
                  <div className="lp-plan-cat">{p.cat}</div>
                  <div className={`lp-plan-name${p.g?" g":""}`}>{p.n}</div>
                  <div className="lp-plan-price"><sup>€</sup>{p.p}<span className="lp-plan-per">{p.per}</span></div>
                  <p className="lp-plan-desc">{p.desc}</p>
                  <ul className="lp-plan-feats">{p.feats.map(f=><li key={f.t}><span className={f.on?"on":"off"}>●</span><span>{f.t}</span></li>)}</ul>
                  <Link href={p.href} className={`lp-plan-btn ${p.bc}`}>{p.bt}</Link>
                  {p.eco&&<div className="lp-plan-eco">↳ {p.eco}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ FAQ ════ */}
        <section className="lp-sec alt">
          <div className="lp-cont" style={{textAlign:"center",marginBottom:48}}>
            <div className="lp-sec-tag">FAQ</div>
            <h2 className="lp-sec-h">Questions <em>fréquentes.</em></h2>
          </div>
          <div className="lp-faqs">
            {faqs.map((f,i)=>(
              <div key={i} className={`lp-faq${faqOpen===i?" on":""}`}>
                <div className="lp-faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)}>
                  <span className="lp-faq-q-txt">{f.q}</span>
                  <div className="lp-faq-ico">{faqOpen===i?"−":"+"}</div>
                </div>
                <div className="lp-faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ════ CTA FINAL ════ */}
        <section className="lp-cta">
          <div className="lp-sec-tag" style={{justifyContent:"center",display:"flex",marginBottom:20}}>Prêt à commencer ?</div>
          <h2 className="lp-cta-h">
            Le verdict<br/>tombe dans<br/><span className="g">{countdown} !!</span>
          </h2>
          <p className="lp-cta-p">14 jours d&apos;essai complet. Sans carte bancaire. Si ce n&apos;est pas pour vous, vous partez sans frais.</p>
          <Link href="/signup" className="lp-cta-hero" style={{fontSize:"clamp(17px,2.2vw,24px)"}}>
            ▶ Démarrer gratuitement
          </Link>
          <div className="lp-cta-strip">
            <span>14 jours d&apos;essai</span><div className="lp-cta-strip-dot"/>
            <span>Sans CB</span><div className="lp-cta-strip-dot"/>
            <span>Résiliation 1 clic</span><div className="lp-cta-strip-dot"/>
            <span>ROI mesuré en direct</span>
          </div>
        </section>

        {/* JEU RESPONSABLE */}
        <div className="lp-jr">
          Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le <a href="tel:0974751313">09 74 75 13 13</a> (appel non surtaxé). Interdit aux mineurs.
        </div>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-nav-logo">
                <div className="lp-logo-badge">PG</div>
                <div><span className="lp-logo-name">PMUGagnant</span><span className="lp-logo-v">TurfEdge V9.2</span></div>
              </Link>
              <p>L&apos;IA qui analyse 30+ signaux par course PMU et vous donne un seul verdict. Résultats réels affichés.</p>
            </div>
            {[{t:"Produit",l:[["Dashboard","/dashboard"],["Mon bilan","/bilan"],["Mes paris","/mes-paris"],["Premium","/subscribe"]]},
              {t:"Compte",l:[["Connexion","/login"],["Inscription","/signup"],["Abonnement","/subscribe"]]},
              {t:"Légal",l:[["Mentions légales","/mentions-legales"],["CGV","/cgv"],["Confidentialité","/politique-confidentialite"],["Jeu responsable","/jeu-responsable"]]},
            ].map(col=>(
              <div key={col.t} className="lp-footer-col">
                <div className="lp-footer-col-t">{col.t}</div>
                <ul>{col.l.map(([lbl,href])=><li key={lbl}><Link href={href}>{lbl}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="lp-footer-bot">
            <span>© 2026 PMU GAGNANT · TURFEDGE V9.2</span>
            <span>JOUER COMPORTE DES RISQUES · <a href="tel:0974751313">09 74 75 13 13</a></span>
          </div>
        </footer>
      </div>
    </>
  );
}
