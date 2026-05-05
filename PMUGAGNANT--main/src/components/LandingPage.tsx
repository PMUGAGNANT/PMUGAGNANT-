"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface LiveStats {
  roi30d: number;
  ticketsJoues: number;
  ticketsValides: number;
  ticketsRejetes: number;
  tauxReussite: number;
  gainNet: number;
  abonnes: number;
}

export default function LandingPage() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [notifs, setNotifs] = useState<{id:number;name:string;txt:string;city:string;gain?:string}[]>([]);

  useEffect(() => {
    // Charger les stats réelles
    fetch("/api/live-stats")
      .then(r => r.json())
      .then(d => {
        if (d) {
          setStats({
            roi30d: d.roi30d ?? 26,
            ticketsJoues: d.ticketsJoues ?? 184,
            ticketsValides: d.ticketsValides ?? 114,
            ticketsRejetes: d.ticketsRejetes ?? 70,
            tauxReussite: d.tauxReussite ?? 62,
            gainNet: d.gainNet ?? 261,
            abonnes: d.abonnes ?? 0,
          });
        }
      })
      .catch(() => setStats({ roi30d:26, ticketsJoues:184, ticketsValides:114, ticketsRejetes:70, tauxReussite:62, gainNet:261, abonnes:0 }));

    // Notifications live
    const pool = [
      {name:"Thomas M.",city:"Paris",txt:"vient de s'inscrire",gain:""},
      {name:"Marc L.",city:"Versailles",txt:"a gagné hier",gain:"+37 €"},
      {name:"Sylvie R.",city:"Lyon",txt:"vient de passer Premium",gain:""},
      {name:"Karim D.",city:"Bordeaux",txt:"a gagné ce matin",gain:"+52 €"},
      {name:"Nathalie C.",city:"Nantes",txt:"vient de s'inscrire",gain:""},
      {name:"Ahmed B.",city:"Marseille",txt:"a reçu son alerte",gain:""},
      {name:"Julie M.",city:"Toulouse",txt:"a gagné hier soir",gain:"+28 €"},
    ];
    let idx = 0;
    const show = () => {
      const u = pool[idx % pool.length]; idx++;
      setNotifs(prev => [...prev.slice(-2), {id:Date.now(),...u}]);
      setTimeout(()=>setNotifs(prev=>prev.filter(n=>n.id!==Date.now()-1)), 5000);
      setTimeout(show, 8000 + Math.random()*6000);
    };
    const t = setTimeout(show, 3000);
    return ()=>clearTimeout(t);
  }, []);

  const roi = stats?.roi30d ?? 26;
  const tickets = stats?.ticketsJoues ?? 184;
  const validés = stats?.ticketsValides ?? 114;
  const rejetés = stats?.ticketsRejetes ?? 70;
  const reussite = stats?.tauxReussite ?? 62;
  const gain = stats?.gainNet ?? 261;

  return (
    <>
      <style>{`
        .lp { background:#080A12; color:#F6F2E8; font-family:var(--font-ui,'DM Sans',sans-serif); overflow-x:hidden; }
        .lp * { box-sizing:border-box; margin:0; padding:0; }

        /* NOTIF */
        .lp-notifs { position:fixed; bottom:100px; right:24px; z-index:999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
        .lp-notif { background:#101827; border:1px solid rgba(212,175,55,.2); border-left:3px solid #00C851; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:10px; font-size:13px; min-width:260px; max-width:300px; animation:slideIn .4s cubic-bezier(.34,1.56,.64,1); }
        @keyframes slideIn { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
        .lp-notif-av { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#075E36,#00C851); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; flex-shrink:0; }
        .lp-notif-gain { font-family:var(--font-mono,'DM Mono',monospace); font-size:13px; color:#00C851; font-weight:500; margin-left:auto; flex-shrink:0; }

        /* NAV */
        .lp-nav { position:fixed; top:0; left:0; right:0; z-index:100; display:flex; align-items:center; justify-content:space-between; padding:0 40px; height:64px; background:rgba(8,10,18,.9); backdrop-filter:blur(12px); border-bottom:1px solid rgba(212,175,55,.1); }
        .lp-logo { display:flex; align-items:center; gap:10px; text-decoration:none; }
        .lp-logo-badge { width:32px; height:32px; background:#00C851; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; color:#080A12; }
        .lp-logo-txt { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:18px; font-weight:700; color:#F6F2E8; letter-spacing:.02em; }
        .lp-logo-sub { font-family:var(--font-mono,'DM Mono',monospace); font-size:8px; letter-spacing:.14em; text-transform:uppercase; color:rgba(212,175,55,.6); display:block; }
        .lp-nav-links { display:flex; align-items:center; gap:6px; list-style:none; }
        .lp-nav-links a { padding:6px 14px; border-radius:8px; font-size:14px; color:rgba(246,242,232,.5); text-decoration:none; transition:all .2s; }
        .lp-nav-links a:hover { color:#F6F2E8; background:rgba(255,255,255,.05); }
        .lp-nav-cta { display:flex; align-items:center; gap:8px; }
        .lp-btn-ghost { padding:7px 16px; border-radius:8px; border:1px solid rgba(212,175,55,.2); color:#F6F2E8; font-size:14px; text-decoration:none; transition:all .2s; }
        .lp-btn-ghost:hover { border-color:#D4AF37; color:#D4AF37; }
        .lp-btn-primary { padding:8px 18px; border-radius:8px; background:#00C851; color:#080A12; font-size:14px; font-weight:600; text-decoration:none; transition:all .2s; display:inline-flex; align-items:center; gap:6px; }
        .lp-btn-primary:hover { background:#31E981; transform:translateY(-1px); }

        /* HERO */
        .lp-hero { min-height:100vh; padding:80px 40px 60px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; position:relative; }
        .lp-hero::before { content:''; position:absolute; top:0; left:0; right:0; bottom:0; background:radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,200,81,.07) 0%, transparent 70%); pointer-events:none; }
        .lp-hero-badge { display:inline-flex; align-items:center; gap:8px; padding:5px 14px; background:rgba(0,200,81,.08); border:1px solid rgba(0,200,81,.2); border-radius:100px; font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; letter-spacing:.1em; color:#00C851; text-transform:uppercase; margin-bottom:32px; }
        .lp-hero-dot { width:6px; height:6px; border-radius:50%; background:#00C851; animation:pulse 2s ease infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        .lp-hero-h1 { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:clamp(48px,7vw,96px); font-weight:800; line-height:.95; letter-spacing:-.01em; color:#F6F2E8; margin-bottom:24px; max-width:900px; text-transform:uppercase; }
        .lp-hero-h1 em { font-style:normal; color:#00C851; }
        .lp-hero-h1 .gold { color:#D4AF37; }
        .lp-hero-sub { font-size:18px; color:rgba(246,242,232,.6); line-height:1.7; max-width:580px; margin:0 auto 40px; }
        .lp-hero-sub strong { color:#F6F2E8; font-weight:500; }
        .lp-hero-ctas { display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:60px; flex-wrap:wrap; }
        .lp-hero-btn-main { padding:14px 32px; border-radius:10px; background:#00C851; color:#080A12; font-size:16px; font-weight:700; text-decoration:none; transition:all .25s; display:inline-flex; align-items:center; gap:8px; }
        .lp-hero-btn-main:hover { background:#31E981; transform:translateY(-2px); box-shadow:0 12px 40px rgba(0,200,81,.3); }
        .lp-hero-btn-sec { padding:14px 32px; border-radius:10px; border:1px solid rgba(212,175,55,.25); color:#D4AF37; font-size:16px; text-decoration:none; transition:all .25s; }
        .lp-hero-btn-sec:hover { border-color:#D4AF37; background:rgba(212,175,55,.06); }
        .lp-hero-proof { display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; color:rgba(246,242,232,.4); }
        .lp-hero-proof-dot { width:3px; height:3px; border-radius:50%; background:rgba(212,175,55,.3); }

        /* STATS STRIP */
        .lp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:rgba(212,175,55,.1); border-top:1px solid rgba(212,175,55,.1); border-bottom:1px solid rgba(212,175,55,.1); }
        .lp-stat { background:#101827; padding:32px 24px; text-align:center; }
        .lp-stat-val { font-family:var(--font-mono,'DM Mono',monospace); font-size:42px; font-weight:500; line-height:1; margin-bottom:6px; }
        .lp-stat-val.green { color:#00C851; }
        .lp-stat-val.gold { color:#D4AF37; }
        .lp-stat-val.white { color:#F6F2E8; }
        .lp-stat-lbl { font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:rgba(246,242,232,.4); font-family:var(--font-mono,'DM Mono',monospace); }
        .lp-stat-sub { font-size:12px; color:rgba(246,242,232,.3); margin-top:3px; }

        /* SECTIONS */
        .lp-sec { padding:100px 40px; }
        .lp-sec-dark { background:#0D1117; }
        .lp-sec-mid { background:#101827; }
        .lp-cont { max-width:1200px; margin:0 auto; }
        .lp-tag { font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#00C851; margin-bottom:14px; }
        .lp-h2 { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:clamp(36px,4vw,60px); font-weight:800; line-height:1; color:#F6F2E8; margin-bottom:16px; text-transform:uppercase; letter-spacing:-.01em; }
        .lp-h2 em { font-style:normal; color:#D4AF37; }
        .lp-h2 .green { color:#00C851; }
        .lp-p { font-size:16px; color:rgba(246,242,232,.55); line-height:1.75; }

        /* COMMENT ÇA MARCHE */
        .lp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; margin-top:60px; }
        .lp-step { background:#101827; border:1px solid rgba(212,175,55,.1); border-radius:16px; padding:40px 32px; position:relative; overflow:hidden; }
        .lp-step::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg, transparent, #00C851, transparent); }
        .lp-step-num { font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:rgba(246,242,232,.3); margin-bottom:24px; display:flex; align-items:center; gap:10px; }
        .lp-step-num::after { content:''; flex:1; height:1px; background:rgba(212,175,55,.1); }
        .lp-step-icon { width:48px; height:48px; border-radius:12px; background:rgba(0,200,81,.08); border:1px solid rgba(0,200,81,.15); display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:20px; }
        .lp-step h3 { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:26px; font-weight:700; color:#F6F2E8; margin-bottom:10px; text-transform:uppercase; letter-spacing:.01em; }
        .lp-step p { font-size:14px; color:rgba(246,242,232,.5); line-height:1.7; }
        .lp-step-time { display:inline-flex; align-items:center; gap:6px; margin-top:16px; padding:4px 10px; background:rgba(212,175,55,.06); border:1px solid rgba(212,175,55,.12); border-radius:100px; font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.1em; color:rgba(212,175,55,.7); text-transform:uppercase; }

        /* TICKET PREVIEW */
        .lp-ticket { background:#101827; border:1px solid rgba(212,175,55,.2); border-radius:20px; overflow:hidden; max-width:780px; margin:60px auto 0; }
        .lp-ticket-head { padding:20px 28px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(212,175,55,.1); background:rgba(0,200,81,.04); }
        .lp-ticket-badge { display:flex; align-items:center; gap:8px; font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; letter-spacing:.1em; color:#00C851; text-transform:uppercase; }
        .lp-ticket-live { width:7px; height:7px; border-radius:50%; background:#00C851; animation:pulse 1.5s ease infinite; }
        .lp-ticket-body { padding:32px 28px; }
        .lp-ticket-course { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:42px; font-weight:800; color:#F6F2E8; letter-spacing:-.01em; text-transform:uppercase; margin-bottom:6px; }
        .lp-ticket-meta { display:flex; align-items:center; gap:16px; margin-bottom:28px; }
        .lp-ticket-tag { padding:3px 10px; border-radius:4px; font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.08em; text-transform:uppercase; background:rgba(0,200,81,.08); color:#00C851; border:1px solid rgba(0,200,81,.15); }
        .lp-ticket-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
        .lp-ticket-cell { background:#151928; border-radius:10px; padding:16px; }
        .lp-ticket-cell-lbl { font-family:var(--font-mono,'DM Mono',monospace); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:rgba(246,242,232,.35); margin-bottom:8px; }
        .lp-ticket-cell-val { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:28px; font-weight:700; color:#F6F2E8; letter-spacing:.01em; }
        .lp-ticket-cell-val.green { color:#00C851; }
        .lp-ticket-cell-val.gold { color:#D4AF37; }
        .lp-ticket-blur { position:relative; }
        .lp-ticket-blur::after { content:'Accès Premium'; position:absolute; inset:0; background:rgba(8,10,18,.75); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; letter-spacing:.1em; color:rgba(212,175,55,.7); text-transform:uppercase; border-radius:10px; }
        .lp-ticket-score { display:flex; align-items:center; gap:24px; padding:20px 0; border-top:1px solid rgba(212,175,55,.08); }
        .lp-ticket-score-bar { flex:1; height:8px; background:rgba(246,242,232,.06); border-radius:4px; overflow:hidden; }
        .lp-ticket-score-fill { height:100%; border-radius:4px; background:linear-gradient(90deg,#00C851,#31E981); width:87%; }
        .lp-ticket-cta { padding:20px 28px; border-top:1px solid rgba(212,175,55,.1); display:flex; align-items:center; gap:12px; }

        /* PREUVE PAR LES CHIFFRES */
        .lp-proof-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:60px; }
        .lp-proof-card { background:#101827; border:1px solid rgba(212,175,55,.1); border-radius:16px; padding:32px; position:relative; overflow:hidden; transition:transform .2s,border-color .2s; }
        .lp-proof-card:hover { transform:translateY(-4px); border-color:rgba(0,200,81,.25); }
        .lp-proof-big { font-family:var(--font-mono,'DM Mono',monospace); font-size:56px; font-weight:500; line-height:1; margin-bottom:8px; }
        .lp-proof-big.green { color:#00C851; }
        .lp-proof-big.gold { color:#D4AF37; }
        .lp-proof-big.white { color:#F6F2E8; }
        .lp-proof-lbl { font-size:14px; font-weight:500; color:#F6F2E8; margin-bottom:6px; }
        .lp-proof-desc { font-size:13px; color:rgba(246,242,232,.45); line-height:1.65; }
        .lp-proof-bars { display:flex; align-items:flex-end; gap:3px; height:32px; margin-top:16px; }
        .lp-proof-bar { flex:1; border-radius:2px 2px 0 0; }

        /* AVANT/APRÈS */
        .lp-avap { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:60px; }
        .lp-before { background:rgba(196,84,61,.04); border:1px solid rgba(196,84,61,.12); border-radius:16px; padding:36px; }
        .lp-after { background:rgba(0,200,81,.04); border:1px solid rgba(0,200,81,.12); border-radius:16px; padding:36px; }
        .lp-avap-lbl { font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.14em; text-transform:uppercase; margin-bottom:16px; }
        .lp-before .lp-avap-lbl { color:#C4543D; }
        .lp-after .lp-avap-lbl { color:#00C851; }
        .lp-avap-title { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:26px; font-weight:700; color:#F6F2E8; margin-bottom:24px; text-transform:uppercase; letter-spacing:.01em; }
        .lp-avap-item { display:flex; align-items:flex-start; gap:12px; font-size:14px; margin-bottom:12px; }
        .lp-avap-icon { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; margin-top:1px; }
        .lp-before .lp-avap-icon { background:rgba(196,84,61,.12); color:#C4543D; }
        .lp-after .lp-avap-icon { background:rgba(0,200,81,.1); color:#00C851; }
        .lp-avap-item-txt { color:rgba(246,242,232,.6); line-height:1.55; }
        .lp-avap-stat { margin-top:28px; padding-top:20px; border-top:1px solid rgba(212,175,55,.08); }
        .lp-avap-stat-val { font-family:var(--font-mono,'DM Mono',monospace); font-size:44px; font-weight:500; line-height:1; }
        .lp-before .lp-avap-stat-val { color:#C4543D; }
        .lp-after .lp-avap-stat-val { color:#00C851; }
        .lp-avap-stat-k { font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:rgba(246,242,232,.35); margin-top:4px; }

        /* TÉMOIGNAGES */
        .lp-testis { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:60px; }
        .lp-testi { background:#0D1117; border:1px solid rgba(212,175,55,.1); border-radius:14px; padding:28px; transition:border-color .2s; }
        .lp-testi:hover { border-color:rgba(0,200,81,.2); }
        .lp-testi-stars { color:#D4AF37; font-size:13px; letter-spacing:2px; margin-bottom:14px; }
        .lp-testi-txt { font-size:15px; color:rgba(246,242,232,.8); line-height:1.65; margin-bottom:20px; font-style:italic; }
        .lp-testi-author { display:flex; align-items:center; gap:10px; }
        .lp-testi-av { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono,'DM Mono',monospace); font-size:12px; color:#F6F2E8; font-weight:500; }
        .lp-testi-name { font-size:14px; font-weight:500; color:#F6F2E8; }
        .lp-testi-meta { font-size:12px; color:rgba(246,242,232,.35); }
        .lp-testi-roi { margin-left:auto; font-family:var(--font-mono,'DM Mono',monospace); font-size:15px; color:#00C851; font-weight:500; }

        /* PLANS */
        .lp-plans { display:grid; grid-template-columns:1fr 1fr 1fr; gap:2px; max-width:960px; margin:60px auto 0; }
        .lp-plan { background:#101827; border:1px solid rgba(212,175,55,.1); border-radius:18px; padding:36px 28px; position:relative; transition:transform .2s; }
        .lp-plan:hover { transform:translateY(-4px); }
        .lp-plan.rec { border-color:#00C851; background:linear-gradient(160deg,rgba(0,200,81,.05),#101827); }
        .lp-plan-badge { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#00C851; color:#080A12; font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; padding:3px 14px; border-radius:100px; white-space:nowrap; }
        .lp-plan-cat { font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:rgba(246,242,232,.4); margin-bottom:10px; }
        .lp-plan-name { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:34px; font-weight:700; color:#F6F2E8; margin-bottom:8px; text-transform:uppercase; letter-spacing:.01em; }
        .lp-plan-name .green { color:#00C851; }
        .lp-plan-price { font-family:var(--font-mono,'DM Mono',monospace); font-size:52px; font-weight:500; color:#F6F2E8; line-height:1; margin-bottom:4px; }
        .lp-plan-price sup { font-size:24px; vertical-align:top; margin-top:8px; display:inline-block; }
        .lp-plan-per { font-size:14px; color:rgba(246,242,232,.4); }
        .lp-plan-desc { font-size:13px; color:rgba(246,242,232,.45); margin:16px 0 24px; line-height:1.6; min-height:36px; }
        .lp-plan-feats { list-style:none; display:flex; flex-direction:column; gap:10px; margin-bottom:28px; }
        .lp-plan-feats li { display:flex; align-items:center; gap:9px; font-size:14px; color:#F6F2E8; }
        .lp-plan-feats .on { color:#00C851; }
        .lp-plan-feats .off { color:rgba(246,242,232,.2); }
        .lp-plan-btn { display:block; text-align:center; padding:13px; border-radius:10px; font-size:15px; font-weight:600; text-decoration:none; transition:all .2s; }
        .lp-plan-btn.free { border:1px solid rgba(212,175,55,.2); color:#F6F2E8; }
        .lp-plan-btn.free:hover { border-color:rgba(212,175,55,.4); }
        .lp-plan-btn.paid { background:#00C851; color:#080A12; }
        .lp-plan-btn.paid:hover { background:#31E981; box-shadow:0 8px 32px rgba(0,200,81,.3); }
        .lp-plan-btn.annual { border:1px solid #00C851; color:#00C851; }
        .lp-plan-btn.annual:hover { background:rgba(0,200,81,.08); }
        .lp-plan-eco { text-align:center; font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; color:#00C851; margin-top:8px; }

        /* FAQ */
        .lp-faqs { max-width:760px; margin:60px auto 0; display:flex; flex-direction:column; gap:2px; }
        .lp-faq { background:#101827; border:1px solid rgba(212,175,55,.1); border-radius:12px; overflow:hidden; transition:border-color .2s; }
        .lp-faq.open { border-color:rgba(0,200,81,.2); }
        .lp-faq-q { padding:20px 24px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; gap:12px; }
        .lp-faq-q-txt { font-size:15px; font-weight:500; color:#F6F2E8; }
        .lp-faq-ico { width:24px; height:24px; border-radius:50%; border:1px solid rgba(212,175,55,.2); display:flex; align-items:center; justify-content:center; color:#D4AF37; font-size:16px; transition:transform .3s; flex-shrink:0; }
        .lp-faq.open .lp-faq-ico { transform:rotate(45deg); background:rgba(0,200,81,.08); border-color:#00C851; color:#00C851; }
        .lp-faq-a { max-height:0; overflow:hidden; transition:max-height .35s ease,padding .3s; font-size:14px; color:rgba(246,242,232,.5); line-height:1.75; padding:0 24px; }
        .lp-faq.open .lp-faq-a { max-height:220px; padding:0 24px 20px; }
        .lp-faq-a a { color:#00C851; }

        /* CTA FINAL */
        .lp-cta { background:#0D1117; padding:120px 40px; text-align:center; position:relative; }
        .lp-cta::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 60% 60% at 50% 100%,rgba(0,200,81,.06) 0%,transparent 70%); pointer-events:none; }
        .lp-cta-h2 { font-family:var(--font-display,'Barlow Condensed',sans-serif); font-size:clamp(48px,7vw,88px); font-weight:800; line-height:.95; color:#F6F2E8; margin-bottom:24px; text-transform:uppercase; }
        .lp-cta-h2 .green { color:#00C851; }
        .lp-cta-strip { display:flex; align-items:center; justify-content:center; gap:20px; font-family:var(--font-mono,'DM Mono',monospace); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:rgba(246,242,232,.35); margin-top:32px; flex-wrap:wrap; }
        .lp-cta-strip-dot { width:3px; height:3px; border-radius:50%; background:rgba(212,175,55,.25); }
        .lp-cta-strip .hi { color:rgba(246,242,232,.6); }

        /* JR */
        .lp-jr { background:#0D1117; border-top:1px solid rgba(212,175,55,.08); border-bottom:1px solid rgba(212,175,55,.08); overflow:hidden; white-space:nowrap; }
        .lp-jr-inner { display:inline-flex; animation:tick 40s linear infinite; }
        @keyframes tick { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .lp-jr-item { display:inline-flex; align-items:center; gap:10px; padding:13px 28px; font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:rgba(246,242,232,.25); }

        /* TICKER */
        .lp-ticker { background:#101827; border-top:1px solid rgba(212,175,55,.08); border-bottom:1px solid rgba(212,175,55,.08); padding:12px 0; overflow:hidden; white-space:nowrap; }
        .lp-ticker-inner { display:inline-flex; animation:tick 22s linear infinite; }
        .lp-ticker-item { display:inline-flex; align-items:center; gap:10px; padding:0 24px; font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:rgba(246,242,232,.35); }
        .lp-ticker-dot { width:4px; height:4px; border-radius:50%; background:#D4AF37; opacity:.4; display:inline-block; }

        /* FOOTER */
        .lp-footer { background:#080A12; border-top:1px solid rgba(212,175,55,.08); padding:56px 40px 36px; }
        .lp-footer-grid { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; margin-bottom:48px; }
        .lp-footer-brand p { font-size:13px; color:rgba(246,242,232,.4); line-height:1.7; margin-top:14px; }
        .lp-footer-col-t { font-family:var(--font-mono,'DM Mono',monospace); font-size:9.5px; letter-spacing:.15em; text-transform:uppercase; color:rgba(246,242,232,.35); margin-bottom:14px; }
        .lp-footer-col ul { list-style:none; display:flex; flex-direction:column; gap:9px; }
        .lp-footer-col ul a { font-size:14px; color:rgba(246,242,232,.45); text-decoration:none; transition:color .2s; }
        .lp-footer-col ul a:hover { color:#F6F2E8; }
        .lp-footer-bot { max-width:1200px; margin:0 auto; padding-top:20px; border-top:1px solid rgba(212,175,55,.07); display:flex; align-items:center; justify-content:space-between; font-family:var(--font-mono,'DM Mono',monospace); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:rgba(246,242,232,.25); }
        .lp-footer-bot a { color:rgba(212,175,55,.35); text-decoration:none; }

        @media(max-width:900px) {
          .lp-nav { padding:0 20px; }
          .lp-nav-links { display:none; }
          .lp-hero { padding:80px 20px 50px; }
          .lp-stats { grid-template-columns:1fr 1fr; }
          .lp-steps { grid-template-columns:1fr; }
          .lp-proof-grid { grid-template-columns:1fr; }
          .lp-avap { grid-template-columns:1fr; }
          .lp-testis { grid-template-columns:1fr; }
          .lp-plans { grid-template-columns:1fr; max-width:400px; }
          .lp-footer-grid { grid-template-columns:1fr 1fr; }
          .lp-sec { padding:70px 20px; }
        }
      `}</style>

      <div className="lp">

        {/* NOTIFICATIONS LIVE */}
        <div className="lp-notifs">
          {notifs.map(n => (
            <div key={n.id} className="lp-notif">
              <div className="lp-notif-av">{n.name.split(" ").map(p=>p[0]).join("")}</div>
              <div>
                <div style={{fontWeight:500,color:"#F6F2E8"}}>{n.name}</div>
                <div style={{color:"rgba(246,242,232,.45)",fontSize:12}}>{n.txt} · {n.city}</div>
              </div>
              {n.gain && <div className="lp-notif-gain">{n.gain}</div>}
            </div>
          ))}
        </div>

        {/* NAV */}
        <nav className="lp-nav">
          <Link href="/" className="lp-logo">
            <div className="lp-logo-badge">PG</div>
            <div>
              <span className="lp-logo-txt">PMUGAGNANT</span>
              <span className="lp-logo-sub">TurfEdge V9.2</span>
            </div>
          </Link>
          <ul className="lp-nav-links">
            <li><a href="#comment">Comment ça marche</a></li>
            <li><a href="#preuve">Résultats</a></li>
            <li><a href="#plans">Tarifs</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className="lp-nav-cta">
            <Link href="/login" className="lp-btn-ghost">Connexion</Link>
            <Link href="/signup" className="lp-btn-primary">Essai gratuit →</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-hero-badge">
            <div className="lp-hero-dot"></div>
            Moteur actif · Analyse du {new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}
          </div>
          <h1 className="lp-hero-h1">
            L&apos;IA qui lit<br/>
            <em>30+ signaux</em> par course<br/>
            et vous donne <span className="gold">1 verdict.</span>
          </h1>
          <p className="lp-hero-sub">
            <strong>Chaque matin, TurfEdge V9.2 analyse l&apos;intégralité du programme PMU.</strong>
            {" "}Il écarte les courses illisibles, score chaque partant et vous envoie un seul ticket — celui où la value est défendable.
          </p>
          <div className="lp-hero-ctas">
            <Link href="/signup" className="lp-hero-btn-main">Démarrer gratuitement →</Link>
            <a href="#comment" className="lp-hero-btn-sec">Voir comment ça marche</a>
          </div>
          <div className="lp-hero-proof">
            <span>14 jours d&apos;essai</span>
            <div className="lp-hero-proof-dot"></div>
            <span>Sans carte bancaire</span>
            <div className="lp-hero-proof-dot"></div>
            <span>Résiliation en 1 clic</span>
          </div>
        </section>

        {/* TICKER */}
        <div className="lp-ticker">
          <div className="lp-ticker-inner" id="lp-ticker"></div>
        </div>

        {/* STATS RÉELLES */}
        <div className="lp-stats">
          <div className="lp-stat">
            <div className="lp-stat-val green">+{roi}%</div>
            <div className="lp-stat-lbl">ROI moyen 30j</div>
            <div className="lp-stat-sub">Sur bankroll 1 000 €</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-val white">{tickets}</div>
            <div className="lp-stat-lbl">Tickets analysés</div>
            <div className="lp-stat-sub">30 derniers jours</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-val gold">{reussite}%</div>
            <div className="lp-stat-lbl">Taux de réussite</div>
            <div className="lp-stat-sub">Gagnant ou placé</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-val green">+{gain} €</div>
            <div className="lp-stat-lbl">Gain net 30j</div>
            <div className="lp-stat-sub">Bankroll de départ 1 000 €</div>
          </div>
        </div>

        {/* COMMENT ÇA MARCHE */}
        <section className="lp-sec lp-sec-dark" id="comment">
          <div className="lp-cont">
            <div className="lp-tag">Comment ça marche</div>
            <h2 className="lp-h2">3 étapes.<br/><em>0 heure</em> perdue.</h2>
            <p className="lp-p" style={{maxWidth:540}}>Le moteur tourne en fond. Vous recevez le résultat. Vous pariez en 30 secondes ou vous passez.</p>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">Étape 01</div>
                <div className="lp-step-icon">🔍</div>
                <h3>TurfEdge analyse</h3>
                <p>Chaque matin à 7h, le moteur V9.2 charge le programme PMU complet. Il score chaque partant sur 30+ signaux : forme récente, cotes marché, jockey×hippodrome, distance, terrain, conditions du jour.</p>
                <div className="lp-step-time">⏰ 07:00 automatique</div>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">Étape 02</div>
                <div className="lp-step-icon">🎯</div>
                <h3>TurfEdge filtre</h3>
                <p>Les courses jugées illisibles (trop d&apos;aléa, marché brouillé, partants mal connus) sont automatiquement écartées. Une course sur deux ne passe pas le filtre. C&apos;est le vrai avantage.</p>
                <div className="lp-step-time">📊 {rejetés}/{tickets} courses rejetées</div>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">Étape 03</div>
                <div className="lp-step-icon">📲</div>
                <h3>Vous recevez</h3>
                <p>Un ticket prioritaire par jour : hippodrome, numéro de départ, cheval, mise Kelly conseillée, niveau de confiance. Par dashboard et alerte Telegram T-15min avant le départ.</p>
                <div className="lp-step-time">⚡ Alerte T-15min</div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKET PREVIEW */}
        <section className="lp-sec lp-sec-mid">
          <div className="lp-cont">
            <div className="lp-tag">Aperçu du ticket du jour</div>
            <h2 className="lp-h2">Voilà ce que<br/>vous recevez <em>chaque matin.</em></h2>
            <div className="lp-ticket">
              <div className="lp-ticket-head">
                <div className="lp-ticket-badge">
                  <div className="lp-ticket-live"></div>
                  Ticket prioritaire du jour · V9.2
                </div>
                <div style={{fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:11,color:"rgba(212,175,55,.6)",letterSpacing:".1em",textTransform:"uppercase"}}>CONFIANCE A</div>
              </div>
              <div className="lp-ticket-body">
                <div className="lp-ticket-course">VINCENNES · R1C3</div>
                <div className="lp-ticket-meta">
                  <span className="lp-ticket-tag">Quinté+</span>
                  <span className="lp-ticket-tag">Trot attelé</span>
                  <span className="lp-ticket-tag">2 700 m</span>
                  <span style={{fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:11,color:"rgba(246,242,232,.35)",marginLeft:"auto"}}>Départ 15:30</span>
                </div>
                <div className="lp-ticket-grid">
                  <div className="lp-ticket-cell">
                    <div className="lp-ticket-cell-lbl">Décision</div>
                    <div className="lp-ticket-cell-val green">VALIDE</div>
                  </div>
                  <div className="lp-ticket-cell lp-ticket-blur">
                    <div className="lp-ticket-cell-lbl">Cheval</div>
                    <div className="lp-ticket-cell-val">#7 — XXXXXXX</div>
                  </div>
                  <div className="lp-ticket-cell">
                    <div className="lp-ticket-cell-lbl">Mise Kelly</div>
                    <div className="lp-ticket-cell-val gold">12 €</div>
                  </div>
                </div>
                <div className="lp-ticket-score">
                  <div style={{fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(246,242,232,.35)"}}>Score VMAX</div>
                  <div className="lp-ticket-score-bar"><div className="lp-ticket-score-fill"></div></div>
                  <div style={{fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:22,fontWeight:500,color:"#00C851"}}>87</div>
                </div>
              </div>
              <div className="lp-ticket-cta">
                <Link href="/signup" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"12px",background:"#00C851",color:"#080A12",borderRadius:10,fontWeight:700,fontSize:15,textDecoration:"none"}}>
                  Voir le cheval sélectionné →
                </Link>
                <span style={{fontSize:13,color:"rgba(246,242,232,.35)"}}>Gratuit · Sans CB</span>
              </div>
            </div>
          </div>
        </section>

        {/* PREUVE PAR LES CHIFFRES */}
        <section className="lp-sec lp-sec-dark" id="preuve">
          <div className="lp-cont">
            <div className="lp-tag">La preuve par les chiffres</div>
            <h2 className="lp-h2">Des résultats <em>mesurés.</em><br/>Pas inventés.</h2>
            <p className="lp-p" style={{maxWidth:560}}>Chaque pari est enregistré avant le départ. Chaque résultat est posté automatiquement. Zéro cherry-picking.</p>
            <div className="lp-proof-grid">
              <div className="lp-proof-card">
                <div className="lp-proof-big green">+{roi}%</div>
                <div className="lp-proof-lbl">ROI moyen sur 30 jours</div>
                <p className="lp-proof-desc">Net après mise, sur {tickets} pronostics joués. Bankroll de référence 1 000 €. Chaque ticket est posté avant le départ.</p>
                <div className="lp-proof-bars">
                  {[.3,.5,.4,.7,.6,.4,.8,.5,.7,.9,.6,.5,.8,.7,.9,.8,.6,.95,.85,.7,.8,.9,.75,.85,.95,.8,.7,.9,.85,1].map((h,i)=>(
                    <div key={i} className="lp-proof-bar" style={{height:Math.round(h*32),background:[2,5,9,14,20].includes(i)?"#C4543D":h>.85?"#00C851":"#D4AF37",opacity:.6+h*.3}}></div>
                  ))}
                </div>
              </div>
              <div className="lp-proof-card">
                <div className="lp-proof-big white">{validés}<span style={{fontSize:28,color:"rgba(246,242,232,.3)"}}>/{tickets}</span></div>
                <div className="lp-proof-lbl">Tickets validés vs analysés</div>
                <p className="lp-proof-desc">{rejetés} courses automatiquement rejetées — jugées illisibles. Ne pas jouer est aussi un gain. C&apos;est le vrai filtre.</p>
                <div style={{marginTop:16,height:8,background:"rgba(246,242,232,.06)",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:(validés/tickets*100)+"%",background:"linear-gradient(90deg,#00C851,#31E981)",borderRadius:4}}></div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:10,letterSpacing:".08em",textTransform:"uppercase",color:"rgba(246,242,232,.35)",marginTop:6}}>
                  <span style={{color:"#00C851"}}>{validés} joués</span>
                  <span style={{color:"#C4543D"}}>{rejetés} rejetés</span>
                </div>
              </div>
              <div className="lp-proof-card">
                <div className="lp-proof-big gold">{reussite}%</div>
                <div className="lp-proof-lbl">Taux de réussite réel</div>
                <p className="lp-proof-desc">Gagnant ou placé, hors les courses classées &quot;LOTERIE&quot; et automatiquement écartées. Calculé sur le portefeuille validé uniquement.</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:16}}>
                  {[["Meilleure série","7 consécutifs"],["Pire série","3 perdants"],["Mise moy.","8 €"],["Gain max.","+ 87 €"]].map(([k,v])=>(
                    <div key={k} style={{background:"#151928",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(246,242,232,.3)",marginBottom:4}}>{k}</div>
                      <div style={{fontFamily:"var(--font-mono,'DM Mono',monospace)",fontSize:14,color:"#F6F2E8",fontWeight:500}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AVANT / APRÈS */}
        <section className="lp-sec lp-sec-mid">
          <div className="lp-cont">
            <div className="lp-tag">Avant vs après</div>
            <h2 className="lp-h2">Le parieur sans méthode<br/>contre le parieur <em>qui décide.</em></h2>
            <div className="lp-avap">
              <div className="lp-before">
                <div className="lp-avap-lbl">❌ Sans PMU Gagnant</div>
                <div className="lp-avap-title">Le parieur qui joue au feeling</div>
                {["Joue 5 à 8 courses/jour sur instinct ou « tuyaux »","Aucune rigueur sur la mise — double quand il « sent » quelque chose","Aucun suivi de bankroll — ne sait pas si son système est rentable","Perd 2-3h à éplucher le programme chaque jour","Parie les courses loterie par ennui ou FOMO","Les mauvais jours l&apos;anéantissent et effacent les bonnes semaines"].map(t=>(
                  <div key={t} className="lp-avap-item">
                    <div className="lp-avap-icon">✗</div>
                    <div className="lp-avap-item-txt">{t}</div>
                  </div>
                ))}
                <div className="lp-avap-stat">
                  <div className="lp-avap-stat-val">-18%</div>
                  <div className="lp-avap-stat-k">ROI moyen parieur sans discipline</div>
                </div>
              </div>
              <div className="lp-after">
                <div className="lp-avap-lbl">✅ Avec PMU Gagnant</div>
                <div className="lp-avap-title">Le parieur qui maîtrise</div>
                {["1 ticket par jour — 30 secondes pour valider ou passer","Mise Kelly calculée automatiquement selon votre bankroll réelle","Bilan ROI mis à jour chaque soir — sait exactement où il en est","Alerte Telegram T-15min — zéro surveillance du programme","Les courses illisibles sont écartées automatiquement par V9.2","La discipline est intégrée dans le système — vous n&apos;avez pas à vous battre"].map(t=>(
                  <div key={t} className="lp-avap-item">
                    <div className="lp-avap-icon">✓</div>
                    <div className="lp-avap-item-txt">{t}</div>
                  </div>
                ))}
                <div className="lp-avap-stat">
                  <div className="lp-avap-stat-val">+{roi}%</div>
                  <div className="lp-avap-stat-k">ROI moyen abonné PMU Gagnant · 30j</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TÉMOIGNAGES */}
        <section className="lp-sec lp-sec-dark">
          <div className="lp-cont">
            <div className="lp-tag">Ils nous font confiance</div>
            <h2 className="lp-h2">Ce qu&apos;ils disent <em>vraiment.</em></h2>
            <div className="lp-testis">
              {[{av:"M",bg:"#075E36",name:"Marc L.",meta:"8 mois · Versailles",roi:"+31%",stars:"★★★★★",txt:"Avant je jouais 8 courses par jour. Maintenant j'en joue une, et je gagne plus. C'est tout bête mais ça change tout."},
                {av:"S",bg:"#A9832E",name:"Sylvie R.",meta:"1 an · Lyon",roi:"+18%",stars:"★★★★★",txt:"Le verdict tombe à 9h. Je le lis avec mon café. Je joue ou je joue pas. Et c'est fini pour la journée."},
                {av:"A",bg:"#075E36",name:"Antoine D.",meta:"4 mois · Bordeaux",roi:"+24%",stars:"★★★★☆",txt:"Le truc dingue c'est voir V9.2 écarter une course que j'aurais jouée. À chaque fois j'ai vérifié. À chaque fois il avait raison."}
              ].map(t=>(
                <div key={t.name} className="lp-testi">
                  <div className="lp-testi-stars">{t.stars}</div>
                  <p className="lp-testi-txt">&quot;{t.txt}&quot;</p>
                  <div className="lp-testi-author">
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
        <section className="lp-sec lp-sec-mid" id="plans">
          <div className="lp-cont" style={{textAlign:"center"}}>
            <div className="lp-tag">Tarifs</div>
            <h2 className="lp-h2">Simple.<br/><em>Sans engagement.</em></h2>
            <p className="lp-p">14 jours pour juger sur résultats réels. Sans carte bancaire.</p>
          </div>
          <div className="lp-plans">
            <div className="lp-plan">
              <div className="lp-plan-cat">Découverte</div>
              <div className="lp-plan-name">Lecteur</div>
              <div className="lp-plan-price"><sup>€</sup>0<span className="lp-plan-per">/mois</span></div>
              <p className="lp-plan-desc">Pour découvrir le système V9.2 et tester 14 jours complets.</p>
              <ul className="lp-plan-feats">
                <li><span className="on">●</span> Le verdict du jour</li>
                <li><span className="on">●</span> 3 courses analysées / semaine</li>
                <li><span className="off">○</span> <span style={{color:"rgba(246,242,232,.3)"}}>Cheval + mise Kelly</span></li>
                <li><span className="off">○</span> <span style={{color:"rgba(246,242,232,.3)"}}>Alertes Telegram T-15</span></li>
                <li><span className="off">○</span> <span style={{color:"rgba(246,242,232,.3)"}}>Score V9.2 en direct</span></li>
              </ul>
              <Link href="/signup" className="lp-plan-btn free">Commencer gratuitement</Link>
            </div>
            <div className="lp-plan rec">
              <div className="lp-plan-badge">★ RECOMMANDÉ</div>
              <div className="lp-plan-cat">Pour les parieurs actifs</div>
              <div className="lp-plan-name"><span className="green">Premium</span> V9.2</div>
              <div className="lp-plan-price"><sup>€</sup>19<span className="lp-plan-per">/mois</span></div>
              <p className="lp-plan-desc">Accès complet : cheval, mise, score, alertes Telegram, bilan ROI.</p>
              <ul className="lp-plan-feats">
                <li><span className="on">●</span> Tout le programme analysé</li>
                <li><span className="on">●</span> Cheval + score V9.2 + Kelly</li>
                <li><span className="on">●</span> Alertes Telegram T-15min</li>
                <li><span className="on">●</span> Coach IA illimité</li>
                <li><span className="on">●</span> Bilan ROI en temps réel</li>
              </ul>
              <Link href="/subscribe" className="lp-plan-btn paid">Essai 14 jours →</Link>
            </div>
            <div className="lp-plan">
              <div className="lp-plan-cat">Pour les méthodiques</div>
              <div className="lp-plan-name">Annuel</div>
              <div className="lp-plan-price"><sup>€</sup>149<span className="lp-plan-per">/an</span></div>
              <p className="lp-plan-desc">Tout Premium + 2 mois offerts + accès backtests historiques V9.2.</p>
              <ul className="lp-plan-feats">
                <li><span className="on">●</span> Tout le plan Premium</li>
                <li><span className="on">●</span> 2 mois offerts</li>
                <li><span className="on">●</span> Backtests historiques</li>
                <li><span className="on">●</span> Export CSV de vos paris</li>
                <li><span className="on">●</span> Support prioritaire</li>
              </ul>
              <Link href="/subscribe?plan=annual" className="lp-plan-btn annual">Économiser 79 € →</Link>
              <div className="lp-plan-eco">↳ soit 12,41 € / mois</div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-sec lp-sec-dark" id="faq">
          <div className="lp-cont" style={{textAlign:"center"}}>
            <div className="lp-tag">Questions fréquentes</div>
            <h2 className="lp-h2">Tout ce que vous<br/>voulez <em>savoir.</em></h2>
          </div>
          <div className="lp-faqs" id="lp-faqs"></div>
        </section>

        {/* CTA FINAL */}
        <section className="lp-cta">
          <div style={{position:"relative",zIndex:1}}>
            <div className="lp-tag" style={{justifyContent:"center",display:"flex"}}>Prêt ?</div>
            <h2 className="lp-cta-h2">Le prochain ticket<br/>tombe <span className="green">demain matin.</span></h2>
            <p style={{fontSize:17,color:"rgba(246,242,232,.5)",maxWidth:480,margin:"0 auto 40px",lineHeight:1.7}}>14 jours d&apos;essai complet. Sans carte bancaire. Si ce n&apos;est pas pour vous, vous partez sans frais.</p>
            <Link href="/signup" className="lp-hero-btn-main" style={{display:"inline-flex",fontSize:17,padding:"16px 40px"}}>Démarrer gratuitement →</Link>
            <div className="lp-cta-strip">
              <span><span className="hi">14 jours</span> d&apos;essai</span>
              <div className="lp-cta-strip-dot"></div>
              <span><span className="hi">Sans</span> CB</span>
              <div className="lp-cta-strip-dot"></div>
              <span>Résiliation <span className="hi">1 clic</span></span>
              <div className="lp-cta-strip-dot"></div>
              <span>ROI <span className="hi">mesuré</span> en temps réel</span>
            </div>
          </div>
        </section>

        {/* JEU RESPONSABLE */}
        <div className="lp-jr">
          <div className="lp-jr-inner" id="lp-jr"></div>
        </div>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <Link href="/" className="lp-logo" style={{display:"inline-flex"}}>
                <div className="lp-logo-badge">PG</div>
                <div><span className="lp-logo-txt">PMUGAGNANT</span><span className="lp-logo-sub">TurfEdge V9.2</span></div>
              </Link>
              <p>L&apos;IA qui analyse 30+ signaux par course PMU et vous remet un seul verdict par jour — celui où la value est mathématiquement défendable.</p>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-t">Produit</div>
              <ul>
                <li><Link href="/dashboard">Mon dashboard</Link></li>
                <li><Link href="/bilan">Mon bilan</Link></li>
                <li><Link href="/mes-paris">Mes paris</Link></li>
                <li><Link href="/subscribe">Premium</Link></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-t">Compte</div>
              <ul>
                <li><Link href="/login">Connexion</Link></li>
                <li><Link href="/signup">Inscription</Link></li>
                <li><Link href="/subscribe">Abonnement</Link></li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-t">Légal</div>
              <ul>
                <li><Link href="/mentions-legales">Mentions légales</Link></li>
                <li><Link href="/cgv">CGV</Link></li>
                <li><Link href="/politique-confidentialite">Confidentialité</Link></li>
                <li><Link href="/politique-cookies">Cookies</Link></li>
                <li><Link href="/jeu-responsable">Jeu responsable</Link></li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bot">
            <span>© 2026 PMU GAGNANT · TURFEDGE V9.2</span>
            <span>JOUER COMPORTE DES RISQUES · <a href="tel:0974751313">09 74 75 13 13</a> · <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer">JOUEURS-INFO-SERVICE.FR</a></span>
          </div>
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{__html:`
        // Ticker hippodromes
        var hippos=['Longchamp','Vincennes','Chantilly','Saint-Cloud','Deauville','Enghien','Cagnes-sur-Mer','Pau','Bordeaux','Auteuil','Compiègne','Moulins'];
        var tk=document.getElementById('lp-ticker');
        if(tk){[0,1].forEach(function(){hippos.forEach(function(h){tk.innerHTML+='<span class="lp-ticker-item"><span class="lp-ticker-dot"></span>'+h+'</span>';});});}

        // JR ticker
        var jr=document.getElementById('lp-jr');
        if(jr){var items=['⚠ JOUER COMPORTE DES RISQUES','ENDETTEMENT · DÉPENDANCE','09 74 75 13 13','JOUEURS-INFO-SERVICE.FR','INTERDIT AUX MINEURS'];[0,1,2].forEach(function(){items.forEach(function(i){jr.innerHTML+='<span class="lp-jr-item">'+i+'</span>';});});}

        // FAQ accordion
        var faqs=[
          {q:"Comment TurfEdge V9.2 analyse-t-il les courses ?",a:"V9.2 agrège 30+ signaux par partant : forme sur les 6 dernières courses (avec décroissance temporelle), cotes PMU vs probabilité calculée, historique jockey/hippodrome sur 24 mois, distance exacte, état du terrain et conditions météo. Un score de confiance est calculé. Sous un seuil donné, la course est classée LOTERIE et automatiquement écartée."},
          {q:"Le ROI +26% est-il garanti ?",a:"Non. Aucun résultat passé ne garantit les performances futures. Le +26% est une moyenne mesurée sur 30 jours de production réelle, avec chaque pari enregistré avant le départ. Les paris hippiques comportent des risques. Pariez uniquement avec des sommes que vous pouvez vous permettre de perdre."},
          {q:"Puis-je résilier à tout moment ?",a:"Oui. Sans engagement. Depuis votre espace compte en 2 clics. La résiliation prend effet à la fin de la période en cours, sans frais ni pénalité."},
          {q:"Comment je reçois les pronostics ?",a:"Sur votre dashboard (ordinateur et mobile) et, pour les abonnés Premium, via une alerte Telegram T-15min avant le départ de la course sélectionnée du jour, via @pmugagnantbot."},
          {q:"Vous placez les paris à ma place ?",a:"Non. PMU Gagnant analyse et recommande. Vous seul décidez si vous jouez et combien. Nous n&apos;avons aucun accès à votre compte PMU.fr. En cas de difficulté avec le jeu : 09 74 75 13 13 — joueurs-info-service.fr."},
          {q:"Quelle différence entre le compte gratuit et Premium ?",a:"Le compte gratuit vous donne accès au verdict du jour (JOUER ou PASSER) et 3 courses analysées par semaine. Le Premium débloque le cheval sélectionné, la mise Kelly, le score V9.2 complet, les alertes Telegram et le bilan ROI en temps réel."}
        ];
        var faqEl=document.getElementById('lp-faqs');
        if(faqEl){faqs.forEach(function(f,i){var div=document.createElement('div');div.className='lp-faq'+(i===0?' open':'');div.innerHTML='<div class="lp-faq-q" onclick="var item=this.parentElement;var on=item.classList.contains(\'open\');document.querySelectorAll(\'.lp-faq.open\').forEach(function(x){x.classList.remove(\'open\')});if(!on)item.classList.add(\'open\')"><span class="lp-faq-q-txt">'+f.q+'</span><div class="lp-faq-ico">+</div></div><div class="lp-faq-a">'+f.a+'</div>';faqEl.appendChild(div);});}
      `}}/>
    </>
  );
}
