'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import s from './LandingPage.module.css'

interface Stats {
  roi: number
  successRate: number
  daysOfData: number
}

interface Props {
  stats: Stats
}

export default function LandingPage({ stats }: Props) {
  const router = useRouter()

  return (
    <div className={s.lp}>

      {/* NAV */}
      <nav className={s.nav}>
        <Link href="/" className={s.navLogo}>PMU<span>.</span>GAGNANT</Link>
        <div className={s.navCenter}>
          <Link href="/pronostics" className={s.navLink}>Pronostics</Link>
          <Link href="/historique" className={s.navLink}>Résultats</Link>
          <a href="#comment" className={s.navLink}>Comment ça marche</a>
          <a href="#tarifs" className={s.navLink}>Tarifs</a>
        </div>
        <div className={s.navRight}>
          <button className={s.navLogin} onClick={() => router.push('/login')}>Connexion</button>
          <button className={s.navCta} onClick={() => router.push('/login')}>Essai gratuit</button>
        </div>
      </nav>

      {/* HERO */}
      <div className={s.hero}>
        <div className={s.heroBg} />
        <div className={s.heroGrid} />
        <div className={s.heroBadge}>
          <div className={s.liveDot} />
          Algorithme V10.1 · Pronostics mis à jour ce matin à 7h
        </div>
        <h1 className={s.heroH1}>
          Les pronostics PMU que<br />
          <em>les bookmakers redoutent</em>
        </h1>
        <p className={s.heroSub}>
          Intelligence artificielle entraînée sur {stats.daysOfData} jours de courses.
          5 sélections par course, livrées chaque matin avant l&apos;ouverture des guichets.
        </p>
        <div className={s.heroCtas}>
          <button className={s.btnMain} onClick={() => router.push('/pronostics')}>Voir les pronostics du jour</button>
          <a href="#comment" className={s.btnGhost} style={{textDecoration:'none',display:'inline-flex',alignItems:'center'}}>Comment ça marche ?</a>
        </div>
        <div className={s.heroPreview}>
          <div className={s.previewBar}>
            <div className={s.previewDots}>
              <div className={`${s.previewDot} ${s.previewDotR}`} />
              <div className={`${s.previewDot} ${s.previewDotY}`} />
              <div className={`${s.previewDot} ${s.previewDotG}`} />
            </div>
            <div className={s.previewLabel}>PMU GAGNANT · TABLEAU DE BORD</div>
          </div>
          <div className={s.previewRace}>
            <div className={s.previewRaceInfo}>
              <div className={s.previewRaceName}>R1C5 — Vincennes · Quinté Trot Attelé</div>
              <div className={s.previewRaceMeta}>16 partants · 2 100m · 14h10</div>
            </div>
            <div className={s.previewPicks}>
              <span className={`${s.pickPill} ${s.pickChoix}`}>🎯 n°4</span>
              <span className={`${s.pickPill} ${s.pickPepite}`}>💎 n°11</span>
              <span className={`${s.pickPill} ${s.pickOut}`}>⚡ n°7</span>
            </div>
          </div>
          <div className={`${s.previewRace} ${s.previewRaceDim}`}>
            <div className={s.previewRaceInfo}>
              <div className={s.previewRaceName}>R2C3 — Longchamp · Plat Handicap</div>
              <div className={s.previewRaceMeta}>12 partants · 1 600m · 15h30</div>
            </div>
            <div className={s.previewPicks}>
              <span className={`${s.pickPill} ${s.pickChoix}`}>🎯 n°2</span>
              <span className={`${s.pickPill} ${s.pickPepite}`}>💎 n°8</span>
            </div>
          </div>
          <div className={s.previewGlow} />
        </div>
      </div>

      {/* STATS */}
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statN}>+<span>{stats.roi.toFixed(0)}</span>%</div><div className={s.statL}>ROI annuel</div><div className={s.statDelta}>↑ sur {stats.daysOfData} jours</div></div>
        <div className={s.stat}><div className={s.statN}><span>{stats.successRate}</span>%</div><div className={s.statL}>Taux de succès</div><div className={s.statDelta}>↑ stable</div></div>
        <div className={s.stat}><div className={s.statN}><span>5</span></div><div className={s.statL}>Picks / course</div><div className={s.statDelta}>Rôles distincts</div></div>
        <div className={s.stat}><div className={s.statN}><span>7h</span></div><div className={s.statL}>Heure de livraison</div><div className={s.statDelta}>Chaque matin</div></div>
      </div>

      {/* PROOF */}
      <div className={s.proofStrip}>
        <div className={s.proofItem}><span>🛡️</span><span className={s.proofTxt}>Données PMU officielles</span></div>
        <div className={s.proofItem}><span>✈️</span><span className={s.proofTxt}>Bot Telegram inclus PRO</span></div>
        <div className={s.proofItem}><span>🔄</span><span className={s.proofTxt}>Cotes actualisées toutes les 5 min</span></div>
        <div className={s.proofItem}><span>🔓</span><span className={s.proofTxt}>Sans engagement · Résiliation en 1 clic</span></div>
      </div>

      {/* 5 ROLES */}
      <div className={s.section}>
        <div className={s.sEyebrow}>Sélections IA</div>
        <h2 className={s.sTitle}>5 rôles. Une stratégie imparable.</h2>
        <p className={s.sSub}>Chaque course analysée produit 5 profils de chevaux avec des objectifs distincts. Les marchés PMU sont efficaces sur les favoris — inefficaces sur les outsiders. On exploite ça.</p>
        <div className={s.rolesWrap}>
          <div className={`${s.role} ${s.roleHot}`}><span className={s.roleIco}>🎯</span><div className={s.roleTag}>Favori algo</div><div className={s.roleName}>Le Choix</div><div className={s.roleDesc}>Score global le plus élevé. Base solide pour couplés et tiercés.</div><span className={`${s.roleBadge} ${s.badgeSafe}`}>Sécurité</span></div>
          <div className={`${s.role} ${s.roleHot2}`}><span className={s.roleIco}>💎</span><div className={`${s.roleTag} ${s.roleTagAmber}`}>Value bet</div><div className={s.roleName}>La Pépite</div><div className={s.roleDesc}>Cote sous-évaluée par le marché. Le vrai avantage statistique.</div><span className={`${s.roleBadge} ${s.badgeValue}`}>Value ★</span></div>
          <div className={s.role}><span className={s.roleIco}>🏹</span><div className={s.roleTag}>Podium</div><div className={s.roleName}>Le Chasseur</div><div className={s.roleDesc}>Profil régulier, forme ascendante. Idéal pour les placés.</div><span className={`${s.roleBadge} ${s.badgeSafe}`}>Placé</span></div>
          <div className={s.role}><span className={s.roleIco}>🥉</span><div className={s.roleTag}>Sécurité</div><div className={s.roleName}>Le Podium</div><div className={s.roleDesc}>Cheval de fond de tiercé. Combiné pour quarté et quinté.</div><span className={`${s.roleBadge} ${s.badgeSafe}`}>Combiné</span></div>
          <div className={`${s.role} ${s.roleHot2}`}><span className={s.roleIco}>⚡</span><div className={`${s.roleTag} ${s.roleTagAmber}`}>Surprise</div><div className={s.roleName}>L&apos;Outsider</div><div className={s.roleDesc}>Grosse cote, signal algorithmique fort. Rapport risque/gain maximal.</div><span className={`${s.roleBadge} ${s.badgeBoom}`}>Coup ★</span></div>
        </div>
      </div>

      <div className={s.divider} />

      {/* HOW */}
      <div className={s.section} id="comment">
        <div className={s.sEyebrow}>Fonctionnement</div>
        <h2 className={s.sTitle}>De l&apos;analyse au virement, en 3 étapes</h2>
        <p className={s.sSub}>Zéro effort de votre côté. L&apos;algorithme tourne pendant que vous dormez.</p>
        <div className={s.howGrid}>
          <div className={s.howCard}><div className={s.howNum}>01</div><span className={s.howIco}>🔬</span><div className={s.howT}>Analyse nocturne</div><p className={s.howP}>Chaque nuit, l&apos;algorithme V10.1 ingère le programme PMU du lendemain. Forme récente, jockey, hippodrome, distance, cotes — tout est pondéré avec décroissance temporelle.</p></div>
          <div className={s.howCard}><div className={s.howNum}>02</div><span className={s.howIco}>📡</span><div className={s.howT}>Livraison à 7h</div><p className={s.howP}>Les 5 picks arrivent sur votre tableau de bord et sur votre bot Telegram PRO avant l&apos;ouverture des guichets. Cotes mises à jour toutes les 5 minutes.</p></div>
          <div className={s.howCard}><div className={s.howNum}>03</div><span className={s.howIco}>📊</span><div className={s.howT}>Résultats automatiques</div><p className={s.howP}>Les arrivées sont importées 30 minutes après chaque course. Votre ROI personnel est recalculé en temps réel. L&apos;algorithme apprend de chaque résultat.</p></div>
        </div>
      </div>

      <div className={s.divider} />

      {/* TEMOIGNAGES */}
      <div className={s.section}>
        <div className={s.sEyebrow}>Ils l&apos;utilisent</div>
        <h2 className={s.sTitle}>Ce que disent les abonnés PRO</h2>
        <p className={s.sSub}>Des joueurs sérieux, pas des débutants. Des résultats mesurables.</p>
        <div className={s.temoGrid}>
          <div className={s.temo}><div className={s.temoStars}>★★★★★</div><p className={s.temoTxt}>&ldquo;La Pépite m&apos;a sorti deux coups à plus de 12 en un mois. J&apos;avais jamais vu ça avec les tipsters classiques.&rdquo;</p><div className={s.temoAuthor}><div className={s.temoAvatar}>ML</div><div><div className={s.temoName}>Marc L.</div><div className={s.temoRole}>Abonné depuis 4 mois</div></div></div></div>
          <div className={s.temo}><div className={s.temoStars}>★★★★★</div><p className={s.temoTxt}>&ldquo;J&apos;ai testé 3 sites de pronostics. PMU Gagnant est le seul qui me donne une logique claire derrière chaque pick. Le ROI suit.&rdquo;</p><div className={s.temoAuthor}><div className={s.temoAvatar}>ST</div><div><div className={s.temoName}>Sophie T.</div><div className={s.temoRole}>Abonnée depuis 6 mois</div></div></div></div>
          <div className={s.temo}><div className={s.temoStars}>★★★★☆</div><p className={s.temoTxt}>&ldquo;Le bot Telegram à 7h c&apos;est ce qu&apos;il me fallait. Je joue depuis mon téléphone en 2 minutes et je pars bosser.&rdquo;</p><div className={s.temoAuthor}><div className={s.temoAvatar}>RB</div><div><div className={s.temoName}>Romain B.</div><div className={s.temoRole}>Abonné depuis 2 mois</div></div></div></div>
        </div>
      </div>

      <div className={s.divider} />

      {/* PRICING */}
      <div className={s.section} id="tarifs">
        <div className={s.sEyebrow}>Tarifs</div>
        <h2 className={s.sTitle}>Commencez sans risque</h2>
        <p className={s.sSub}>Aucune carte bancaire pour l&apos;accès gratuit. Résiliez quand vous voulez.</p>
        <div className={s.pricingWrap}>
          <div className={s.plan}>
            <div className={s.planTop}><div className={s.planName}>Free</div><div className={s.planPrice}>0€ <small>/ mois</small></div><div className={s.planTagline}>Pour découvrir sans engagement</div></div>
            <ul className={s.planFeats}>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> 1 pick gratuit par jour</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> Résultats en différé (J+1)</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> Statistiques globales</li>
              <li className="dim"><span className={`${s.fi} ${s.fiNo}`}>✗</span> Les 5 picks complets</li>
              <li className="dim"><span className={`${s.fi} ${s.fiNo}`}>✗</span> Bot Telegram</li>
              <li className="dim"><span className={`${s.fi} ${s.fiNo}`}>✗</span> Historique personnel</li>
            </ul>
            <button className={`${s.planBtn} ${s.btnFree}`} onClick={() => router.push('/login')}>Créer un compte gratuit</button>
          </div>
          <div className={`${s.plan} ${s.planFeatured}`}>
            <div className={s.featBadge}>Recommandé · ROI prouvé +{stats.roi.toFixed(0)}%</div>
            <div className={s.planTop}><div className={s.planName}>Pro</div><div className={s.planPrice}>19€ <small>/ mois</small></div><div className={s.planTagline}>Pour les joueurs qui veulent gagner</div></div>
            <ul className={s.planFeats}>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> 5 picks complets par course</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> Résultats en temps réel</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> Bot Telegram à 7h</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> Historique {stats.daysOfData} jours</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> ROI &amp; stats personnalisés</li>
              <li><span className={`${s.fi} ${s.fiOk}`}>✓</span> La Pépite + L&apos;Outsider débloqués</li>
            </ul>
            <button className={`${s.planBtn} ${s.btnPro}`} onClick={() => router.push('/subscribe')}>Passer PRO maintenant</button>
          </div>
        </div>
      </div>

      {/* CTA BAND */}
      <div className={s.ctaBand}>
        <h2 className={s.ctaBandH}>Prêt à arrêter de parier à l&apos;aveugle ?</h2>
        <p className={s.ctaBandSub}>Rejoignez les abonnés PRO. Premiers picks dès ce matin.</p>
        <button className={s.ctaBandBtn} onClick={() => router.push('/subscribe')}>Commencer maintenant — 19€ / mois</button>
        <div className={s.ctaBandNote}>Sans engagement · Résiliez en 1 clic · Paiement sécurisé Stripe</div>
      </div>

      {/* FOOTER */}
      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div><div className={s.footerLogo}>PMU<span>.</span>GAGNANT</div><div className={s.footerTagline}>L&apos;intelligence artificielle au service du turf</div></div>
          <div className={s.footerLinks}>
            <Link href="/mentions-legales" className={s.footerLink}>Mentions légales</Link>
            <Link href="/confidentialite" className={s.footerLink}>Confidentialité</Link>
            <Link href="/contact" className={s.footerLink}>Contact</Link>
            <a href="https://t.me/pmugagnantbot" target="_blank" rel="noopener noreferrer" className={s.footerLink}>Telegram</a>
          </div>
        </div>
        <div className={s.footerBottom}>
          <div className={s.footerLegal}>© 2026 PMU Gagnant · Les résultats passés ne préjugent pas des résultats futurs.<br />Le jeu peut être dangereux. Jouez de manière responsable. Interdit aux mineurs.</div>
          <a href="https://t.me/pmugagnantbot" target="_blank" rel="noopener noreferrer" className={s.footerTg}>✈️ @pmugagnantbot</a>
        </div>
      </footer>

    </div>
  )
}
