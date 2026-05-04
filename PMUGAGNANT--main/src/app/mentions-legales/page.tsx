export const metadata = {
  title: "Mentions legales - PMU Gagnant",
};

export default function MentionsLegalesPage() {
  return (
    <div className="legal-page">
      <h1>Mentions legales</h1>
      <h2>Editeur</h2>
      <p>[NOM / RAISON SOCIALE], [ADRESSE], France.</p>
      <p>Email : contact@pmugagnant.com</p>
      <p>Directeur de publication : [PRENOM NOM]</p>
      <h2>Hebergement</h2>
      <p>Vercel Inc., San Francisco, CA.</p>
      <h2>Propriete intellectuelle</h2>
      <p>Tout le contenu du site PMU Gagnant est protege. Toute reproduction non autorisee est interdite.</p>
      <h2>Jeu responsable</h2>
      <p>Jouer comporte des risques : endettement, isolement, dependance.</p>
      <p>Pour etre aide, appelez le 09 74 75 13 13 ou consultez <a href="https://www.joueurs-info-service.fr">joueurs-info-service.fr</a>.</p>
    </div>
  );
}
