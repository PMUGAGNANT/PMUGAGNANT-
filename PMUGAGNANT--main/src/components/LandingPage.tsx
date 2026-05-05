"use client";

import { useEffect } from "react";
import Link from "next/link";

type W = Window & {
  ckDismiss?: (v: string) => void;
  setProfil?: (p: string) => void;
  updateSim?: () => void;
  updateVmax?: () => void;
  toggleFaq?: (el: HTMLElement) => void;
};

export default function LandingPage() {
  useEffect(() => {
    const w = window as W;

    // Cookie
    if (localStorage.getItem("ck"))
      document.getElementById("ck")?.classList.add("gone");
    w.ckDismiss = (v) => {
      localStorage.setItem("ck", v);
      document.getElementById("ck")?.classList.add("gone");
    };

    // Nav scroll
    const onScroll = () => {
      const nav = document.getElementById("nav");
      if (nav)
        nav.style.background =
          window.scrollY > 60 ? "rgba(10,10,10,.97)" : "rgba(10,10,10,.9)";
    };
    window.addEventListener("scroll", onScroll);

    // Live time
    const updateTime = () => {
      const n = new Date();
      const t = n.toTimeString().slice(0, 5);
      const ts = n.toTimeString().slice(0, 8);
      const e1 = document.getElementById("lt");
      const e2 = document.getElementById("st");
      if (e1) e1.textContent = t;
      if (e2) e2.textContent = ts;
    };
    updateTime();
    const timeInt = setInterval(updateTime, 1000);

    // Countdown
    const tgt = new Date();
    tgt.setMinutes(tgt.getMinutes() < 30 ? 30 : 60, 0, 0);
    if (tgt <= new Date()) tgt.setHours(tgt.getHours() + 1);
    const updateCt = () => {
      const diff = Math.max(0, tgt.getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const el = document.getElementById("ctdown");
      if (el)
        el.innerHTML = `${h.toString().padStart(2, "0")}:<span style="opacity:.35">${m.toString().padStart(2, "0")}</span>:${s.toString().padStart(2, "0")}`;
    };
    updateCt();
    const ctInt = setInterval(updateCt, 1000);

    // ROI bars
    const barsData = [.3,.5,.4,.7,.6,.4,.8,.5,.7,.9,.6,.5,.8,.7,.9,.8,.6,.95,.85,.7,.8,.9,.75,.85,.95,.8,.7,.9,.85,1];
    const lossIdx = [2,5,9,14,20];
    const rbEl = document.getElementById("rb");
    if (rbEl) {
      barsData.forEach((h, i) => {
        const b = document.createElement("div");
        b.style.cssText = `flex:1;border-radius:3px 3px 0 0;height:${Math.round(h * 56)}px;background:${lossIdx.includes(i) ? "#FF4D5A" : h > .85 ? "#00FF87" : "#D4AF37"};opacity:${.5 + h * .3}`;
        rbEl.appendChild(b);
      });
    }

    // Ticker
    const hippos = ["Longchamp","Vincennes","Chantilly","Saint-Cloud","Deauville","Enghien","Cagnes-sur-Mer","Pau","Bordeaux","Lyon-Parilly","Auteuil","Compiègne"];
    const tickerEl = document.getElementById("ticker");
    if (tickerEl) {
      [0,1].forEach(() => hippos.forEach(n => {
        tickerEl.innerHTML += `<span style="display:inline-flex;align-items:center;gap:10px;padding:0 28px;font-family:'DM Mono',monospace;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(245,240,232,.45)"><span style="width:4px;height:4px;border-radius:50%;background:#D4AF37;opacity:.5;display:inline-block"></span>${n}</span>`;
      }));
    }

    // JR ticker
    const jrEl = document.getElementById("jr");
    if (jrEl) {
      const items = ["⚠ JOUER COMPORTE DES RISQUES","ENDETTEMENT · DÉPENDANCE","APPELEZ LE 09 74 75 13 13","JOUEURS-INFO-SERVICE.FR","INTERDIT AUX MINEURS"];
      [0,1,2].forEach(() => items.forEach(j => {
        jrEl.innerHTML += `<span style="display:inline-flex;align-items:center;gap:10px;padding:13px 28px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.28)">${j}</span>`;
      }));
    }

    // Quinté horses
    const qHorses = [
      {num:7,name:"Espoir de Berlais",driver:"F. Nivard · 4.2x",score:87,tags:["VALIDE","PRIORITÉ"],kelly:"12 €",tier:"A",edge:"+18%"},
      {num:3,name:"Kalaïa d'Argent",driver:"A. Abrivard · 7.8x",score:79,tags:["VALIDE"],kelly:"7 €",tier:"B",edge:"+24%"},
      {num:11,name:"Quartz du Chenet",driver:"É. Raffin · 3.1x",score:71,tags:["SURVEILLANCE"],kelly:"4 €",tier:"C",edge:"+11%"},
      {num:9,name:"Bold Eagle II",driver:"B. Hernandez · 5.5x",score:63,tags:[],kelly:"—",tier:"—",edge:"+3%"},
      {num:2,name:"Readly Express",driver:"A. Conte · 6.2x",score:58,tags:[],kelly:"—",tier:"—",edge:"-5%"},
    ];
    const qhEl = document.getElementById("qh");
    if (qhEl) {
      qHorses.forEach((h, i) => {
        const dim = i > 2;
        const tagHtml = h.tags.map(t => {
          const color = t === "VALIDE" ? "#00FF87" : t === "PRIORITÉ" ? "#D4AF37" : "#4DC8FF";
          return `<span style="padding:2px 7px;border-radius:4px;font-family:'DM Mono',monospace;font-size:9px;background:${color}18;color:${color};border:1px solid ${color}28;text-transform:uppercase;letter-spacing:.08em">${t}</span>`;
        }).join("");
        qhEl.innerHTML += `<div style="display:grid;grid-template-columns:1fr 90px 70px 80px;align-items:center;padding:13px 20px;border-bottom:1px solid rgba(212,175,55,.05);opacity:${dim ? .4 : 1}">
          <div style="display:flex;align-items:center;gap:11px">
            <div style="width:28px;height:28px;border-radius:6px;background:#161616;border:1px solid rgba(212,175,55,.14);display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:#F5F0E8">${h.num}</div>
            <div><div style="font-family:'Cormorant Garamond',serif;font-size:17px;font-style:italic;color:#F5F0E8">${h.name}</div><div style="font-family:'DM Mono',monospace;font-size:10px;color:rgba(245,240,232,.45)">${h.driver}</div><div style="display:flex;gap:5px;margin-top:3px">${tagHtml}</div></div>
          </div>
          <div><div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:500;color:#F5F0E8">${h.score}</div><div style="height:3px;background:rgba(212,175,55,.14);border-radius:2px;margin-top:4px"><div style="height:100%;width:${h.score}%;border-radius:2px;background:${h.score>80?"#D4AF37":h.score>65?"rgba(212,175,55,.5)":"rgba(255,255,255,.1)"}"></div></div></div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:${h.edge.includes("-")?"#FF4D5A":"#00FF87"}">${h.edge.includes("-")?"▼":"▲"} ${h.edge}</div>
          <div style="text-align:right"><div style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600;color:#F5F0E8">${h.kelly}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:rgba(245,240,232,.45)">KELLY · ${h.tier}</div></div>
        </div>`;
      });
    }

    // Top 3
    const top3Data = [
      {h:"Vincennes",num:"R1C3",heure:"15:30",horse:"Espoir de Berlais",type:"Trot attelé · 2700m",cote:"4.2",score:87,verdict:"PRIORITÉ",vcolor:"#D4AF37",kelly:"12 €",edge:"+18%",quinte:true},
      {h:"Longchamp",num:"R2C5",heure:"14:10",horse:"Waldgeist II",type:"Plat · 1600m",cote:"3.8",score:82,verdict:"VALIDE",vcolor:"#00FF87",kelly:"10 €",edge:"+14%",quinte:false},
      {h:"Chantilly",num:"R3C4",heure:"16:45",horse:"Master Dino",type:"Haies · 3200m",cote:"5.1",score:74,verdict:"VALIDE",vcolor:"#00FF87",kelly:"7 €",edge:"+9%",quinte:false},
    ];
    const t3El = document.getElementById("top3c");
    if (t3El) {
      top3Data.forEach((c, i) => {
        t3El.innerHTML += `<div style="background:#161616;border:1px solid ${i===0?"rgba(212,175,55,.3)":"rgba(212,175,55,.14)"};border-radius:16px;padding:26px;position:relative;overflow:hidden;transition:transform .2s" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform=''">
          ${c.quinte ? `<div style="position:absolute;top:14px;right:14px;padding:3px 10px;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.25);border-radius:100px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;color:#D4AF37;text-transform:uppercase">Quinté+</div>` : ""}
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(245,240,232,.45);margin-bottom:10px">${c.h} · ${c.num} · ${c.heure}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;font-style:italic;color:#F5F0E8;margin-bottom:6px">${c.horse}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:rgba(245,240,232,.45);margin-bottom:18px">${c.type} · Cote ${c.cote}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(212,175,55,.1);border-bottom:1px solid rgba(212,175,55,.1);margin-bottom:12px">
            <div><div style="font-family:'DM Mono',monospace;font-size:20px;color:#D4AF37;font-weight:500">${c.score}</div><div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,240,232,.45)">Score VMAX</div></div>
            <div style="padding:3px 10px;border-radius:5px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;background:${c.vcolor}18;color:${c.vcolor};border:1px solid ${c.vcolor}28">${c.verdict}</div>
            <div style="text-align:right"><div style="font-family:'Cormorant Garamond',serif;font-size:20px;color:#F5F0E8">${c.kelly}</div><div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,240,232,.45)">Mise Kelly</div></div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="font-family:'DM Mono',monospace;font-size:11px;color:#00FF87">▲ Edge ${c.edge}</div>
            <a href="/signup" style="font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;color:#D4AF37;text-decoration:none">Analyse →</a>
          </div>
        </div>`;
      });
    }

    // Résultats d'hier
    const resData = [
      {h:"11:15",hip:"Saint-Cloud",race:"R1C2",horse:"Brametot",cote:"2.9",mise:8,gain:"+15.2 €",win:true,score:81},
      {h:"13:40",hip:"Vincennes",race:"R1C5",horse:"Idao de Tillard",cote:"5.4",mise:6,gain:"+26.4 €",win:true,score:76},
      {h:"15:30",hip:"Chantilly",race:"R2C3",horse:"Enable II",cote:"1.8",mise:12,gain:"-12 €",win:false,score:88},
      {h:"17:00",hip:"Longchamp",race:"R3C6",horse:"Magic Wand",cote:"6.2",mise:7,gain:"+32.4 €",win:true,score:72},
    ];
    const rlEl = document.getElementById("rl");
    if (rlEl) {
      resData.forEach(r => {
        rlEl.innerHTML += `<div style="background:#111;border-left:3px solid ${r.win?"#00FF87":"#FF4D5A"};border-radius:12px;padding:16px 22px;display:grid;grid-template-columns:90px 1fr 70px 80px 100px;align-items:center;gap:16px;margin-bottom:2px">
          <div style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,240,232,.45);line-height:1.5">${r.h}<br/>${r.hip}<br/>${r.race}</div>
          <div><div style="font-family:'Cormorant Garamond',serif;font-size:19px;font-style:italic;color:#F5F0E8">${r.horse}</div><div style="font-family:'DM Mono',monospace;font-size:10px;color:rgba(245,240,232,.45)">Cote ${r.cote} · Score ${r.score}</div></div>
          <div style="text-align:center"><div style="font-family:'DM Mono',monospace;font-size:13px;color:#F5F0E8">${r.mise} €</div><div style="font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;color:rgba(245,240,232,.45)">Mise</div></div>
          <div style="text-align:center;padding:4px 10px;border-radius:6px;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;background:${r.win?"rgba(0,255,135,.1)":"rgba(255,77,90,.1)"};color:${r.win?"#00FF87":"#FF4D5A"};border:1px solid ${r.win?"rgba(0,255,135,.18)":"rgba(255,77,90,.18)"}">${r.win?"GAGNÉ":"PERDU"}</div>
          <div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:500;text-align:right;color:${r.win?"#00FF87":"#FF4D5A"}">${r.gain}</div>
        </div>`;
      });
    }

    // Simulateur ROI
    const profils: Record<string, {roi:number,mise:number,tickets:number}> = {
      prudent:{roi:.18,mise:.05,tickets:18},
      standard:{roi:.26,mise:.08,tickets:22},
      agressif:{roi:.36,mise:.12,tickets:28},
    };
    let currentProfil = "prudent";

    w.setProfil = (p) => {
      currentProfil = p;
      ["prudent","standard","agressif"].forEach(pp => {
        const btn = document.getElementById("p-"+pp) as HTMLButtonElement|null;
        if (btn) {
          btn.style.borderColor = pp===p?"#D4AF37":"rgba(212,175,55,.14)";
          btn.style.background = pp===p?"rgba(212,175,55,.1)":"transparent";
          btn.style.color = pp===p?"#D4AF37":"rgba(245,240,232,.45)";
        }
      });
      w.updateSim?.();
    };

    w.updateSim = () => {
      const bk = parseInt((document.getElementById("sim-bankroll") as HTMLInputElement)?.value||"1000");
      const mo = parseInt((document.getElementById("sim-period") as HTMLInputElement)?.value||"3");
      const pr = profils[currentProfil];
      const gain = Math.round(bk * Math.pow(1+pr.roi, mo) - bk);
      const final = bk + gain;
      const mise = Math.round(bk * pr.mise);
      const set = (id:string,val:string)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
      const bkEl=document.getElementById("sim-bv");if(bkEl)bkEl.textContent=bk.toLocaleString("fr-FR")+" €";
      const pvEl=document.getElementById("sim-pv");if(pvEl)pvEl.textContent=mo+" mois";
      const plEl=document.getElementById("sim-period-lbl");if(plEl)plEl.textContent=mo+" mois";
      const gEl=document.getElementById("sim-gain");if(gEl)gEl.innerHTML=`<sup>+</sup>${gain.toLocaleString("fr-FR")}<sup>€</sup>`;
      set("sim-final",final.toLocaleString("fr-FR")+" €");
      set("sim-tickets","~"+pr.tickets);
      set("sim-mise",mise+" €");
      set("sim-roi",Math.round(pr.roi*100)+"%");
    };
    w.updateSim();

    // VMAX Demo
    w.updateVmax = () => {
      const vals=[1,2,3,4].map(i=>parseInt((document.getElementById("c"+i) as HTMLInputElement)?.value||"0"));
      const total=vals.reduce((a,b)=>a+b,0);
      vals.forEach((v,i)=>{
        const numEl=document.getElementById("c"+(i+1)+"v");if(numEl)numEl.textContent=String(v);
        const fillEl=document.getElementById("c"+(i+1)+"f");if(fillEl)fillEl.style.width=(v/25*100)+"%";
        const bEl=document.getElementById("vb"+(i+1));if(bEl)bEl.textContent=v+"/25";
      });
      const numEl=document.getElementById("score-num");
      if(numEl){numEl.textContent=String(total);numEl.style.color=total>=80?"#00FF87":total>=65?"#D4AF37":"#FF4D5A";}
      const totEl=document.getElementById("vb-total");if(totEl)totEl.textContent=total+"/100";
      const arc=document.getElementById("score-arc");
      if(arc){const circ=2*Math.PI*76;arc.setAttribute("stroke-dashoffset",String(circ-(circ*total/100)));arc.style.stroke=total>=80?"#00FF87":total>=65?"#D4AF37":"#FF4D5A";}
      const dec=total>=80?"VALIDE ✓":total>=65?"SURVEILLANCE ·":total>=50?"BORDERLINE":"ÉCARTÉ ✗";
      const sub=total>=80?"Course lisible — Value positive détectée":total>=65?"À surveiller — Lisibilité partielle":total>=50?"Course incertaine — Peu recommandé":"Course illisible — VMAX ne joue pas";
      const decEl=document.getElementById("vd-decision");if(decEl){decEl.textContent=dec;decEl.style.color=total>=80?"#00FF87":total>=65?"#D4AF37":"#FF4D5A";}
      const subEl=document.getElementById("vd-sub");if(subEl)subEl.textContent=sub;
    };

    // FAQ
    w.toggleFaq = (el) => {
      const item=el.parentElement;if(!item)return;
      const isOn=item.classList.contains("on");
      document.querySelectorAll(".fi.on").forEach(x=>x.classList.remove("on"));
      if(!isOn)item.classList.add("on");
    };

    // Compteurs animés
    let counted=false;
    const counterEls=document.querySelectorAll(".counter");
    const animCounters=()=>{
      if(counted)return;counted=true;
      counterEls.forEach(el=>{
        const target=parseInt((el as HTMLElement).dataset.target||"0");
        const suffix=(el as HTMLElement).dataset.suffix||"";
        let current=0;const step=target/60;
        const interval=setInterval(()=>{current+=step;if(current>=target){current=target;clearInterval(interval);}el.textContent=Math.floor(current)+suffix;},16);
      });
    };
    const chiffresSec=document.getElementById("chiffres");
    if(chiffresSec)new IntersectionObserver(entries=>{if(entries[0].isIntersecting)animCounters();},{threshold:.3}).observe(chiffresSec);

    // Notifications live
    const notifUsers=[
      {name:"Thomas M.",bg:"#2D5A8E",action:"vient de rejoindre PMU Gagnant",city:"Paris",amount:""},
      {name:"Rachid B.",bg:"#8E4A2D",action:"a reçu son alerte Telegram",city:"Marseille",amount:""},
      {name:"Marc L.",bg:"#2D5A8E",action:"vient de gagner",city:"Versailles",amount:"+37.2 €"},
      {name:"Nathalie C.",bg:"#7A2D8E",action:"passe à l'abonnement Premium",city:"Lyon",amount:""},
      {name:"Karim D.",bg:"#2D8E6A",action:"vient de gagner",city:"Bordeaux",amount:"+52.8 €"},
    ];
    const notifContainer=document.getElementById("notif");
    let notifIdx=0;
    const showNotif=(u:typeof notifUsers[0])=>{
      if(!notifContainer)return;
      const card=document.createElement("div");
      card.style.cssText="background:#111;border:1px solid rgba(212,175,55,.14);border-left:3px solid #00FF87;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;font-size:13px;color:#F5F0E8;min-width:280px;max-width:320px;transform:translateX(120%);transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .4s;opacity:0;margin-bottom:8px;box-shadow:0 8px 32px rgba(0,0,0,.4)";
      const initials=u.name.split(" ").map(p=>p[0]).join("");
      card.innerHTML=`<div style="width:34px;height:34px;border-radius:50%;background:${u.bg};display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#fff;flex-shrink:0">${initials}</div><div style="flex:1"><div style="font-weight:500">${u.name}</div><div style="color:rgba(245,240,232,.45);font-size:12px">${u.action} · ${u.city}</div><div style="color:rgba(245,240,232,.3);font-size:11px">Il y a ${Math.floor(Math.random()*4)+1} minutes</div></div>${u.amount?`<div style="font-family:'DM Mono',monospace;font-size:13px;color:#00FF87;font-weight:500;flex-shrink:0">${u.amount}</div>`:""}`;
      notifContainer.appendChild(card);
      requestAnimationFrame(()=>{card.style.transform="translateX(0)";card.style.opacity="1";});
      setTimeout(()=>{card.style.transform="translateX(120%)";card.style.opacity="0";setTimeout(()=>{if(notifContainer.contains(card))notifContainer.removeChild(card);},400);},4500);
    };
    const scheduleNotif=()=>{showNotif(notifUsers[notifIdx%notifUsers.length]);notifIdx++;setTimeout(scheduleNotif,Math.random()*8000+7000);};
    setTimeout(scheduleNotif,4000);

    return ()=>{window.removeEventListener("scroll",onScroll);clearInterval(timeInt);clearInterval(ctInt);};
  },[]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        :root{--gold:#D4AF37;--gold-l:#F0D060;--green:#00FF87;--red:#FF4D5A;--blue:#4DC8FF;--bg:#0A0A0A;--bg2:#111111;--bg3:#161616;--border:rgba(212,175,55,.14);--text:#F5F0E8;--muted:rgba(245,240,232,.45)}
        .lp *,.lp *::before,.lp *::after{box-sizing:border-box;margin:0;padding:0}
        .lp{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.6;overflow-x:hidden;min-height:100vh}
        #notif{position:fixed;top:80px;right:24px;z-index:2000;display:flex;flex-direction:column;gap:10px;pointer-events:none;align-items:flex-end}
        #ck{position:fixed;bottom:0;left:0;right:0;background:#111;border-top:1px solid var(--border);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;z-index:9999;font-size:13px;color:var(--muted);transition:transform .4s}
        #ck.gone{transform:translateY(110%)}
        #ck a{color:var(--gold);text-decoration:none}
        .ck-b{padding:8px 18px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .2s}
        .ck-b.y{background:var(--gold);color:#000}.ck-b.y:hover{background:var(--gold-l)}
        .ck-b.n{background:transparent;color:var(--muted);border:1px solid rgba(255,255,255,.12)}.ck-b.n:hover{color:var(--text)}
        #nav{position:fixed;top:0;left:0;right:0;z-index:1000;display:flex;align-items:center;justify-content:space-between;padding:0 44px;height:68px;background:rgba(10,10,10,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);transition:background .3s}
        .nlogo{display:flex;align-items:center;gap:10px;text-decoration:none}
        .nlogo-ic{width:34px;height:34px;background:var(--gold);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:17px;color:#000}
        .nlogo-txt{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:600;color:var(--text)}
        .nlogo-sub{display:block;font-family:'DM Mono',monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:-3px}
        .nlinks{display:flex;align-items:center;gap:4px;list-style:none}
        .nlinks a{padding:7px 15px;border-radius:8px;font-size:14px;color:var(--muted);text-decoration:none;transition:all .2s}
        .nlinks a:hover,.nlinks a.on{color:var(--text);background:rgba(255,255,255,.05)}
        .nlinks a.on{background:rgba(212,175,55,.1);color:var(--gold)}
        .ncta{display:flex;align-items:center;gap:10px}
        .btn-ghost{padding:8px 18px;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:14px;cursor:pointer;text-decoration:none;transition:all .2s;display:inline-flex;align-items:center}
        .btn-ghost:hover{border-color:var(--gold);color:var(--gold)}
        .btn-gold{padding:9px 20px;border-radius:9px;background:var(--gold);color:#000;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
        .btn-gold:hover{background:var(--gold-l);transform:translateY(-1px)}
        .hero{min-height:100vh;padding:100px 44px 80px;display:grid;grid-template-columns:1fr 430px;gap:60px;align-items:center;max-width:1300px;margin:0 auto}
        .h-eye{display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 8px;background:rgba(212,175,55,.07);border:1px solid rgba(212,175,55,.2);border-radius:100px;font-family:'DM Mono',monospace;font-size:10.5px;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;margin-bottom:28px}
        .h-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s ease infinite}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        .hero-t{font-family:'Cormorant Garamond',serif;font-size:clamp(54px,6.5vw,92px);font-weight:300;line-height:.94;letter-spacing:-.03em;color:var(--text);margin-bottom:30px}
        .hero-t em{font-style:italic;color:var(--gold)}
        .hero-sub{font-size:17px;color:var(--muted);line-height:1.75;max-width:520px;margin-bottom:40px}
        .hero-sub strong{color:var(--text);font-weight:500}
        .hctas{display:flex;align-items:center;gap:12px;margin-bottom:48px;flex-wrap:wrap}
        .btn-lg{padding:14px 30px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .25s;display:inline-flex;align-items:center;gap:8px}
        .btn-lg.p{background:var(--gold);color:#000}.btn-lg.p:hover{background:var(--gold-l);transform:translateY(-2px);box-shadow:0 14px 40px rgba(212,175,55,.22)}
        .btn-lg.s{border:1px solid var(--border);color:var(--text);background:transparent}.btn-lg.s:hover{border-color:var(--gold);color:var(--gold)}
        .proof-row{display:flex;align-items:center;gap:18px}
        .avs{display:flex}
        .av{width:31px;height:31px;border-radius:50%;border:2px solid var(--bg);font-family:'DM Mono',monospace;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:500;margin-left:-8px}
        .av:first-child{margin-left:0}
        .av-M{background:#2D5A8E;color:#fff}.av-L{background:#8E4A2D;color:#fff}.av-S{background:#2D8E4A;color:#fff}.av-A{background:#7A2D8E;color:#fff}
        .roi-card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:30px;position:relative;overflow:hidden}
        .roi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
        .rbars{display:flex;align-items:flex-end;gap:4px;height:56px;margin-bottom:16px}
        .rstats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .rs{text-align:center}
        .rs-v{font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:var(--text)}
        .rs-k{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
        .ticker-wrap{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg2);padding:13px 0;overflow:hidden;white-space:nowrap}
        .ticker-inner{display:inline-flex;animation:tick 28s linear infinite}
        @keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .sec{padding:100px 44px}
        .cont{max-width:1220px;margin:0 auto}
        .snum{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:400;font-style:italic;color:var(--gold);margin-bottom:2px}
        .stitle{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,4.2vw,62px);font-weight:300;line-height:1.05;color:var(--text)}
        .stitle em{font-style:italic;color:var(--gold)}
        .shead{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:60px}
        .ssub{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);text-align:right;line-height:1.5}
        .dash-card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;overflow:hidden;margin-bottom:20px}
        .dash-top{padding:16px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}
        .live-pill{display:flex;align-items:center;gap:7px;padding:5px 12px;background:rgba(0,255,135,.07);border:1px solid rgba(0,255,135,.18);border-radius:100px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;color:var(--green);text-transform:uppercase}
        .live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 1.5s ease infinite}
        .dash-body{display:grid;grid-template-columns:1fr 1fr;gap:0}
        .dash-left{padding:28px;border-right:1px solid var(--border)}
        .dash-right{padding:24px}
        .ht{background:var(--bg3);border:1px solid var(--border);border-radius:14px;overflow:hidden}
        .ht-hd{display:grid;grid-template-columns:1fr 90px 72px 82px;padding:10px 20px;border-bottom:1px solid var(--border);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
        .ht-ft{padding:10px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
        .qt-wrap{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        .qt-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;overflow:hidden}
        .top3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .rr-bilan{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;margin-top:14px}
        .day-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}
        .dc{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:34px 26px;transition:background .2s}
        .dc:hover{background:var(--bg3)}
        .chiffres{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}
        .chc{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:40px 34px}
        .chc-bars{display:flex;align-items:flex-end;gap:4px;height:38px;margin-top:20px}
        .chb{flex:1;border-radius:2px 2px 0 0}
        .verdict-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;border-radius:20px;overflow:hidden}
        .vi{background:var(--bg3);border:1px solid var(--border);border-radius:16px;min-height:460px;position:relative;overflow:hidden}
        .sim-wrap{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}
        .sim-panel{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:36px}
        .sim-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;background:var(--border);border-radius:2px;outline:none;margin:10px 0 6px;cursor:pointer}
        .sim-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:var(--gold);cursor:pointer;box-shadow:0 0 0 4px rgba(212,175,55,.15)}
        .sim-result{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:36px}
        .vmax-wrap{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}
        .vc-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:16px}
        .vc-bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:10px}
        .vc-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--gold),var(--gold-l));transition:width .5s cubic-bezier(.34,1.56,.64,1)}
        .avap{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        .avap-before{border-radius:20px;padding:36px;background:rgba(255,77,90,.05);border:1px solid rgba(255,77,90,.12)}
        .avap-after{border-radius:20px;padding:36px;background:rgba(0,255,135,.04);border:1px solid rgba(0,255,135,.12)}
        .tg-wrap{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
        .tg-phone{background:#1A1A2E;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,.08);box-shadow:0 40px 80px rgba(0,0,0,.5)}
        .testis{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .testi{background:var(--bg3);border:1px solid var(--border);border-radius:16px;padding:32px;transition:transform .2s,border-color .2s}
        .testi:hover{transform:translateY(-4px);border-color:rgba(212,175,55,.25)}
        .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;max-width:1020px;margin:0 auto}
        .plan{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:38px 30px;position:relative;transition:transform .2s}
        .plan:hover{transform:translateY(-4px)}
        .plan.rec{border-color:var(--gold);background:linear-gradient(160deg,rgba(212,175,55,.06),var(--bg2))}
        .plan-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--gold);color:#000;font-family:'DM Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:4px 16px;border-radius:100px;white-space:nowrap}
        .pbtn{display:block;text-align:center;padding:13px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s}
        .pbtn.fr{border:1px solid var(--border);color:var(--text);background:transparent}.pbtn.fr:hover{border-color:rgba(255,255,255,.3)}
        .pbtn.pa{background:var(--gold);color:#000}.pbtn.pa:hover{background:var(--gold-l);box-shadow:0 8px 32px rgba(212,175,55,.28)}
        .pbtn.an{border:1px solid var(--gold);color:var(--gold);background:transparent}.pbtn.an:hover{background:rgba(212,175,55,.07)}
        .faq-list{max-width:840px;margin:0 auto;display:flex;flex-direction:column;gap:2px}
        .fi{background:var(--bg3);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color .2s}
        .fi.on{border-color:rgba(212,175,55,.28)}
        .fiq{padding:22px 28px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:14px}
        .fip{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:17px;transition:all .3s;flex-shrink:0}
        .fi.on .fip{transform:rotate(45deg);border-color:var(--gold);background:rgba(212,175,55,.08)}
        .fia{max-height:0;overflow:hidden;transition:max-height .35s ease,padding .3s;font-size:14px;color:var(--muted);line-height:1.75;padding:0 28px}
        .fi.on .fia{max-height:260px;padding:0 28px 22px}
        .cta-final{background:var(--bg2);padding:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
        .jr-wrap{background:var(--bg3);border-top:1px solid var(--border);border-bottom:1px solid var(--border);overflow:hidden;white-space:nowrap}
        .jr-inner{display:inline-flex;animation:tick 40s linear infinite}
        @media(max-width:1000px){
          #nav{padding:0 20px}.nlinks{display:none}
          .hero{grid-template-columns:1fr;padding:100px 20px 60px;gap:40px}
          .hctas{flex-wrap:wrap}
          .dash-body{grid-template-columns:1fr}
          .qt-wrap{grid-template-columns:1fr}
          .top3{grid-template-columns:1fr}
          .sim-wrap{grid-template-columns:1fr}
          .vmax-wrap{grid-template-columns:1fr}
          .avap{grid-template-columns:1fr}
          .tg-wrap{grid-template-columns:1fr}
          .testis{grid-template-columns:1fr}
          .plans{grid-template-columns:1fr;max-width:420px}
          .verdict-grid{grid-template-columns:1fr}
          .day-cards{grid-template-columns:1fr 1fr}
          .chiffres{grid-template-columns:1fr}
          .sec{padding:70px 20px}
        }
      `}</style>

      <div className="lp">
        {/* Notifications */}
        <div id="notif" style={{position:"fixed",top:80,right:24,zIndex:2000,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none",alignItems:"flex-end"}}></div>

        {/* Cookie */}
        <div id="ck">
          <span>Nous utilisons des cookies. <a href="/politique-cookies">En savoir plus</a></span>
          <div style={{display:"flex",gap:10,flexShrink:0}}>
            <button className="ck-b n" onClick={()=>(window as W).ckDismiss?.("n")}>Refuser</button>
            <button className="ck-b y" onClick={()=>(window as W).ckDismiss?.("y")}>Accepter</button>
          </div>
        </div>

        {/* NAV */}
        <nav id="nav">
          <Link href="/" className="nlogo">
            <div className="nlogo-ic">P</div>
            <div>
              <span className="nlogo-txt">PMU<em style={{fontStyle:"italic",color:"var(--gold)"}}>Gagnant</em></span>
              <span className="nlogo-sub">TurfEdge · VMAX Engine</span>
            </div>
          </Link>
          <ul className="nlinks">
            <li><a href="#dashboard" className="on">Aujourd&apos;hui</a></li>
            <li><a href="#methode">Méthode</a></li>
            <li><a href="#simulateur">Simulateur</a></li>
            <li><a href="#plans">Tarifs</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className="ncta">
            <Link href="/login" className="btn-ghost">Connexion</Link>
            <Link href="/signup" className="btn-gold">Essai gratuit →</Link>
          </div>
        </nav>

        {/* HERO */}
        <div style={{maxWidth:"100%",padding:0}}>
          <div className="hero">
            <div>
              <div className="h-eye"><div className="h-dot"></div>Analyse en cours · Quinté+ du jour</div>
              <h1 className="hero-t">PMU Gagnant<br/>lit le programme<br/>à votre <em>place.</em></h1>
              <p className="hero-sub"><strong>Notre moteur VMAX score chaque cheval, écarte les courses illisibles,</strong> et vous remet un seul ticket — celui où la value est mathématiquement défendable.</p>
              <div className="hctas">
                <Link href="/signup" className="btn-lg p">Voir l&apos;édition d&apos;aujourd&apos;hui →</Link>
                <a href="#simulateur" className="btn-lg s">Simuler mon ROI</a>
              </div>
              <div className="proof-row">
                <div className="avs">
                  <div className="av av-M">M</div><div className="av av-L">L</div><div className="av av-S">S</div><div className="av av-A">A</div>
                </div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.4}}><strong style={{color:"var(--text)",fontWeight:500}}>1 247 abonnés</strong> · 14 J d&apos;essai · Sans CB</div>
              </div>
            </div>
            {/* ROI Card */}
            <div className="roi-card">
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".15em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                <span>ROI — 30 DERNIERS JOURS</span>
                <span style={{color:"var(--green)",fontWeight:500}}>↑ TENDANCE</span>
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:72,fontWeight:300,color:"var(--green)",lineHeight:1,letterSpacing:"-.03em"}}>
                <sup style={{fontSize:36}}>+</sup>26<sup style={{fontSize:36}}>%</sup>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",margin:"10px 0 18px"}}>
                Sur <span style={{color:"var(--text)"}}>184 pronostics</span> · Bankroll 1 000 € · Net <span style={{color:"var(--green)"}}>+261 €</span>
              </div>
              <div className="rbars" id="rb"></div>
              <div className="rstats">
                <div className="rs"><div className="rs-v">62%</div><div className="rs-k">Réussite</div></div>
                <div className="rs"><div className="rs-v">8 €</div><div className="rs-k">Mise moy.</div></div>
                <div className="rs"><div className="rs-v">V3.2</div><div className="rs-k">VMAX</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Ticker */}
        <div className="ticker-wrap"><div className="ticker-inner" id="ticker"></div></div>

        {/* DASHBOARD */}
        <section className="sec" id="dashboard" style={{paddingTop:80,paddingBottom:60}}>
          <div className="cont">
            <div className="dash-card">
              <div className="dash-top">
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:"var(--gold)"}}>TurfEdge <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"var(--muted)",marginLeft:10,fontWeight:300}}>VMAX v3.2</span></div>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div className="live-pill"><div className="live-dot"></div>LIVE · SYNC <span id="lt">--:--</span></div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--muted)"}}>VINCENNES · R1C3</div>
                </div>
              </div>
              <div className="dash-body">
                <div className="dash-left">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>ROI · CE MOIS</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:60,fontWeight:300,color:"var(--green)",lineHeight:1,letterSpacing:"-.03em"}}><sup style={{fontSize:30}}>+</sup>26<sup style={{fontSize:30}}>%</sup></div>
                  <div style={{fontSize:12,color:"var(--muted)",margin:"10px 0 20px"}}>Sur <span style={{color:"var(--text)"}}>184 pronostics</span> · bankroll <span style={{color:"var(--text)"}}>1 000 €</span></div>
                  <div style={{display:"flex",gap:28}}>
                    <div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:"var(--text)"}}>62<sup style={{fontSize:17}}>%</sup></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)"}}>Réussite</div></div>
                    <div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:"var(--text)"}}>8<sup style={{fontSize:17}}>€</sup></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)"}}>Mise type</div></div>
                    <div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:"var(--text)"}}>A</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)"}}>Tier Kelly</div></div>
                  </div>
                </div>
                <div className="dash-right">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:4,display:"flex",gap:10}}>
                    <span style={{color:"var(--green)"}}>COURSE PHARE</span><span>·</span><span>LISIBILITÉ LISIBLE</span><span>·</span><span>DÉCISION VALIDE</span>
                  </div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,fontStyle:"italic",lineHeight:1.1,color:"var(--text)",marginBottom:20}}>Prix d&apos;Amérique<br/>— quinté du soir</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                    {[["Réunion","R1C3"],["Hippodrome","Vincennes"],["Discipline","Trot attelé"],["Distance","2700m"]].map(([k,v])=>(
                      <div key={k}><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:"var(--muted)",marginBottom:4}}>{k}</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:k==="Distance"?26:19,fontWeight:600,color:k==="Distance"?"var(--gold)":"var(--text)"}}>{v}</div></div>
                    ))}
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".12em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Départ dans</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:300,color:"var(--gold)",letterSpacing:"-.02em"}} id="ctdown">--:--:--</div>
                </div>
              </div>
            </div>
            {/* Horse table */}
            <div className="ht">
              <div className="ht-hd"><div>Cheval · Driver</div><div>Score VMAX</div><div>Edge</div><div style={{textAlign:"right"}}>Mise · Kelly</div></div>
              {[
                {num:7,name:"Espoir de Berlais",drv:"F. Nivard · 4.2x",score:87,tags:["v","p"],up:true,edge:"+18%",k:"12 €",t:"A",dim:false},
                {num:3,name:"Kalaïa d'Argent",drv:"A. Abrivard · 7.8x",score:79,tags:["v"],up:true,edge:"+24%",k:"7 €",t:"B",dim:false},
                {num:11,name:"Quartz du Chenet",drv:"É. Raffin · 3.1x",score:71,tags:["s"],up:true,edge:"+11%",k:"4 €",t:"C",dim:false},
                {num:5,name:"Nuit Boréale",drv:"G. Thomain · 5.5x",score:58,tags:[],up:true,edge:"+2%",k:"pas joué",t:"—",dim:true},
                {num:14,name:"Ipso Facto",drv:"R. Abrivard · 12.4x",score:52,tags:[],up:false,edge:"-6%",k:"pas joué",t:"—",dim:true},
              ].map(h=>(
                <div key={h.num} style={{display:"grid",gridTemplateColumns:"1fr 90px 72px 82px",padding:"13px 20px",borderBottom:"1px solid rgba(212,175,55,.05)",alignItems:"center",opacity:h.dim?.35:1,transition:"background .2s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11}}>
                    <div style={{width:28,height:28,borderRadius:6,background:"var(--bg2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:600,color:"var(--text)",flexShrink:0}}>{h.num}</div>
                    <div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontStyle:"italic",color:"var(--text)"}}>{h.name}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--muted)"}}>{h.drv}</div>
                      <div style={{display:"flex",gap:5,marginTop:3}}>
                        {h.tags.includes("v")&&<span style={{padding:"2px 7px",borderRadius:4,fontFamily:"'DM Mono',monospace",fontSize:9,background:"rgba(0,255,135,.1)",color:"var(--green)",border:"1px solid rgba(0,255,135,.18)",textTransform:"uppercase",letterSpacing:".08em"}}>Valide</span>}
                        {h.tags.includes("p")&&<span style={{padding:"2px 7px",borderRadius:4,fontFamily:"'DM Mono',monospace",fontSize:9,background:"rgba(212,175,55,.1)",color:"var(--gold)",border:"1px solid rgba(212,175,55,.18)",textTransform:"uppercase",letterSpacing:".08em"}}>Priorité</span>}
                        {h.tags.includes("s")&&<span style={{padding:"2px 7px",borderRadius:4,fontFamily:"'DM Mono',monospace",fontSize:9,background:"rgba(77,200,255,.1)",color:"var(--blue)",border:"1px solid rgba(77,200,255,.18)",textTransform:"uppercase",letterSpacing:".08em"}}>Surveillance</span>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:500,color:"var(--text)"}}>{h.score}</div>
                    <div style={{height:3,background:"var(--border)",borderRadius:2,marginTop:4}}><div style={{height:"100%",width:h.score+"%",borderRadius:2,background:h.score>80?"var(--gold)":h.score>65?"rgba(212,175,55,.5)":"rgba(255,255,255,.1)"}}></div></div>
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:h.up?"var(--green)":"var(--red)"}}>{h.up?"▲":"▼"} {h.edge}</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:600,color:"var(--text)"}}>{h.k}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--muted)"}}>KELLY · {h.t}</div>
                  </div>
                </div>
              ))}
              <div className="ht-ft"><span>SYNCHRO PMU · <span id="st">--:--:--</span> · VMAX V3.2</span><span>COTES MARCHÉ EN CONFIRMATION</span></div>
            </div>
          </div>
        </section>

        {/* QUINTÉ+ */}
        <section className="sec" id="quinte" style={{background:"var(--bg2)",paddingTop:70,paddingBottom:70}}>
          <div className="cont">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
              <div>
                <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"4px 12px",background:"rgba(212,175,55,.08)",border:"1px solid rgba(212,175,55,.22)",borderRadius:100,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".12em",color:"var(--gold)",textTransform:"uppercase",marginBottom:10}}>🏆 Quinté+ du jour</div>
                <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:"var(--text)"}}>Prix d&apos;Amérique <em style={{fontStyle:"italic",color:"var(--gold)"}}>— quinté du soir.</em></h3>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".12em",textTransform:"uppercase",color:"var(--muted)",marginBottom:4}}>VINCENNES · R1C3 · TROT ATTELÉ</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:300,color:"var(--gold)"}}>2700m · Départ 15:30</div>
              </div>
            </div>
            <div className="qt-wrap">
              <div className="qt-card">
                <div style={{padding:"14px 22px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"4px 12px",background:"rgba(212,175,55,.1)",border:"1px solid rgba(212,175,55,.25)",borderRadius:100,fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em",color:"var(--gold)",textTransform:"uppercase"}}>🐎 Sélection VMAX — 5 chevaux</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--green)"}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--green)",display:"inline-block"}}></span>Ordre confiance</div>
                </div>
                <div id="qh"></div>
                <div style={{padding:"10px 24px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)"}}>
                  <span>VMAX V3.2 · MÀJ 15:45</span><span>BASE: 7-3-11 · BONUS: 9</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{background:"linear-gradient(135deg,rgba(212,175,55,.06),var(--bg3))",border:"1px solid rgba(212,175,55,.2)",borderRadius:12,padding:24,flex:1}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--gold)",marginBottom:10}}>Verdict VMAX</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,fontStyle:"italic",color:"var(--text)",marginBottom:16,lineHeight:1.55}}>Course lisible. Value nette sur le 7. Le marché sous-estime Espoir de Berlais de 18%.</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,paddingTop:14,borderTop:"1px solid var(--border)"}}>
                    {[["A","Lisibilité","var(--green)"],["18%","Edge value","var(--gold)"],["12 €","Mise Kelly","var(--text)"]].map(([v,k,c])=>(
                      <div key={k} style={{textAlign:"center"}}><div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:c}}>{v}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",marginTop:2}}>{k}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,padding:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div><div style={{fontSize:14,fontWeight:500,color:"var(--text)",marginBottom:3}}>Analyse complète</div><div style={{fontSize:13,color:"var(--muted)"}}>Fiche · Historiques · Conditions piste</div></div>
                  <Link href="/signup" style={{padding:"10px 18px",background:"var(--gold)",color:"#000",borderRadius:10,fontSize:14,fontWeight:600,textDecoration:"none"}}>Accéder →</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TOP 3 */}
        <section className="sec" id="top3" style={{paddingTop:80,paddingBottom:80}}>
          <div className="cont">
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:44}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".18em",textTransform:"uppercase",color:"var(--gold)",marginBottom:10}}>Programme du jour</div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:50,fontWeight:300,color:"var(--text)"}}>Top 3 <em style={{fontStyle:"italic",color:"var(--gold)"}}>sélections</em> VMAX.</h2>
              </div>
              <Link href="/signup" style={{padding:"10px 20px",border:"1px solid var(--border)",color:"var(--muted)",borderRadius:10,fontSize:14,textDecoration:"none"}}>Programme complet →</Link>
            </div>
            <div className="top3" id="top3c"></div>
          </div>
        </section>

        {/* RÉSULTATS D'HIER */}
        <section className="sec" id="resultats" style={{background:"var(--bg2)",paddingTop:80,paddingBottom:80}}>
          <div className="cont">
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:44}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".18em",textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>Hier · Dimanche 3 mai 2026</div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:50,fontWeight:300,color:"var(--text)"}}>Les résultats <em style={{fontStyle:"italic",color:"var(--gold)"}}>d&apos;hier.</em></h2>
              </div>
              <div style={{textAlign:"right"}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:"var(--green)"}}>3/4</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",marginTop:2}}>Pronostics gagnants</div></div>
            </div>
            <div id="rl"></div>
            <div className="rr-bilan">
              <div style={{display:"flex",alignItems:"center",gap:24}}>
                {[["#00FF87","+61 €","Net journée"],["var(--gold)","+6.1%","ROI journée"],["var(--text)","1 061 €","Bankroll après"]].map(([c,v,k])=>(
                  <div key={k}><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:500,color:c}}>{v}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",marginTop:2}}>{k}</div></div>
                ))}
              </div>
              <Link href="/signup" style={{padding:"10px 20px",border:"1px solid var(--border)",color:"var(--muted)",borderRadius:10,fontSize:14,textDecoration:"none"}}>Bilan complet →</Link>
            </div>
          </div>
        </section>

        {/* UNE JOURNÉE */}
        <section className="sec" id="methode" style={{paddingTop:100,paddingBottom:100}}>
          <div className="cont">
            <div className="shead"><div><div className="snum">II.</div><h2 className="stitle">Une <em>journée</em> avec le moteur VMAX.</h2></div><div className="ssub">4 ÉTAPES<br/>AUTOMATISÉES</div></div>
            <div className="day-cards">
              {[["i.","07:00","Scan matinal.","VMAX lit le programme du jour, score chaque partant, écarte les courses « loterie »."],["ii.","T-15MIN","Seconde passe.","Cotes marché en direct, ajustement du verdict, alerte Telegram avant la course."],["iii.","DÉPART","Le ticket.","Une mise type Kelly, un cheval prioritaire, deux angles. Pas plus."],["iv.","19:30","Le débrief.","Résultats officiels intégrés, ROI mis à jour, paramètres recalibrés pour demain."]].map(([i,t,title,desc])=>(
                <div key={i} className="dc">
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:300,fontStyle:"italic",color:"rgba(212,175,55,.18)",lineHeight:1,marginBottom:6}}>{i}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--gold)",marginBottom:18}}>{t}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,fontStyle:"italic",color:"var(--text)",marginBottom:12,lineHeight:1.15}} dangerouslySetInnerHTML={{__html:title.replace(".","<em style='color:var(--gold)'>.</em>")}}></div>
                  <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.7}}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CHIFFRES */}
        <section className="sec" id="chiffres" style={{background:"var(--bg2)"}}>
          <div className="cont">
            <div className="shead"><div><div className="snum">III.</div><h2 className="stitle">La <em>preuve</em> par les chiffres.</h2></div><div className="ssub">30 JOURS<br/>GLISSANTS</div></div>
            <div className="chiffres">
              {[{lbl:"ROI MOYEN",target:26,suffix:"%+",color:"var(--gold)",desc:"Net après mise, sur 184 pronostics joués. Bankroll de référence : 1 000 €."},
                {lbl:"TAUX DE RÉUSSITE",target:62,suffix:"%",color:"var(--green)",desc:"Pronostic gagnant ou placé, hors courses classées « LOTERIE » automatiquement écartées."},
                {lbl:"COURSES ÉCARTÉES",target:43,suffix:"%",color:"var(--blue)",desc:"Près d'une course sur deux est jugée illisible. Ne pas jouer, c'est aussi un signal."}
              ].map(c=>(
                <div key={c.lbl} className="chc">
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:14}}>{c.lbl}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:84,fontWeight:300,color:"var(--gold)",lineHeight:1,letterSpacing:"-.04em",marginBottom:14}}>
                    {c.suffix.startsWith("+")&&<sup style={{fontSize:38}}>+</sup>}<span className="counter" data-target={c.target} data-suffix="%">0%</span>
                  </div>
                  <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.7}}>{c.desc}</p>
                  <div className="chc-bars">
                    {[.4,.7,.5,.8,.6,.9,.7,.8,.6,.95,.8,.7,.9,.85,.75,.8,.7,.9,.8,1].map((h,i)=>(
                      <div key={i} className="chb" style={{height:Math.round(h*38),background:c.color,opacity:.4+h*.4}}></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VERDICT */}
        <section className="sec" id="verdict">
          <div className="cont">
            <div className="shead"><div><div className="snum">IV.</div><h2 className="stitle">Le <em>verdict</em> du jour.</h2></div><div className="ssub">LECTURE<br/>3 MIN</div></div>
            <div className="verdict-grid">
              <div className="vi">
                <div style={{position:"absolute",top:22,left:22,display:"flex",alignItems:"center",gap:8,padding:"5px 12px",background:"rgba(212,175,55,.1)",border:"1px solid rgba(212,175,55,.22)",borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",color:"var(--gold)",textTransform:"uppercase"}}>VINCENNES · R1C3</div>
                <svg viewBox="0 0 400 480" style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:340,opacity:.88}} xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="200" cy="295" rx="110" ry="72" fill="#8B6914" opacity=".55"/><ellipse cx="200" cy="288" rx="100" ry="62" fill="#A07820" opacity=".65"/>
                  <ellipse cx="278" cy="230" rx="34" ry="24" fill="#A07820" opacity=".75" transform="rotate(-22 278 230)"/>
                  <ellipse cx="300" cy="208" rx="24" ry="17" fill="#B08830" opacity=".82" transform="rotate(-32 300 208)"/>
                  <ellipse cx="313" cy="190" rx="8" ry="13" fill="#C09840" opacity=".78" transform="rotate(-22 313 190)"/>
                  <circle cx="311" cy="204" r="4.5" fill="#1A1A1A" opacity=".9"/><circle cx="312.5" cy="202.5" r="1.8" fill="rgba(255,255,255,.35)"/>
                  <rect x="136" y="348" width="15" height="62" rx="7" fill="#7A5A10" opacity=".65" transform="rotate(-3 136 348)"/>
                  <rect x="162" y="350" width="15" height="59" rx="7" fill="#7A5A10" opacity=".65" transform="rotate(2 162 350)"/>
                  <rect x="198" y="348" width="15" height="62" rx="7" fill="#7A5A10" opacity=".6" transform="rotate(-5 198 348)"/>
                  <rect x="222" y="352" width="15" height="57" rx="7" fill="#7A5A10" opacity=".6" transform="rotate(4 222 352)"/>
                  <ellipse cx="143" cy="410" rx="11" ry="5.5" fill="#4A3A08" opacity=".8"/><ellipse cx="169" cy="409" rx="11" ry="5.5" fill="#4A3A08" opacity=".8"/>
                  <ellipse cx="205" cy="410" rx="11" ry="5.5" fill="#4A3A08" opacity=".75"/><ellipse cx="229" cy="409" rx="11" ry="5.5" fill="#4A3A08" opacity=".75"/>
                  <path d="M94 285 Q64 318 76 362 Q82 384 70 406" stroke="#7A5A10" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".55"/>
                  <ellipse cx="212" cy="248" rx="20" ry="15" fill="#1A3A6A" opacity=".82" transform="rotate(-12 212 248)"/>
                  <circle cx="220" cy="234" r="13" fill="#2A4A8A" opacity=".88"/>
                  <ellipse cx="224" cy="226" rx="9" ry="5.5" fill="#D4AF37" opacity=".92"/>
                  <ellipse cx="200" cy="416" rx="120" ry="10" fill="rgba(212,175,55,.06)"/>
                </svg>
              </div>
              <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:16,padding:40}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:8,display:"flex",alignItems:"center",gap:10}}><span style={{color:"rgba(212,175,55,.3)"}}>——</span><span style={{color:"var(--gold)"}}>PRONOSTIC PHARE</span> · 14:23</div>
                <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:300,fontStyle:"italic",lineHeight:1.15,color:"var(--text)",marginBottom:26}}>Espoir de Berlais : la <em style={{color:"var(--gold)"}}>value</em> est dans les détails.</h3>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:"#000"}}>V</div>
                  <div style={{fontSize:13,color:"var(--muted)"}}>Analysé par <strong style={{color:"var(--text)"}}>VMAX v3.2</strong> · validé par <strong style={{color:"var(--text)"}}>Marc L., chroniqueur</strong></div>
                </div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:300,fontStyle:"italic",color:"var(--text)",lineHeight:1.65,marginBottom:32,overflow:"hidden"}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:50,fontWeight:700,color:"var(--gold)",float:"left",lineHeight:.82,margin:"6px 10px 0 0"}}>L</span>e marché surcote Quartz du Chenet à 3.1, oubliant qu&apos;il a couru large dans son dernier engagement à Enghien. Espoir de Berlais sort d&apos;un travail intérieur propre — l&apos;écart de cote est mathématiquement défendable. La course est lisible, la décision : valide.
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18,padding:"22px 0",borderTop:"1px solid var(--border)",borderBottom:"1px solid var(--border)",marginBottom:22}}>
                  <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:7}}>Sélection</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,fontStyle:"italic",color:"var(--gold)"}}>№7 — gagnant</div></div>
                  <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:7}}>Mise type</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,fontStyle:"italic",color:"var(--text)"}}>12 €</div></div>
                  <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:7}}>Confiance</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,fontStyle:"italic",color:"var(--text)"}}>A</div><div style={{display:"flex",gap:5,marginTop:3}}>{[1,2,3,4,5].map(d=><div key={d} style={{width:8,height:8,borderRadius:"50%",background:d<6?"var(--gold)":"rgba(212,175,55,.18)"}}></div>)}<div style={{width:8,height:8,borderRadius:"50%",background:"rgba(212,175,55,.18)"}}></div></div></div>
                </div>
                <Link href="/signup" style={{display:"inline-flex",alignItems:"center",gap:9,padding:"11px 22px",background:"var(--gold)",color:"#000",borderRadius:10,fontSize:14,fontWeight:600,textDecoration:"none"}}>Voir l&apos;analyse complète →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* SIMULATEUR */}
        <section className="sec" id="simulateur" style={{background:"var(--bg2)"}}>
          <div className="cont">
            <div className="shead"><div><div className="snum">V.</div><h2 className="stitle">Simulez <em>votre ROI.</em></h2></div><div className="ssub">OUTIL<br/>INTERACTIF</div></div>
            <div className="sim-wrap">
              <div className="sim-panel">
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>Ma bankroll de départ</div>
                <input className="sim-range" type="range" id="sim-bankroll" min="200" max="5000" step="50" defaultValue="1000" onInput={()=>(window as W).updateSim?.()}/>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:300,color:"var(--text)"}} id="sim-bv">1 000 €</div>
                <div style={{height:1,background:"var(--border)",margin:"24px 0"}}></div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>Période de simulation</div>
                <input className="sim-range" type="range" id="sim-period" min="1" max="12" step="1" defaultValue="3" onInput={()=>(window as W).updateSim?.()}/>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:300,color:"var(--text)"}} id="sim-pv">3 mois</div>
                <div style={{height:1,background:"var(--border)",margin:"24px 0"}}></div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>Profil de pari</div>
                <div style={{display:"flex",gap:10}}>
                  {["prudent","standard","agressif"].map(p=>(
                    <button key={p} id={"p-"+p} onClick={()=>(window as W).setProfil?.(p)} style={{flex:1,padding:10,borderRadius:10,border:`1px solid ${p==="prudent"?"var(--gold)":"var(--border)"}`,background:p==="prudent"?"rgba(212,175,55,.1)":"transparent",color:p==="prudent"?"var(--gold)":"var(--muted)",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".08em",textTransform:"uppercase",cursor:"pointer"}}>
                      {p.charAt(0).toUpperCase()+p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-result">
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:4}}>Gain net projeté sur <span id="sim-period-lbl">3 mois</span></div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:80,fontWeight:300,color:"var(--green)",lineHeight:1,letterSpacing:"-.03em",margin:"16px 0"}} id="sim-gain"><sup>+</sup>180<sup>€</sup></div>
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  {[["sim-final","Bankroll finale estimée","1 180 €"],["sim-tickets","Tickets / mois","~18"],["sim-mise","Mise moyenne / ticket","50 €"],["sim-roi","ROI mensuel appliqué","18%"]].map(([id,lbl,def])=>(
                    <div key={id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10}}>
                      <span style={{fontSize:13,color:"var(--muted)"}}>{lbl}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:"var(--text)"}} id={id}>{def}</span>
                    </div>
                  ))}
                </div>
                <p style={{fontSize:11,color:"var(--muted)",fontStyle:"italic",marginBottom:20}}>⚠ Simulation basée sur les performances historiques. Résultats non garantis.</p>
                <Link href="/signup" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:14,background:"var(--gold)",color:"#000",borderRadius:12,fontSize:15,fontWeight:600,textDecoration:"none"}}>Démarrer l&apos;essai gratuit →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* VMAX DEMO */}
        <section className="sec" id="vmax-demo">
          <div className="cont">
            <div className="shead"><div><div className="snum">VI.</div><h2 className="stitle">VMAX en <em>direct.</em></h2></div><div className="ssub">DÉMO<br/>INTERACTIVE</div></div>
            <p style={{fontSize:15,color:"var(--muted)",maxWidth:500,marginBottom:48}}>Ajustez les critères et voyez le score VMAX changer en temps réel.</p>
            <div className="vmax-wrap">
              <div>
                {[{i:1,icon:"📈",name:"Forme récente",def:18,txt:"Décroissance temporelle sur 6 dernières courses"},
                  {i:2,icon:"💰",name:"Value de la cote",def:22,txt:"Probabilité réelle VMAX vs cote PMU du marché"},
                  {i:3,icon:"🏇",name:"Jockey × Hippodrome",def:21,txt:"Affinités jockey/hippodrome sur 24 mois de données"},
                  {i:4,icon:"📏",name:"Distance & terrain",def:19,txt:"Historique distance exacte + conditions piste du jour"}
                ].map(c=>(
                  <div key={c.i} className="vc-card">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:36,height:36,borderRadius:9,background:"rgba(212,175,55,.1)",border:"1px solid rgba(212,175,55,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{c.icon}</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:"var(--text)"}}>{c.name}</div>
                      </div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:500,color:"var(--gold)"}}><span id={"c"+c.i+"v"}>{c.def}</span><span style={{fontSize:11,color:"var(--muted)"}}>/{25}</span></div>
                    </div>
                    <input className="sim-range" type="range" id={"c"+c.i} min="0" max="25" step="1" defaultValue={c.def} onInput={()=>(window as W).updateVmax?.()}/>
                    <div className="vc-bar"><div className="vc-fill" id={"c"+c.i+"f"} style={{width:(c.def/25*100)+"%"}}></div></div>
                    <div style={{fontSize:12,color:"var(--muted)",marginTop:8}}>{c.txt}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:20,padding:36,position:"sticky",top:90}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--muted)",marginBottom:20,textAlign:"center"}}>Score VMAX Global</div>
                <div style={{width:180,height:180,margin:"0 auto 28px",position:"relative"}}>
                  <svg viewBox="0 0 180 180" id="score-svg" width="180" height="180">
                    <circle cx="90" cy="90" r="76" fill="none" stroke="rgba(212,175,55,.1)" strokeWidth="8"/>
                    <circle cx="90" cy="90" r="76" fill="none" stroke="var(--gold)" strokeWidth="8" strokeLinecap="round" strokeDasharray="478" strokeDashoffset="115" id="score-arc" style={{transition:"stroke-dashoffset .5s cubic-bezier(.34,1.56,.64,1)",transform:"rotate(-90deg)",transformOrigin:"center"}}/>
                  </svg>
                  <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:56,fontWeight:300,color:"var(--green)",lineHeight:1}} id="score-num">80</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)"}}>/ 100</div>
                  </div>
                </div>
                <div style={{textAlign:"center",marginBottom:24}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:400,fontStyle:"italic",marginBottom:4,color:"var(--green)"}} id="vd-decision">VALIDE ✓</div>
                  <div style={{fontSize:13,color:"var(--muted)"}} id="vd-sub">Course lisible — Value positive détectée</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[["Forme récente","vb1","18/25"],["Value cote","vb2","22/25"],["Jockey × Hippodrome","vb3","21/25"],["Distance & terrain","vb4","19/25"]].map(([lbl,id,def])=>(
                    <div key={id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--muted)"}}>{lbl}</span><span style={{fontFamily:"'DM Mono',monospace",fontWeight:500,color:"var(--text)"}} id={id}>{def}</span></div>
                  ))}
                  <div style={{height:1,background:"var(--border)",margin:"12px 0"}}></div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13}}><span style={{fontWeight:500,color:"var(--text)"}}>Total</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:"var(--gold)"}} id="vb-total">80/100</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AVANT / APRÈS */}
        <section className="sec" id="avant-apres" style={{background:"var(--bg2)"}}>
          <div className="cont">
            <div className="shead"><div><div className="snum">VII.</div><h2 className="stitle">Avant <em>vs</em> après.</h2></div><div className="ssub">PARIEUR<br/>LAMBDA</div></div>
            <div className="avap">
              <div className="avap-before">
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--red)",marginBottom:16}}>❌ Sans PMU Gagnant</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:300,color:"var(--text)",marginBottom:24}}>Le parieur qui improvise.</div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {["Joue 5 à 8 courses/jour sur instinct ou « tuyaux »","Aucune rigueur sur la mise — joue plus quand il « tient quelque chose »","Ne sait pas si sa stratégie est rentable — pas de suivi","Perd 2-3h par jour à analyser le programme","Parie quand même sur les courses loterie par FOMO"].map(t=>(
                    <div key={t} style={{display:"flex",alignItems:"flex-start",gap:12,fontSize:14}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(255,77,90,.12)",color:"var(--red)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:1}}>✗</div>
                      <div style={{color:"var(--muted)",lineHeight:1.55}}>{t}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:28,paddingTop:20,borderTop:"1px solid var(--border)"}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:300,lineHeight:1,color:"var(--red)"}}>-18<sup style={{fontSize:28}}>%</sup></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",marginTop:4}}>ROI MOYEN SANS MÉTHODE</div></div>
              </div>
              <div className="avap-after">
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--green)",marginBottom:16}}>✅ Avec PMU Gagnant</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:300,color:"var(--text)",marginBottom:24}}>Le parieur qui décide.</div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {["Un seul ticket par jour — 2 minutes pour valider ou passer","Mise Kelly calculée automatiquement selon la bankroll réelle","Bilan ROI mis à jour chaque soir — sait exactement où il en est","Alerte Telegram T-15min — pas besoin de surveiller le programme","43% des courses écartées automatiquement par VMAX"].map(t=>(
                    <div key={t} style={{display:"flex",alignItems:"flex-start",gap:12,fontSize:14}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(0,255,135,.1)",color:"var(--green)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:1}}>✓</div>
                      <div style={{color:"var(--muted)",lineHeight:1.55}}>{t}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:28,paddingTop:20,borderTop:"1px solid var(--border)"}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:300,lineHeight:1,color:"var(--green)"}}>+26<sup style={{fontSize:28}}>%</sup></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",marginTop:4}}>ROI MOYEN ABONNÉ VMAX</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* TELEGRAM */}
        <section className="sec" id="telegram">
          <div className="cont">
            <div className="tg-wrap">
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".18em",textTransform:"uppercase",color:"var(--gold)",marginBottom:14}}>Alertes Telegram</div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:48,fontWeight:300,color:"var(--text)",marginBottom:20}}>Le ticket arrive<br/><em style={{fontStyle:"italic",color:"var(--gold)"}}>15 minutes</em><br/>avant le départ.</h2>
                <p style={{fontSize:15,color:"var(--muted)",lineHeight:1.75,marginBottom:32}}>Plus besoin de surveiller le programme. VMAX envoie le verdict sur votre téléphone via @pmugagnantbot.</p>
                <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:32}}>
                  {["Alerte T-15min avant chaque départ sélectionné","Cheval, cote, mise Kelly et confiance inclus","Résultat automatique après la course"].map(t=>(
                    <div key={t} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:34,height:34,borderRadius:9,background:"rgba(0,255,135,.07)",border:"1px solid rgba(0,255,135,.16)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>✓</div>
                      <div style={{fontSize:14,color:"var(--text)"}}>{t}</div>
                    </div>
                  ))}
                </div>
                <Link href="/subscribe" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"14px 28px",background:"var(--gold)",color:"#000",borderRadius:12,fontSize:15,fontWeight:600,textDecoration:"none"}}>Activer les alertes →</Link>
              </div>
              <div className="tg-phone">
                <div style={{background:"#1F1F35",padding:"14px 18px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#D4AF37,#8B6914)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#000",flexShrink:0}}>P</div>
                  <div><div style={{fontSize:14,fontWeight:500,color:"#fff"}}>@pmugagnantbot</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>🟢 en ligne · bot</div></div>
                </div>
                <div style={{padding:14,background:"#17182A",minHeight:380,display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {lbl:"🔍 SCAN MATINAL · 07:03",lc:"var(--blue)",bl:"#1F2940",body:"Programme analysé ✓<br/><strong>12 courses traitées</strong><br/><strong style='color:rgba(255,77,90,.8)'>7 éliminées</strong> (loterie)<br/><strong style='color:#D4AF37'>1 ticket prioritaire identifié</strong>",t:"07:03 ✓✓"},
                    {lbl:"⚡ ALERTE T-15MIN · 15:15",lc:"var(--gold)",bl:"#1F2940",body:"<strong>🏆 Quinté+ — Vincennes R1C3</strong><br/><br/><em style='font-family:Cormorant Garamond,serif;font-size:16px'>Espoir de Berlais</em><br/>N°7 · Cote 4.2 · <span style='color:#00FF87'>VALIDE ✓</span><br/>Mise Kelly : <strong>12 € · Tier A</strong>",t:"15:15 ✓✓"},
                    {lbl:"✅ RÉSULTAT · 15:48",lc:"var(--green)",bl:"#1A2E1F",body:"<strong>GAGNANT 🎉</strong><br/><br/>Espoir de Berlais — 1er ✓<br/>Cote finale : 4.1<br/>Mise : 12 € → <strong style='color:#00FF87'>Gain : +37.2 €</strong>",t:"15:48 ✓✓"},
                  ].map((m,i)=>(
                    <div key={i} style={{background:m.bl,borderRadius:"12px 12px 12px 4px",padding:"12px 14px",maxWidth:"92%",borderLeft:`3px solid ${m.lc}`}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:m.lc,marginBottom:7}}>{m.lbl}</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.65}} dangerouslySetInnerHTML={{__html:m.body}}></div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:7,textAlign:"right"}}>{m.t}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#1F1F35",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,borderTop:"1px solid rgba(255,255,255,.05)"}}>
                  <div style={{flex:1,background:"rgba(255,255,255,.06)",borderRadius:20,padding:"8px 14px",fontSize:13,color:"rgba(255,255,255,.2)"}}>Message…</div>
                  <div style={{width:34,height:34,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer"}}>→</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TÉMOIGNAGES */}
        <section className="sec" id="temoignages" style={{background:"var(--bg2)"}}>
          <div className="cont">
            <div className="shead"><div><div className="snum">VIII.</div><h2 className="stitle">Ce qu&apos;en disent <em>les abonnés.</em></h2></div><div className="ssub">TÉMOIGNAGES<br/>VÉRIFIÉS</div></div>
            <div className="testis">
              {[{av:"M",bg:"#2D5A8E",name:"Marc L.",meta:"Abonné depuis 8 mois · Versailles",roi:"+31%",txt:"Avant je jouais 8 courses par jour. Maintenant j'en joue une, et je gagne plus. C'est tout bête mais ça change tout."},
                {av:"S",bg:"#8E4A2D",name:"Sylvie R.",meta:"Abonnée depuis 1 an · Lyon",roi:"+18%",txt:"Le verdict tombe à 9h. Je le lis avec mon café. Je joue ou je joue pas. Et c'est fini pour la journée."},
                {av:"A",bg:"#2D8E4A",name:"Antoine D.",meta:"Abonné depuis 4 mois · Bordeaux",roi:"+24%",txt:"Le truc dingue c'est de voir VMAX écarter une course que j'aurais jouée. À chaque fois il avait raison."}
              ].map(t=>(
                <div key={t.name} className="testi">
                  <div style={{fontSize:30,color:"var(--gold)",opacity:.45,lineHeight:1,marginBottom:14,fontFamily:"'Cormorant Garamond',serif"}}>&quot;</div>
                  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontStyle:"italic",color:"var(--text)",lineHeight:1.65,marginBottom:24}}>{t.txt}</p>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:12,color:"#fff"}}>{t.av}</div>
                    <div><div style={{fontSize:14,fontWeight:500,color:"var(--text)"}}>{t.name}</div><div style={{fontSize:12,color:"var(--muted)"}}>{t.meta}</div></div>
                    <div style={{marginLeft:"auto",fontFamily:"'DM Mono',monospace",fontSize:15,color:"var(--green)",fontWeight:500}}>{t.roi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section className="sec" id="plans">
          <div className="cont">
            <div style={{marginBottom:44}}>
              <div className="snum">IX.</div>
              <h2 className="stitle">Un <em>abonnement,</em> pas un casino.</h2>
              <div style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginTop:-30}}>SANS ENGAGEMENT · 14 J D&apos;ESSAI</div>
            </div>
            <div className="plans">
              {[{cat:"Découverte",name:"Lecteur",price:"0",per:"/mois",rec:false,desc:"Pour découvrir la méthode et tester 14 jours.",feats:[{on:true,t:"Le verdict du jour"},{on:true,t:"3 courses analysées / semaine"},{on:false,t:"Score VMAX en direct"},{on:false,t:"Alertes Telegram T-15"},{on:false,t:"Mise type & value bet"}],href:"/signup",btnClass:"fr",btnTxt:"Commencer",eco:""},
                {cat:"Pour les parieurs actifs",name:"Abonné VMAX",price:"19",per:"/mois",rec:true,desc:"Tout le système VMAX. Alertes. Suivi bankroll en temps réel.",feats:[{on:true,t:"Tout le programme analysé"},{on:true,t:"Score VMAX, value, Kelly tier"},{on:true,t:"Alertes Telegram T-15min"},{on:true,t:"Coach IA illimité"},{on:true,t:"Bilan & recalibrage hebdo"}],href:"/subscribe",btnClass:"pa",btnTxt:"Essai 14 jours →",eco:""},
                {cat:"Pour les méthodiques",name:"Annuel",price:"149",per:"/an",rec:false,desc:"Tout le plan VMAX, 2 mois offerts, backtests historiques.",feats:[{on:true,t:"Tout le plan VMAX"},{on:true,t:"2 mois offerts"},{on:true,t:"Backtests historiques"},{on:true,t:"Export CSV"},{on:true,t:"Support prioritaire"}],href:"/subscribe?plan=annual",btnClass:"an",btnTxt:"Économiser 38 € →",eco:"soit 12,41€/mois"},
              ].map(p=>(
                <div key={p.name} className={`plan${p.rec?" rec":""}`}>
                  {p.rec&&<div className="plan-badge">★ RECOMMANDÉ</div>}
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>{p.cat}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:300,color:"var(--text)",marginBottom:8,lineHeight:1}} dangerouslySetInnerHTML={{__html:p.name.replace("VMAX","<em style='font-style:italic;color:var(--gold)'>VMAX</em>")}}></div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:58,fontWeight:300,color:"var(--text)",lineHeight:1,marginBottom:4}}><sup style={{fontSize:26,verticalAlign:"top",marginTop:10,display:"inline-block"}}>€</sup>{p.price}<span style={{fontSize:16,color:"var(--muted)"}}>{p.per}</span></div>
                  <p style={{fontSize:13,color:"var(--muted)",marginBottom:26,lineHeight:1.6}}>{p.desc}</p>
                  <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:11,marginBottom:30}}>
                    {p.feats.map(f=><li key={f.t} style={{display:"flex",alignItems:"center",gap:9,fontSize:14,color:"var(--text)"}}><span style={{color:f.on?"var(--green)":"rgba(255,255,255,.18)"}}>{f.on?"●":"○"}</span><span style={{color:f.on?"var(--text)":"var(--muted)"}}>{f.t}</span></li>)}
                  </ul>
                  <Link href={p.href} className={`pbtn ${p.btnClass}`}>{p.btnTxt}</Link>
                  {p.eco&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--green)",textAlign:"center",marginTop:9}}>↳ {p.eco}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec" id="faq" style={{background:"var(--bg2)"}}>
          <div className="cont" style={{textAlign:"center",marginBottom:60}}><div className="snum" style={{display:"inline-block"}}>X.</div><h2 className="stitle" style={{display:"inline-block",marginLeft:12}}>Questions <em>fréquentes.</em></h2></div>
          <div className="faq-list">
            {[{q:"Comment fonctionne le moteur VMAX ?",a:"VMAX agrège plus de 40 signaux par cheval (forme récente, cotes marché, jockey/driver, hippodrome, distance, conditions de piste) et calcule un score de confiance + une décision course. Si la course est jugée illisible elle est automatiquement écartée."},
              {q:"Le ROI +26% est-il garanti ?",a:"Non. Les paris hippiques comportent une part d'aléa et aucun résultat passé ne garantit les performances futures. Le +26% est une moyenne observée sur 30 jours de production réelle. PMU Gagnant est un outil d'aide à la décision."},
              {q:"Puis-je résilier à tout moment ?",a:"Oui. L'abonnement est sans engagement. Résiliation depuis votre espace compte en 2 clics. Elle prend effet à la fin de la période en cours, sans frais."},
              {q:"Comment je reçois les pronostics ?",a:"Sur votre dashboard PMU Gagnant (desktop & mobile), et pour les abonnés VMAX, via le bot Telegram @pmugagnantbot — alerte automatique T-15min avant le départ sélectionné."},
              {q:"Vous prenez des paris à ma place ?",a:"Non. PMU Gagnant analyse et recommande. Vous seul décidez si vous jouez. Nous n'avons aucun accès à votre compte PMU. En cas de difficulté avec le jeu : 09 74 75 13 13 — joueurs-info-service.fr."}
            ].map((f,i)=>(
              <div key={i} className={`fi${i===0?" on":""}`}>
                <div className="fiq" onClick={e=>(window as W).toggleFaq?.(e.currentTarget as HTMLElement)}>
                  <span style={{fontSize:15,fontWeight:400,color:"var(--text)"}}>{f.q}</span>
                  <div className="fip">+</div>
                </div>
                <div className="fia">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <div className="cta-final">
          <div style={{maxWidth:1080,margin:"0 auto",padding:"120px 44px",textAlign:"center",position:"relative"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".18em",textTransform:"uppercase",color:"var(--gold)",marginBottom:24}}>DEMAIN MATIN · 09:00</div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(50px,7vw,96px)",fontWeight:300,lineHeight:.94,color:"var(--text)",marginBottom:32,letterSpacing:"-.02em"}}>Le prochain <em style={{fontStyle:"italic",color:"var(--gold)"}}>verdict</em><br/>tombe demain.<br/>Vous y serez ?</h2>
            <p style={{fontSize:16,color:"var(--muted)",maxWidth:480,margin:"0 auto 48px",lineHeight:1.7}}>14 jours d&apos;essai gratuit, sans carte bancaire. Une lecture courte, un ticket prioritaire.</p>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,flexWrap:"wrap",marginBottom:48}}>
              <Link href="/signup" className="btn-lg p" style={{fontSize:16,padding:"16px 36px"}}>Démarrer l&apos;essai gratuit →</Link>
              <Link href="/dashboard" className="btn-lg s" style={{fontSize:16,padding:"16px 28px"}}>Voir une démo live</Link>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:22,fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)",flexWrap:"wrap"}}>
              <span><span style={{color:"var(--text)"}}>1 247</span> abonnés</span>
              <div style={{width:4,height:4,borderRadius:"50%",background:"var(--border)"}}></div>
              <span><span style={{color:"var(--gold)"}}>★</span> <span style={{color:"var(--text)"}}>4.8</span> Trustpilot</span>
              <div style={{width:4,height:4,borderRadius:"50%",background:"var(--border)"}}></div>
              <span>Sans CB</span>
              <div style={{width:4,height:4,borderRadius:"50%",background:"var(--border)"}}></div>
              <span>Annulable en 1 clic</span>
            </div>
          </div>
        </div>

        {/* JEU RESPONSABLE */}
        <div className="jr-wrap"><div className="jr-inner" id="jr"></div></div>

        {/* FOOTER */}
        <footer style={{background:"var(--bg)",borderTop:"1px solid var(--border)",padding:"60px 44px 40px"}}>
          <div style={{maxWidth:1220,margin:"0 auto",display:"grid",gridTemplateColumns:"2.2fr 1fr 1fr 1fr",gap:44,marginBottom:50}}>
            <div>
              <Link href="/" className="nlogo" style={{display:"inline-flex",marginBottom:16}}>
                <div className="nlogo-ic">P</div>
                <div><span className="nlogo-txt">PMU<em style={{fontStyle:"italic",color:"var(--gold)"}}>Gagnant</em></span><span className="nlogo-sub">TurfEdge · VMAX Engine</span></div>
              </Link>
              <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.75,fontStyle:"italic"}}>« Une lecture courte, un ticket prioritaire, et moins de bruit avant de jouer. »</p>
            </div>
            {[{t:"Produit",links:[["Aujourd'hui","/dashboard"],["Programme","/dashboard"],["Bilan mensuel","/bilan"],["Tarifs","#plans"],["Coach IA","/coach"]]},
              {t:"Compte",links:[["Connexion","/login"],["Inscription","/signup"],["Mes paris","/mes-paris"],["Abonnement","/subscribe"]]},
              {t:"Légal",links:[["Mentions légales","/mentions-legales"],["CGV / CGU","/cgv"],["Confidentialité","/politique-confidentialite"],["Cookies","/politique-cookies"],["Jeu responsable","/jeu-responsable"]]}
            ].map(col=>(
              <div key={col.t}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,letterSpacing:".16em",textTransform:"uppercase",color:"var(--muted)",marginBottom:16}}>{col.t}</div>
                <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10}}>
                  {col.links.map(([label,href])=><li key={label}><Link href={href} style={{fontSize:14,color:"var(--muted)",textDecoration:"none"}}>{label}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{maxWidth:1220,margin:"0 auto",paddingTop:22,borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:"var(--muted)"}}>
            <span>© 2026 PMU GAGNANT · TURFEDGE</span>
            <span style={{color:"rgba(255,255,255,.22)",fontSize:9}}>JOUER COMPORTE DES RISQUES · <a href="tel:0974751313" style={{color:"rgba(212,175,55,.4)",textDecoration:"none"}}>09 74 75 13 13</a> · <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" style={{color:"rgba(212,175,55,.4)",textDecoration:"none"}}>JOUEURS-INFO-SERVICE.FR</a></span>
          </div>
        </footer>
      </div>
    </>
  );
}
