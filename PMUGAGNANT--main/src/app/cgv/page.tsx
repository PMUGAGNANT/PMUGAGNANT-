export const metadata = {
  title: "CGV - PMU Gagnant",
};

export default function CgvPage() {
  return (
    <div className="legal-page">
      <h1>Conditions generales de vente</h1>
      <h2>Prix</h2>
      <p>Premium : 19 EUR TTC/mois. Annuel : 149 EUR TTC/an.</p>
      <h2>Paiement</h2>
      <p>Les paiements sont traites par Stripe, prestataire conforme PCI-DSS.</p>
      <h2>Retractation</h2>
      <p>Le droit de retractation n&apos;est pas applicable aux contenus numeriques fournis immediatement, conformement a l&apos;article L221-28 du Code de la consommation.</p>
      <h2>Resiliation</h2>
      <p>L&apos;abonnement peut etre resilie a tout moment depuis l&apos;espace compte.</p>
      <h2>Responsabilite</h2>
      <p>PMU Gagnant est un service de pronostics et d&apos;aide a la decision. Aucune garantie de gain n&apos;est fournie.</p>
      <h2>Litiges</h2>
      <p>Les tribunaux francais sont competents. Mediateur : <a href="https://www.medicys.fr">medicys.fr</a>.</p>
    </div>
  );
}
