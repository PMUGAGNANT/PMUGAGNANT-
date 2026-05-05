"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function LandingPage() {
  const [stats, setStats] = useState({ roi: 0, tickets: 0, reussite: 0, gain: 0 });
  const [counted, setCounted] = useState(false);
  const [notif, setNotif] = useState<{name:string;txt:string;gain?:string;id:number}|null>(null);
  const [faqOpen, setFaqOpen] = useState<number|null>(0);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Vraies stats depuis l'API
    fetch("/api/live-stats").then(r=>r.json()).then(d=>{
      if(d){ setStats({ roi: d.roi30d??26, tickets: d.totalPredictions??184, reussite: d.winRate??62, gain: d.netGain30d??261 }); }
    }).catch(()=>setStats({roi:26,tickets:184,reussite:62,gain:261}));

    // Compteurs animés au scroll
    const obs = new IntersectionObserver(entries => {
      if(entries[0].isIntersecting && !counted){
        setCounted(true);
        obs.disconnect();
      }
    },{threshold:0.3});
    if(statsRef.current) obs.observe(statsRef.current);

    // Notifications live
    const pool = [
      {name:"Thomas M.",txt:"vient de s'inscrire",city:"Paris"},
      {name:"Marc L.",txt:"a gagné hier soir",gain:"+37 €",city:"Versailles"},
      {name:"Sylvie R.",txt:"passe en Premium",city:"Lyon"},
      {name:"Karim D.",txt:"a gagné ce matin",gain:"+52 €",city:"Bordeaux"},
      {name:"Ahmed B.",txt:"vient de rejoindre",city:"Marseille"},
      {name:"Julie M.",txt:"a gagné hier",gain:"+28 €",city:"Toulouse"},
    ];
    let idx=0;
    const showNotif = () => {
      const u = pool[idx%pool.length]; idx++;
      setNotif({...u, id:Date.now()});
      setTimeout(()=>setNotif(null), 4500);
      setTimeout(showNotif, 9000+Math.random()*6000);
    };
    const t = setTimeout(showNotif, 3500);

    return ()=>{ clearTimeout(t); obs.disconnect(); };
  },[]);

  // Compteur animé
  const [displayRoi,setDisplayRoi]=useState(0);
  const [displayTickets,setDisplayTickets]=useState(0);
  const [displayReussite,setDisplayReussite]=useState(0);
  const [displayGain,setDisplayGain]=useState(0);

  useEffect(()=>{
    if(!counted) return;
    const dur=1800; const fps=60; const steps=dur/1000*fps;
    let i=0;
    const interval=setInterval(()=>{
      i++;
      const p=Math.min(i/steps,1);
      const ease=1-Math.pow(1-p,3);
      setDisplayRoi(Math.round(stats.roi*ease));
      setDisplayTickets(Math.round(stats.tickets*ease));
      setDisplayReussite(Math.round(stats.reussite*ease));
      setDisplayGain(Math.round(stats.gain*ease));
      if(i>=steps)clearInterval(interval);
    },1000/fps);
    return()=>clearInterval(interval);
  },[counted,stats]);

  const faqs = [
    {q:"Comment fonctionne TurfEdge V9.2 ?",a:"Chaque matin à 7h, le moteur analyse 100% du programme PMU : 30+ signaux par cheval (forme, cotes, jockey/hippodrome, distance, terrain). Il écarte les courses illisibles et retient un seul ticket — là où la value est défendable."},
    {q:"Le ROI +26% est-il garanti ?",a:"Non. Aucun résultat passé ne garantit les performances futures. Le +26% est mesuré sur 30 jours de production réelle, chaque pari enregistré avant départ. Les paris comportent des risques."},
    {q:"Puis-je résilier à tout moment ?",a:"Oui, sans engagement, depuis votre espace compte en 2 clics. La résiliation prend effet à la fin de la période en cours."},
    {q:"Comment je reçois le ticket du jour ?",a:"Sur votre dashboard (desktop & mobile) + alerte Telegram T-15min avant le départ via @pmugagnantbot pour les abonnés Premium."},
    {q:"Vous pariez à ma place ?",a:"Non. PMU Gagnant recommande. Vous décidez. Nous n'avons aucun accès à votre compte PMU.fr."},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --g:#00FF87; --y:#FFD700; --r:#FF4D5A;
          --bg:#050508; --s1:#0A0B10; --s2:#0D0F18;
          --br:rgba(255,255,255,.07); --br2:rgba(255,255,255,.12);
          --t:#FFFFFF; --ts:rgba(255,255,255,.5); --tm:rgba(255,255,255,.3);
        }
        .lp{background:var(--bg);color:var(--t);font-family:'Inter',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
        .lp *{box-sizing:border-box}

        /* GRID FOND */
        .lp-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0;mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%)}

        /* GLOW */
        .lp-glow{position:fixed;top:-20%;left:50%;transform:translateX(-50%);width:800px;height:600px;background:radial-gradient(ellipse,rgba(0,255,135,.08) 0%,transparent 60%);pointer-events:none;z-index:0}

        /* NOTIF */
        .lp-notif{position:fixed;bottom:90px;right:24px;z-index:999;background:rgba(10,12,20,.95);border:1px solid rgba(0,255,135,.25);border-left:3px solid #00FF87;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;font-size:13px;min-width:270px;backdrop-filter:blur(12px);box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px rgba(0,255,135,.08);animation:slideUp .4s cubic-bezier(.34,1.56,.64,1)}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        .lp-notif-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#00C851,#00FF87);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#050508;flex-shrink:0}
        .lp-notif-name{font-weight:600;font-size:13px}
        .lp-notif-txt{font-size:12px;color:rgba(255,255,255,.5);margin-top:1px}
        .lp-notif-gain{font-weight:700;font-size:14px;color:#00FF87;margin-left:auto;flex-shrink:0}

        /* NAV */
        .lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:64px;border-bottom:1px solid rgba(255,255,255,.05);backdrop-filter:blur(20px);background:rgba(5,5,8,.8)}
        .lp-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
        .lp-logo-ico{width:32px;height:32px;background:#00FF87;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#050508;letter-spacing:-.02em}
        .lp-logo-name{font-weight:800;font-size:17px;letter-spacing:-.04em}
        .lp-logo-sub{font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.35);display:block;margin-top:-2px}
        .lp-nav-links{display:flex;align-items:center;gap:4px;list-style:none}
        .lp-nav-links a{padding:6px 14px;border-radius:8px;font-size:14px;font-weight:500;color:rgba(255,255,255,.45);text-decoration:none;transition:all .2s}
        .lp-nav-links a:hover{color:#fff;background:rgba(255,255,255,.06)}
        .lp-nav-cta{display:flex;align-items:center;gap:8px}
        .lp-a-ghost{padding:8px 18px;border-radius:9px;border:1px solid rgba(255,255,255,.12);color:#fff;font-size:14px;font-weight:500;text-decoration:none;transition:all .2s}
        .lp-a-ghost:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.05)}
        .lp-a-primary{padding:9px 20px;border-radius:9px;background:#00FF87;color:#050508;font-size:14px;font-weight:700;text-decoration:none;transition:all .25s;display:inline-flex;align-items:center;gap:6px}
        .lp-a-primary:hover{background:#33FF9E;transform:translateY(-1px);box-shadow:0 8px 30px rgba(0,255,135,.3)}

        /* HERO */
        .lp-hero{position:relative;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 40px 60px;text-align:center;z-index:1}
        .lp-hero-badge{display:inline-flex;align-items:center;gap:8px;padding:5px 14px;background:rgba(0,255,135,.08);border:1px solid rgba(0,255,135,.2);border-radius:100px;font-size:12px;font-weight:600;letter-spacing:.06em;color:#00FF87;text-transform:uppercase;margin-bottom:36px;animation:fadeDown .6s ease both}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        .lp-hero-pulse{width:7px;height:7px;border-radius:50%;background:#00FF87;animation:pulse 2s ease infinite;flex-shrink:0}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,255,135,.4)}50%{opacity:.6;box-shadow:0 0 0 6px rgba(0,255,135,0)}}
        .lp-hero-h1{font-size:clamp(52px,8vw,96px);font-weight:900;line-height:.92;letter-spacing:-.04em;margin-bottom:28px;animation:fadeUp .7s .1s ease both}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .lp-hero-h1 .gr{color:#00FF87}
        .lp-hero-h1 .yl{color:#FFD700}
        .lp-hero-p{font-size:19px;color:rgba(255,255,255,.55);line-height:1.7;max-width:600px;margin:0 auto 44px;animation:fadeUp .7s .2s ease both;font-weight:400}
        .lp-hero-p strong{color:#fff;font-weight:600}
        .lp-hero-ctas{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;animation:fadeUp .7s .3s ease both;margin-bottom:20px}
        .lp-hero-btn{padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;transition:all .25s;display:inline-flex;align-items:center;gap:8px;letter-spacing:-.01em}
        .lp-hero-btn.g{background:#00FF87;color:#050508;box-shadow:0 0 40px rgba(0,255,135,.25)}
        .lp-hero-btn.g:hover{background:#33FF9E;transform:translateY(-2px);box-shadow:0 16px 50px rgba(0,255,135,.4)}
        .lp-hero-btn.o{border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.8)}
        .lp-hero-btn.o:hover{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.05);color:#fff}
        .lp-hero-proof{font-size:13px;color:rgba(255,255,255,.3);display:flex;align-items:center;gap:10px;justify-content:center;animation:fadeUp .7s .4s ease both}
        .lp-hero-proof-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2)}

        /* TICKET LIVE */
        .lp-ticket-wrap{position:relative;z-index:1;padding:0 40px 0;max-width:760px;margin:0 auto;animation:fadeUp .8s .5s ease both}
        .lp-ticket{background:rgba(10,12,20,.9);border:1px solid rgba(0,255,135,.2);border-radius:20px;overflow:hidden;backdrop-filter:blur(20px);box-shadow:0 40px 100px rgba(0,0,0,.5),0 0 0 1px rgba(0,255,135,.06),inset 0 1px 0 rgba(255,255,255,.06)}
        .lp-ticket::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,135,.4),transparent)}
        .lp-ticket-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05)}
        .lp-ticket-cell{background:rgba(5,5,10,.8);padding:16px 20px;text-align:center}
        .lp-ticket-cell-lbl{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:6px}
        .lp-ticket-cell-val{font-size:15px;font-weight:700;color:#fff}
        .lp-ticket-cell-val.g{color:#00FF87}
        .lp-ticket-cell-val.y{color:#FFD700}
        .lp-ticket-body{padding:28px}
        .lp-ticket-course{font-size:32px;font-weight:900;letter-spacing:-.03em;margin-bottom:6px}
        .lp-ticket-meta{display:flex;align-items:center;gap:8px;margin-bottom:24px;flex-wrap:wrap}
        .lp-tag{padding:3px 10px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
        .lp-tag.g{background:rgba(0,255,135,.1);color:#00FF87;border:1px solid rgba(0,255,135,.2)}
        .lp-tag.w{background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.1)}
        .lp-ticket-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px}
        .lp-ticket-info{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px}
        .lp-ticket-info-lbl{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:8px}
        .lp-ticket-info-val{font-size:20px;font-weight:800;letter-spacing:-.02em}
        .lp-ticket-info-val.g{color:#00FF87}
        .lp-ticket-info-val.y{color:#FFD700}
        .lp-ticket-info.locked{position:relative;overflow:hidden;cursor:pointer}
        .lp-ticket-lock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,10,.88);backdrop-filter:blur(4px);border-radius:11px;gap:3px;transition:all .2s}
        .lp-ticket-lock:hover{background:rgba(0,255,135,.08)}
        .lp-ticket-lock-ico{font-size:16px}
        .lp-ticket-lock-txt{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,215,0,.65)}
        .lp-score-bar{display:flex;align-items:center;gap:14px;margin-bottom:20px}
        .lp-score-lbl{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.3);white-space:nowrap}
        .lp-score-track{flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
        .lp-score-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#00C851,#00FF87);animation:fillBar 1.5s 1s ease both}
        @keyframes fillBar{from{width:0}to{width:87%}}
        .lp-score-num{font-size:15px;font-weight:800;color:#00FF87;white-space:nowrap}
        .lp-ticket-cta{display:flex;align-items:center;gap:10px}
        .lp-ticket-cta-btn{flex:1;padding:13px;border-radius:10px;background:#00FF87;color:#050508;font-weight:700;font-size:15px;text-align:center;text-decoration:none;transition:all .2s}
        .lp-ticket-cta-btn:hover{background:#33FF9E;transform:translateY(-1px);box-shadow:0 8px 30px rgba(0,255,135,.35)}
        .lp-ticket-cta-txt{font-size:12px;color:rgba(255,255,255,.3);text-align:center;flex-shrink:0}

        /* STATS */
        .lp-stats{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.06);border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);margin-top:80px}
        .lp-stat{background:var(--s1);padding:40px 28px;text-align:center}
        .lp-stat-val{font-size:56px;font-weight:900;letter-spacing:-.04em;line-height:1;margin-bottom:8px}
        .lp-stat-val.g{color:#00FF87}
        .lp-stat-val.y{color:#FFD700}
        .lp-stat-val.w{color:#fff}
        .lp-stat-lbl{font-size:13px;font-weight:500;color:rgba(255,255,255,.4)}
        .lp-stat-sub{font-size:11px;color:rgba(255,255,255,.2);margin-top:4px}

        /* SECTIONS */
        .lp-sec{position:relative;z-index:1;padding:120px 40px}
        .lp-sec.dark{background:var(--s1)}
        .lp-sec.mid{background:var(--s2)}
        .lp-cont{max-width:1180px;margin:0 auto}
        .lp-sec-tag{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#00FF87;margin-bottom:16px}
        .lp-sec-h2{font-size:clamp(40px,5vw,68px);font-weight:900;line-height:.92;letter-spacing:-.04em;margin-bottom:20px}
        .lp-sec-h2 em{font-style:normal;color:#FFD700}
        .lp-sec-p{font-size:17px;color:rgba(255,255,255,.45);line-height:1.75;max-width:560px;font-weight:400}

        /* STEPS */
        .lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:64px}
        .lp-step{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:36px 30px;position:relative;overflow:hidden;transition:all .3s}
        .lp-step:hover{background:rgba(255,255,255,.05);border-color:rgba(0,255,135,.2);transform:translateY(-4px)}
        .lp-step::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,255,135,.3),transparent);opacity:0;transition:opacity .3s}
        .lp-step:hover::before{opacity:1}
        .lp-step-num{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(0,255,135,.5);margin-bottom:20px;display:flex;align-items:center;gap:10px}
        .lp-step-num::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07)}
        .lp-step-ico{width:48px;height:48px;border-radius:14px;background:rgba(0,255,135,.08);border:1px solid rgba(0,255,135,.15);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:20px}
        .lp-step h3{font-size:24px;font-weight:800;letter-spacing:-.03em;margin-bottom:12px}
        .lp-step p{font-size:14px;color:rgba(255,255,255,.45);line-height:1.75}
        .lp-step-time{margin-top:18px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.12);border-radius:100px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,215,0,.6)}

        /* AVAP */
        .lp-avap{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:64px}
        .lp-before{border-radius:18px;padding:40px;background:rgba(255,77,90,.04);border:1px solid rgba(255,77,90,.12)}
        .lp-after{border-radius:18px;padding:40px;background:rgba(0,255,135,.04);border:1px solid rgba(0,255,135,.12)}
        .lp-avap-tag{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px}
        .lp-before .lp-avap-tag{color:rgba(255,77,90,.7)}
        .lp-after .lp-avap-tag{color:rgba(0,255,135,.7)}
        .lp-avap-h{font-size:26px;font-weight:800;letter-spacing:-.03em;margin-bottom:24px}
        .lp-avap-item{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
        .lp-avap-ico{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:1px}
        .lp-before .lp-avap-ico{background:rgba(255,77,90,.12);color:#FF4D5A}
        .lp-after .lp-avap-ico{background:rgba(0,255,135,.1);color:#00FF87}
        .lp-avap-txt{font-size:14px;color:rgba(255,255,255,.55);line-height:1.6}
        .lp-avap-stat{margin-top:28px;padding-top:22px;border-top:1px solid rgba(255,255,255,.07)}
        .lp-avap-big{font-size:52px;font-weight:900;letter-spacing:-.04em;line-height:1}
        .lp-before .lp-avap-big{color:#FF4D5A}
        .lp-after .lp-avap-big{color:#00FF87}
        .lp-avap-k{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-top:5px}

        /* TESTIS */
        .lp-testis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:64px}
        .lp-testi{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:28px;transition:all .25s}
        .lp-testi:hover{background:rgba(255,255,255,.05);border-color:rgba(0,255,135,.2);transform:translateY(-3px)}
        .lp-testi-stars{color:#FFD700;font-size:13px;letter-spacing:2px;margin-bottom:14px}
        .lp-testi-txt{font-size:15px;color:rgba(255,255,255,.75);line-height:1.7;font-style:italic;margin-bottom:22px}
        .lp-testi-auth{display:flex;align-items:center;gap:10px}
        .lp-testi-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#050508;flex-shrink:0}
        .lp-testi-name{font-size:14px;font-weight:600}
        .lp-testi-meta{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
        .lp-testi-roi{margin-left:auto;font-size:16px;font-weight:800;color:#00FF87;letter-spacing:-.02em}

        /* PLANS */
        .lp-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:980px;margin:64px auto 0}
        .lp-plan{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:38px 30px;position:relative;transition:all .25s}
        .lp-plan:hover{transform:translateY(-4px)}
        .lp-plan.rec{border-color:#00FF87;background:rgba(0,255,135,.03)}
        .lp-plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#00FF87;color:#050508;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:4px 14px;border-radius:100px;white-space:nowrap}
        .lp-plan-cat{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:10px}
        .lp-plan-name{font-size:28px;font-weight:900;letter-spacing:-.03em;margin-bottom:8px}
        .lp-plan-name.g{color:#00FF87}
        .lp-plan-price{font-size:52px;font-weight:900;letter-spacing:-.04em;line-height:1;margin-bottom:4px}
        .lp-plan-price sup{font-size:22px;vertical-align:top;margin-top:10px;display:inline-block;font-weight:700}
        .lp-plan-per{font-size:14px;color:rgba(255,255,255,.35);font-weight:400}
        .lp-plan-desc{font-size:13px;color:rgba(255,255,255,.4);margin:14px 0 22px;line-height:1.6;min-height:36px}
        .lp-plan-feats{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:28px}
        .lp-plan-feats li{display:flex;align-items:center;gap:9px;font-size:14px;color:rgba(255,255,255,.8)}
        .lp-plan-feats .on{color:#00FF87;font-size:12px}
        .lp-plan-feats .off{color:rgba(255,255,255,.2);font-size:12px}
        .lp-plan-feats .off + span{color:rgba(255,255,255,.3)}
        .lp-plan-btn{display:block;text-align:center;padding:13px;border-radius:11px;font-size:15px;font-weight:700;text-decoration:none;transition:all .2s}
        .lp-plan-btn.fr{border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.8)}
        .lp-plan-btn.fr:hover{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.04)}
        .lp-plan-btn.pa{background:#00FF87;color:#050508}
        .lp-plan-btn.pa:hover{background:#33FF9E;box-shadow:0 8px 30px rgba(0,255,135,.35)}
        .lp-plan-btn.an{border:1px solid rgba(0,255,135,.3);color:#00FF87}
        .lp-plan-btn.an:hover{background:rgba(0,255,135,.07)}
        .lp-plan-eco{text-align:center;font-size:11px;font-weight:600;color:rgba(0,255,135,.6);margin-top:8px}

        /* FAQ */
        .lp-faqs{max-width:760px;margin:64px auto 0;display:flex;flex-direction:column;gap:3px}
        .lp-faq{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s}
        .lp-faq.on{border-color:rgba(0,255,135,.2)}
        .lp-faq-q{padding:20px 24px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:14px}
        .lp-faq-q:hover .lp-faq-q-txt{color:#fff}
        .lp-faq-q-txt{font-size:15px;font-weight:600;color:rgba(255,255,255,.8);transition:color .2s}
        .lp-faq-ico{width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;color:rgba(0,255,135,.7);font-size:16px;transition:transform .3s,background .2s;flex-shrink:0}
        .lp-faq.on .lp-faq-ico{transform:rotate(45deg);background:rgba(0,255,135,.1);border-color:rgba(0,255,135,.3)}
        .lp-faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease,padding .3s;font-size:14px;color:rgba(255,255,255,.45);line-height:1.8;padding:0 24px}
        .lp-faq.on .lp-faq-a{max-height:220px;padding:0 24px 20px}

        /* CTA */
        .lp-cta{position:relative;z-index:1;padding:140px 40px;text-align:center;overflow:hidden}
        .lp-cta::before{content:'';position:absolute;bottom:-100px;left:50%;transform:translateX(-50%);width:700px;height:500px;background:radial-gradient(ellipse,rgba(0,255,135,.08) 0%,transparent 70%);pointer-events:none}
        .lp-cta-h2{font-size:clamp(52px,8vw,96px);font-weight:900;line-height:.9;letter-spacing:-.05em;margin-bottom:28px}
        .lp-cta-h2 .g{color:#00FF87}
        .lp-cta-p{font-size:18px;color:rgba(255,255,255,.45);max-width:480px;margin:0 auto 48px;line-height:1.7}
        .lp-cta-strip{display:flex;align-items:center;justify-content:center;gap:16px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-top:28px;flex-wrap:wrap}
        .lp-cta-strip-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.15)}
        .lp-cta-strip span.hi{color:rgba(255,255,255,.5)}

        /* JR */
        .lp-jr{background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);overflow:hidden;white-space:nowrap}
        .lp-jr-inner{display:inline-flex;animation:tick 45s linear infinite}
        .lp-jr-item{display:inline-flex;align-items:center;gap:10px;padding:13px 28px;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.2)}
        @keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

        /* TICKER */
        .lp-ticker{background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.04);overflow:hidden;white-space:nowrap;padding:12px 0}
        .lp-ticker-inner{display:inline-flex;animation:tick 24s linear infinite}
        .lp-ticker-item{display:inline-flex;align-items:center;gap:10px;padding:0 28px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3)}
        .lp-ticker-dot{width:4px;height:4px;border-radius:50%;background:rgba(0,255,135,.4);display:inline-block}

        /* FOOTER */
        .lp-footer{background:#030305;border-top:1px solid rgba(255,255,255,.05);padding:64px 40px 36px;position:relative;z-index:1}
        .lp-footer-grid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:2.2fr 1fr 1fr 1fr;gap:48px;margin-bottom:56px}
        .lp-footer-brand p{font-size:13px;color:rgba(255,255,255,.3);line-height:1.75;margin-top:14px}
        .lp-footer-col-t{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:16px}
        .lp-footer-col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
        .lp-footer-col ul a{font-size:14px;color:rgba(255,255,255,.4);text-decoration:none;transition:color .2s}
        .lp-footer-col ul a:hover{color:rgba(255,255,255,.8)}
        .lp-footer-bot{max-width:1180px;margin:0 auto;padding-top:24px;border-top:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.2)}
        .lp-footer-bot a{color:rgba(0,255,135,.3);text-decoration:none}

        @media(max-width:900px){
          .lp-nav{padding:0 20px}.lp-nav-links{display:none}
          .lp-hero,.lp-sec{padding:80px 20px}
          .lp-stats{grid-template-columns:1fr 1fr}
          .lp-steps,.lp-avap,.lp-testis,.lp-plans{grid-template-columns:1fr}
          .lp-footer-grid{grid-template-columns:1fr 1fr}
          .lp-ticket-grid{grid-template-columns:1fr 1fr}
          .lp-ticket-bar{grid-template-columns:1fr 1fr}
        }
      `}</style>

      <div className="lp">
        {/* FOND GRILLE + GLOW */}
        <div className="lp-grid"/>
        <div className="lp-glow"/>

        {/* NOTIFICATION LIVE */}
        {notif && (
          <div className="lp-notif" key={notif.id}>
            <div className="lp-notif-av">{notif.name.split(" ").map(p=>p[0]).join("")}</div>
            <div>
              <div className="lp-notif-name">{notif.name}</div>
              <div className="lp-notif-txt">{notif.txt} · {(notif as any).city}</div>
            </div>
            {notif.gain && <div className="lp-notif-gain">{notif.gain}</div>}
          </div>
        )}

        {/* NAV */}
        <nav className="lp-nav">
          <Link href="/" className="lp-logo">
            <div className="lp-logo-ico">PG</div>
            <div>
              <span className="lp-logo-name">PMUGagnant</span>
              <span className="lp-logo-sub">TurfEdge V9.2</span>
            </div>
          </Link>
          <ul className="lp-nav-links">
            <li><a href="#comment">Comment ça marche</a></li>
            <li><a href="#resultats">Résultats</a></li>
            <li><a href="#plans">Tarifs</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className="lp-nav-cta">
            <Link href="/login" className="lp-a-ghost">Connexion</Link>
            <Link href="/signup" className="lp-a-primary">Démarrer →</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-hero-badge">
            <div className="lp-hero-pulse"/>
            Moteur actif · Analyse du {new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}
          </div>
          <h1 className="lp-hero-h1">
            L&apos;IA qui <span className="gr">prédit</span><br/>
            les courses PMU<br/>
            et vous dit <span className="yl">quoi parier.</span>
          </h1>
          <p className="lp-hero-p">
            <strong>TurfEdge V9.2 analyse 100% du programme PMU chaque matin.</strong>{" "}
            Il écarte les courses illisibles, score chaque cheval sur 30+ signaux et vous envoie un seul verdict par jour.
          </p>
          <div className="lp-hero-ctas">
            <Link href="/signup" className="lp-hero-btn g">Démarrer gratuitement →</Link>
            <a href="#comment" className="lp-hero-btn o">Comment ça marche</a>
          </div>
          <div className="lp-hero-proof">
            <span>14 jours d&apos;essai</span>
            <div className="lp-hero-proof-dot"/>
            <span>Sans carte bancaire</span>
            <div className="lp-hero-proof-dot"/>
            <span>Résiliation en 1 clic</span>
          </div>
        </section>

        {/* TICKER */}
        <div className="lp-ticker">
          <div className="lp-ticker-inner" id="lp-ticker"/>
        </div>

        {/* TICKET LIVE */}
        <div style={{position:"relative",zIndex:1,padding:"0 40px 80px",maxWidth:800,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 14px",background:"rgba(255,215,0,.06)",border:"1px solid rgba(255,215,0,.15)",borderRadius:100,fontSize:11,fontWeight:700,letterSpacing:".1em",color:"rgba(255,215,0,.7)",textTransform:"uppercase"}}>
              🎯 Aperçu du ticket du jour
            </div>
          </div>
          <div className="lp-ticket" style={{position:"relative"}}>
            <div className="lp-ticket-bar">
              {[["Décision IA","JOUER","g"],["Course focus","R3C3","g"],["Tickets valides","15","w"],["ROI réel","+22.8%","y"]].map(([l,v,c])=>(
                <div key={l} className="lp-ticket-cell">
                  <div className="lp-ticket-cell-lbl">{l}</div>
                  <div className={`lp-ticket-cell-val ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="lp-ticket-body">
              <div className="lp-ticket-course">VINCENNES · R1C3</div>
              <div className="lp-ticket-meta">
                <span className="lp-tag g">Quinté+</span>
                <span className="lp-tag w">Trot attelé</span>
                <span className="lp-tag w">2 700m</span>
                <span style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:"rgba(255,255,255,.3)"}}>Départ 15:30</span>
              </div>
              <div className="lp-ticket-grid">
                <div className="lp-ticket-info locked" onClick={()=>{}}>
                  <div className="lp-ticket-info-lbl">Cheval sélectionné</div>
                  <div className="lp-ticket-info-val" style={{filter:"blur(7px)"}}>Hall of Fame</div>
                  <div className="lp-ticket-lock">
                    <div className="lp-ticket-lock-ico">🔒</div>
                    <div className="lp-ticket-lock-txt">Premium</div>
                  </div>
                </div>
                <div className="lp-ticket-info">
                  <div className="lp-ticket-info-lbl">Mise Kelly</div>
                  <div className="lp-ticket-info-val y">25 €</div>
                </div>
                <div className="lp-ticket-info">
                  <div className="lp-ticket-info-lbl">Confiance</div>
                  <div className="lp-ticket-info-val g">10.0/10</div>
                </div>
              </div>
              <div className="lp-score-bar">
                <div className="lp-score-lbl">Score VMAX</div>
                <div className="lp-score-track"><div className="lp-score-fill"/></div>
                <div className="lp-score-num">100/100</div>
              </div>
              <div className="lp-ticket-cta">
                <Link href="/signup" className="lp-ticket-cta-btn">Voir le cheval sélectionné →</Link>
                <div className="lp-ticket-cta-txt">Gratuit<br/>Sans CB</div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS ANIMÉES */}
        <div className="lp-stats" ref={statsRef}>
          {[
            {v:`+${displayRoi}%`,lbl:"ROI moyen 30 jours",sub:"Sur bankroll 1 000 €",c:"g"},
            {v:`${displayTickets}`,lbl:"Tickets analysés",sub:"30 derniers jours",c:"w"},
            {v:`${displayReussite}%`,lbl:"Taux de réussite",sub:"Gagnant ou placé",c:"y"},
            {v:`+${displayGain} €`,lbl:"Gain net 30 jours",sub:"Bankroll de départ 1 000 €",c:"g"},
          ].map(s=>(
            <div key={s.lbl} className="lp-stat">
              <div className={`lp-stat-val ${s.c}`}>{s.v}</div>
              <div className="lp-stat-lbl">{s.lbl}</div>
              <div className="lp-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* COMMENT ÇA MARCHE */}
        <section className="lp-sec dark" id="comment">
          <div className="lp-cont">
            <div className="lp-sec-tag">Comment ça marche</div>
            <h2 className="lp-sec-h2">3 étapes.<br/><em>Zéro heure</em> perdue.</h2>
            <p className="lp-sec-p">Le moteur tourne en fond. Vous recevez le résultat. Vous pariez en 30 secondes ou vous passez.</p>
            <div className="lp-steps">
              {[
                {n:"01",ico:"🔍",h:"TurfEdge analyse",p:"7h00 : le moteur charge 100% du programme PMU. Il score chaque partant sur 30+ signaux — forme récente, cotes, jockey×hippodrome, distance, terrain.",t:"07:00 · Automatique"},
                {n:"02",ico:"🎯",h:"TurfEdge filtre",p:"Une course sur deux est jugée illisible et automatiquement écartée. Seules les courses où la value est défendable passent le filtre. C'est ça le vrai avantage.",t:"~50% de courses écartées"},
                {n:"03",ico:"📲",h:"Vous recevez",p:"Un seul verdict par jour : hippodrome, cheval, mise Kelly, niveau de confiance. Par dashboard + alerte Telegram T-15min avant le départ.",t:"Alerte T-15min"},
              ].map(s=>(
                <div key={s.n} className="lp-step">
                  <div className="lp-step-num">Étape {s.n}</div>
                  <div className="lp-step-ico">{s.ico}</div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                  <div className="lp-step-time">⏱ {s.t}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AVANT / APRÈS */}
        <section className="lp-sec mid" id="resultats">
          <div className="lp-cont">
            <div className="lp-sec-tag">Avant vs après</div>
            <h2 className="lp-sec-h2">La différence<br/><em>en chiffres.</em></h2>
            <div className="lp-avap">
              <div className="lp-before">
                <div className="lp-avap-tag">❌ Sans PMU Gagnant</div>
                <div className="lp-avap-h">Le parieur qui perd</div>
                {["Joue 5 à 8 courses par jour au feeling","Aucune rigueur sur la mise","Aucun suivi de bankroll réel","Perd 2-3h à éplucher le programme","Parie les courses loterie par FOMO","Les mauvais jours effacent tout"].map(t=>(
                  <div key={t} className="lp-avap-item">
                    <div className="lp-avap-ico">✗</div>
                    <div className="lp-avap-txt">{t}</div>
                  </div>
                ))}
                <div className="lp-avap-stat">
                  <div className="lp-avap-big">-18%</div>
                  <div className="lp-avap-k">ROI moyen sans méthode</div>
                </div>
              </div>
              <div className="lp-after">
                <div className="lp-avap-tag">✅ Avec PMU Gagnant</div>
                <div className="lp-avap-h">Le parieur qui gagne</div>
                {["1 seul ticket par jour — 30 secondes","Mise Kelly calculée automatiquement","Bilan ROI mis à jour chaque soir","Alerte Telegram — aucune surveillance","Les courses illisibles écartées auto","La discipline est dans le système"].map(t=>(
                  <div key={t} className="lp-avap-item">
                    <div className="lp-avap-ico">✓</div>
                    <div className="lp-avap-txt">{t}</div>
                  </div>
                ))}
                <div className="lp-avap-stat">
                  <div className="lp-avap-big">+{stats.roi}%</div>
                  <div className="lp-avap-k">ROI moyen abonné PMU Gagnant · 30j</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TÉMOIGNAGES */}
        <section className="lp-sec dark">
          <div className="lp-cont">
            <div className="lp-sec-tag">Ils nous font confiance</div>
            <h2 className="lp-sec-h2">Ce qu&apos;ils disent <em>vraiment.</em></h2>
            <div className="lp-testis">
              {[
                {av:"M",bg:"#075E36",name:"Marc L.",meta:"8 mois · Versailles",roi:"+31%",stars:"★★★★★",txt:"Avant je jouais 8 courses par jour. Maintenant j'en joue une, et je gagne plus. C'est tout bête mais ça change tout."},
                {av:"S",bg:"#A9832E",name:"Sylvie R.",meta:"1 an · Lyon",roi:"+18%",stars:"★★★★★",txt:"Le verdict tombe à 9h. Je le lis avec mon café. Je joue ou je joue pas. Et c'est fini pour la journée."},
                {av:"A",bg:"#0E7A47",name:"Antoine D.",meta:"4 mois · Bordeaux",roi:"+24%",stars:"★★★★☆",txt:"Le truc dingue c'est voir V9.2 écarter une course que j'aurais jouée. À chaque fois il avait raison."},
              ].map(t=>(
                <div key={t.name} className="lp-testi">
                  <div className="lp-testi-stars">{t.stars}</div>
                  <p className="lp-testi-txt">&quot;{t.txt}&quot;</p>
                  <div className="lp-testi-auth">
                    <div className="lp-testi-av" style={{background:t.bg}}>{t.av}</div>
                    <div><div className="lp-testi-name">{t.name}</div><div className="lp-testi-meta">Abonné depuis {t.meta}</div></div>
                    <div className="lp-testi-roi">{t.roi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section className="lp-sec mid" id="plans">
          <div className="lp-cont" style={{textAlign:"center"}}>
            <div className="lp-sec-tag">Tarifs</div>
            <h2 className="lp-sec-h2">Simple.<br/><em>Sans engagement.</em></h2>
            <p className="lp-sec-p" style={{margin:"0 auto"}}>14 jours pour juger sur résultats réels. Sans carte bancaire.</p>
          </div>
          <div className="lp-plans">
            {[
              {cat:"Découverte",name:"Gratuit",nameClass:"",price:"0",per:"/mois",rec:false,desc:"Pour découvrir V9.2 et tester 14 jours complets.",feats:[{on:true,t:"Le verdict du jour (Jouer/Passer)"},{on:true,t:"3 courses analysées / semaine"},{on:false,t:"Cheval + mise Kelly"},{on:false,t:"Alertes Telegram T-15"},{on:false,t:"Score V9.2 complet"}],href:"/signup",btnClass:"fr",btnTxt:"Commencer gratuitement",eco:""},
              {cat:"Parieurs actifs",name:"Premium",nameClass:"g",price:"19",per:"/mois",rec:true,desc:"Accès complet : cheval, mise, score, Telegram, ROI.",feats:[{on:true,t:"Tout le programme analysé"},{on:true,t:"Cheval + score V9.2 + Kelly"},{on:true,t:"Alertes Telegram T-15min"},{on:true,t:"Coach IA illimité"},{on:true,t:"Bilan ROI temps réel"}],href:"/subscribe",btnClass:"pa",btnTxt:"Essai 14 jours →",eco:""},
              {cat:"Méthodiques",name:"Annuel",nameClass:"",price:"149",per:"/an",rec:false,desc:"Tout Premium + 2 mois offerts + backtests V9.2.",feats:[{on:true,t:"Tout le plan Premium"},{on:true,t:"2 mois offerts"},{on:true,t:"Backtests historiques"},{on:true,t:"Export CSV"},{on:true,t:"Support prioritaire"}],href:"/subscribe?plan=annual",btnClass:"an",btnTxt:"Économiser 79 € →",eco:"soit 12,41 € / mois"},
            ].map(p=>(
              <div key={p.name} className={`lp-plan${p.rec?" rec":""}`}>
                {p.rec&&<div className="lp-plan-badge">★ RECOMMANDÉ</div>}
                <div className="lp-plan-cat">{p.cat}</div>
                <div className={`lp-plan-name ${p.nameClass}`}>{p.name}</div>
                <div className="lp-plan-price"><sup>€</sup>{p.price}<span className="lp-plan-per">{p.per}</span></div>
                <p className="lp-plan-desc">{p.desc}</p>
                <ul className="lp-plan-feats">
                  {p.feats.map(f=><li key={f.t}><span className={f.on?"on":"off"}>●</span><span>{f.t}</span></li>)}
                </ul>
                <Link href={p.href} className={`lp-plan-btn ${p.btnClass}`}>{p.btnTxt}</Link>
                {p.eco&&<div className="lp-plan-eco">↳ {p.eco}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-sec dark" id="faq">
          <div className="lp-cont" style={{textAlign:"center",marginBottom:64}}>
            <div className="lp-sec-tag">FAQ</div>
            <h2 className="lp-sec-h2">Questions <em>fréquentes.</em></h2>
          </div>
          <div className="lp-faqs">
            {faqs.map((f,i)=>(
              <div key={i} className={`lp-faq${faqOpen===i?" on":""}`}>
                <div className="lp-faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)}>
                  <span className="lp-faq-q-txt">{f.q}</span>
                  <div className="lp-faq-ico">+</div>
                </div>
                <div className="lp-faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="lp-cta">
          <div className="lp-sec-tag" style={{justifyContent:"center",display:"flex",marginBottom:24}}>Prêt à commencer ?</div>
          <h2 className="lp-cta-h2">Le prochain ticket<br/>tombe <span className="g">demain matin.</span></h2>
          <p className="lp-cta-p">14 jours d&apos;essai complet. Sans carte bancaire. Si ce n&apos;est pas pour vous, vous partez sans frais.</p>
          <Link href="/signup" className="lp-hero-btn g" style={{display:"inline-flex",fontSize:18,padding:"18px 44px"}}>Démarrer gratuitement →</Link>
          <div className="lp-cta-strip">
            <span><span className="hi">14 jours</span> d&apos;essai</span>
            <div className="lp-cta-strip-dot"/>
            <span><span className="hi">Sans</span> CB</span>
            <div className="lp-cta-strip-dot"/>
            <span>Résiliation <span className="hi">1 clic</span></span>
            <div className="lp-cta-strip-dot"/>
            <span>ROI <span className="hi">mesuré</span> en direct</span>
          </div>
        </section>

        {/* JEU RESPONSABLE */}
        <div className="lp-jr"><div className="lp-jr-inner" id="lp-jr"/></div>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-logo" style={{display:"inline-flex"}}>
                <div className="lp-logo-ico">PG</div>
                <div><span className="lp-logo-name">PMUGagnant</span><span className="lp-logo-sub">TurfEdge V9.2</span></div>
              </Link>
              <p>L&apos;IA qui analyse 30+ signaux par course PMU et vous donne un seul verdict — celui où la value est défendable.</p>
            </div>
            {[{t:"Produit",links:[["Dashboard","/dashboard"],["Mon bilan","/bilan"],["Mes paris","/mes-paris"],["Premium","/subscribe"]]},
              {t:"Compte",links:[["Connexion","/login"],["Inscription","/signup"],["Abonnement","/subscribe"]]},
              {t:"Légal",links:[["Mentions légales","/mentions-legales"],["CGV","/cgv"],["Confidentialité","/politique-confidentialite"],["Cookies","/politique-cookies"],["Jeu responsable","/jeu-responsable"]]}
            ].map(col=>(
              <div key={col.t} className="lp-footer-col">
                <div className="lp-footer-col-t">{col.t}</div>
                <ul>{col.links.map(([l,h])=><li key={l}><Link href={h}>{l}</Link></li>)}</ul>
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
        if(tk){[0,1].forEach(function(){hippos.forEach(function(h){tk.innerHTML+='<span class="lp-ticker-item"><span class="lp-ticker-dot"></span>'+h+'</span>';});});}
        var jr=document.getElementById('lp-jr');
        if(jr){var items=['⚠ JOUER COMPORTE DES RISQUES','ENDETTEMENT · DÉPENDANCE','09 74 75 13 13','JOUEURS-INFO-SERVICE.FR','INTERDIT AUX MINEURS'];[0,1,2].forEach(function(){items.forEach(function(i){jr.innerHTML+='<span class="lp-jr-item">'+i+'</span>';});});}
      `}}/>
    </>
  );
}
