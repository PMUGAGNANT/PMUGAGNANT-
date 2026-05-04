export const metadata = {
  title: "Politique de confidentialite - PMU Gagnant",
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="legal-page">
      <h1>Politique de confidentialite</h1>
      <h2>Donnees collectees</h2>
      <p>Nous collectons l&apos;email, le Telegram ID optionnel et les donnees d&apos;usage du service.</p>
      <h2>Finalites</h2>
      <ul>
        <li>Gestion du compte utilisateur.</li>
        <li>Envoi des pronostics et alertes.</li>
        <li>Mesure d&apos;audience et analytics.</li>
      </ul>
      <h2>Tiers</h2>
      <p>Les donnees peuvent etre traitees par Supabase (base de donnees), Stripe (paiement), Vercel (hebergement), Google Analytics et Meta Pixel.</p>
      <h2>Droits RGPD</h2>
      <p>Vous pouvez demander l&apos;acces, la rectification ou la suppression de vos donnees via contact@pmugagnant.com.</p>
    </div>
  );
}
