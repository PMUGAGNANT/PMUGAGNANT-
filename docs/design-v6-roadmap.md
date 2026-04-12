# PMU Gagnant - Roadmap Design / Structure V6

## Objectif

Faire passer PMU Gagnant d'une application "fonctionnelle avec une belle couche UI"
a un vrai produit V6 :

- plus clair
- plus premium
- plus ordonne
- plus coherent
- plus rapide a lire
- plus explicable
- meilleur sur mobile et desktop

La V6 design ne doit pas etre une nouvelle palette posee sur l'existant.
Elle doit refaire :

- la structure
- la hierarchie
- le systeme visuel
- les composants
- l'experience de lecture

## Diagnostic du produit actuel

### Ce qui est deja bon

- Le shell existe deja : `layout`, `AppShell`, `Sidebar`, `BottomNav`.
- Le site a deja un langage produit : accueil, course, premium, bilan, resultats.
- Le moteur produit deja des informations riches qui meritent une meilleure mise en scene.
- Les composants sont nombreux, donc la matiere existe deja pour une V6.

### Ce qui bloque encore

- L'accueil est tres dense et melange trop de niveaux de lecture.
- La sidebar reste lourde et ressemble plus a une colonne de blocs qu'a un vrai panneau produit.
- Le design system n'est pas assez ferme : surfaces, espacements, boutons, badges et cartes n'ont pas encore une discipline V6.
- Plusieurs pages ont une logique visuelle differente (`/`, `/premium`, `/course`, `/bilan`).
- Le theme "warm / dark" manque d'une direction produit nette.
- Une partie du texte contient encore des problemes d'encodage visibles dans l'UI.
- Le site montre beaucoup d'information, mais pas toujours dans le bon ordre.

## Vision V6

Le produit doit ressembler a un "control room" premium de decision turf :

- froid
- net
- lisible
- sobre
- haut de gamme
- sans effet vieillot

Direction recommande :

- base claire haut de gamme en mode par defaut
- mode nuit plus dense et plus sobre
- graphite, porcelaine, acier, bleu signal, cyan froid, accent ambre reserve aux alertes
- grande clarte typographique
- moins de decoration
- plus de structure

## Les 6 piliers V6

### 1. Information architecture

Chaque page doit avoir un role unique.

- `/` : decision rapide du jour
- `/course/[reunion]/[course]` : lecture complete d'une course
- `/premium` : offre et conversion
- `/mes-paris` : espace action / suivi personnel
- `/bilan` : cockpit de performance
- `/resultats` : lecture historique et preuve
- `/blog` : acquisition / education

### 2. Shell produit

Le shell doit devenir un vrai cadre de lecture.

- sidebar plus structurante
- header plus fin, plus net, moins envahissant
- contenu centre sur une grille produit constante
- meilleure gestion des sticky zones
- meilleure transition desktop / mobile

### 3. Design system

La V6 doit imposer un systeme fort :

- tokens couleur
- tokens typo
- tokens radius
- tokens spacing
- tokens elevation
- tokens borders
- tokens states

### 4. Component system

Tous les composants importants doivent etre harmonises :

- hero
- stat cards
- race cards
- badges
- tabs
- accordions
- tables
- panels
- filters
- buttons
- paywall blocks

### 5. Reading hierarchy

L'ordre de lecture doit etre strict :

- ce qu'il faut regarder
- pourquoi c'est important
- ce qu'il faut faire
- ce qu'il faut ignorer

### 6. Product polish

La V6 doit aussi corriger les details qui cassent la sensation premium :

- textes mal encodes
- inconsistance de labels
- contrastes fluctuants
- composants trop bavards
- scroll et overflow peu elegants

## Cible structurelle par page

### Home V6

Role :
- donner en moins de 10 secondes la bonne lecture du jour

Structure cible :

1. Hero decisionnel
- course du jour
- signal principal
- confiance
- action recommande

2. Rail de priorites
- a jouer
- a surveiller
- a laisser

3. Programme ordonne
- liste compacte et scannable
- ouverture en detail a la demande

4. Preuve / performance
- bilan
- resultats
- methode

La home doit devenir moins "landing page melangee" et plus "tableau de bord editorial".

### Course V6

Role :
- transformer une course en decision claire

Structure cible :

1. Header course
- hippodrome
- heure
- discipline
- lisibilite
- recommandation

2. Bloc ticket
- cheval principal
- type de pari
- mise
- confiance

3. Pourquoi
- facteurs positifs
- alertes
- risque

4. Peloton
- table des participants
- tri
- details a la demande

5. Marche / contexte
- cotes
- ferrure
- mouvement

6. Resultat / preuve
- si termine

La page course doit etre le coeur de la V6.

### Premium V6

Role :
- vendre une lecture claire, pas juste un abonnement

Structure cible :

1. promesse simple
2. ce qui est debloque
3. preuve
4. prix
5. FAQ
6. CTA

### Bilan V6

Role :
- devenir un cockpit analytique

Structure cible :

1. headline KPI
2. courbe de performance
3. decomposition par segment
4. meilleures / pires zones
5. insights automatiques
6. comparaison moteur vs hasard

### Mes Paris V6

Role :
- espace personnel simple et actionnable

Structure cible :

1. statut de compte
2. paris ouverts
3. historiques
4. bankroll / progression
5. abonnement / bonus / referral

## Design system V6

### Palette

Systeme recommande :

- `bg-canvas`
- `bg-elevated`
- `bg-panel`
- `bg-panel-strong`
- `text-strong`
- `text-muted`
- `text-soft`
- `border-soft`
- `border-strong`
- `accent-primary`
- `accent-primary-soft`
- `accent-warning`
- `accent-danger`
- `accent-success`

Important :
- pas de turquoise dominant partout
- pas de bleu petrol vintage
- pas de creme retro avec typo editorial lourde

### Typographie

Il faut separer clairement :

- typo UI
- typo display
- typo data

Cible :

- interface : propre, technique, contemporaine
- titres : nets, premium, sans effet magazine retro
- chiffres : lisibles, fermes, denses

### Surfaces

Il faut 4 niveaux maximum :

- fond
- surface standard
- surface elevee
- surface focus

Chaque niveau doit avoir :

- fond
- bordure
- ombre
- etat hover

### Radius

Le produit doit arreter de melanger trop de rayons differents.

Cible :

- `12`
- `18`
- `24`
- `32`

### Spacing

Base 4 ou 8, pas un melange libre.

## Composants a refaire en priorite

### Niveau 1 - fondation

- [layout.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/layout.tsx)
- [globals.css](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/globals.css)
- [AppShell.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/AppShell.tsx)
- [Sidebar.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/Sidebar.tsx)
- [BottomNav.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/BottomNav.tsx)
- [ThemeProvider.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/ThemeProvider.tsx)
- [ThemeToggle.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/ThemeToggle.tsx)

### Niveau 2 - lecture principale

- [page.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/page.tsx)
- [PronoHero.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/PronoHero.tsx)
- [RadarHero.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/RadarHero.tsx)
- [CourseCard.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/CourseCard.tsx)
- [LiveStatsBanner.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/LiveStatsBanner.tsx)

### Niveau 3 - page course

- [page.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/course/[reunion]/[course]/page.tsx)
- [CoursePronostic.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/CoursePronostic.tsx)
- [ParticipantsTable.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/ParticipantsTable.tsx)
- [ConfidenceBadge.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/components/ui/ConfidenceBadge.tsx)

### Niveau 4 - conversion et preuve

- [page.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/premium/page.tsx)
- [page.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/bilan/page.tsx)
- [page.tsx](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/resultats/page.tsx)

## Phases de chantier

### Phase 0 - hygiene visuelle

Objectif :
- nettoyer ce qui empeche la sensation premium tout de suite

Actions :
- corriger les textes mal encodes
- figer les tokens principaux
- simplifier les ombres et bordures
- nettoyer les contrastes incoherents

### Phase 1 - shell V6

Objectif :
- poser le cadre de toute l'application

Actions :
- refondre `globals.css`
- refondre `layout.tsx`
- refaire `AppShell`
- refaire `Sidebar`
- refaire `BottomNav`

Resultat attendu :
- le site "respire mieux" partout, meme avant de refaire les pages

### Phase 2 - home V6

Objectif :
- transformer la home en tableau de bord premium

Actions :
- reconstruire le hero
- reconstruire les rails de priorite
- simplifier la liste des courses
- mieux separer analyse / preuve / promo

### Phase 3 - course V6

Objectif :
- rendre la page course exemplaire

Actions :
- header course fort
- bloc ticket principal
- bloc pourquoi
- peloton lisible
- panneaux secondaires deroulants

### Phase 4 - bilan/resultats V6

Objectif :
- donner une sensation de cockpit analytique

Actions :
- meilleure hierarchy KPI
- graphiques plus nets
- insights plus lisibles
- vues comparatives plus propres

### Phase 5 - premium / compte V6

Objectif :
- aligner conversion et espace utilisateur avec le reste du produit

Actions :
- premium plus sobre
- pricing plus clair
- `mes-paris` plus mature
- bankroll / statut / bonus mieux structures

### Phase 6 - polish V6

Objectif :
- finir les details qui font le haut de gamme

Actions :
- animations d'entree utiles
- transitions de panneaux
- etats hover/focus
- tables mobiles
- sticky bars
- skeletons propres

## Ce que je recommande de faire en premier

Ordre ideal :

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3

Pourquoi :

- le shell touche tout
- la home est la vitrine
- la page course est le coeur produit

## KPI V6 design

Le succes de la refonte ne doit pas etre juge seulement "au feeling".

Mesures utiles :

- temps pour comprendre le signal principal
- temps pour ouvrir la bonne course
- taux de clic home vers page course
- taux de clic vers premium
- taux de scroll utile
- baisse des abandons sur mobile
- stabilite visuelle desktop/mobile

## Definition de done

La V6 design sera consideree comme reussie si :

- le shell est coherent sur toutes les pages
- la home est plus lisible en moins de 10 secondes
- la page course rend la decision evidente
- le premium ne jure plus avec le reste du produit
- le bilan ressemble a un vrai cockpit
- les textes mal encodes ont disparu
- le produit a une identite visuelle forte et contemporaine

## Prochaine etape de production

Le meilleur prochain chantier concret est :

### V6 Design - Phase 0 + Phase 1

Livrables :

- nettoyage encodage / labels
- nouveau systeme de tokens
- refonte `layout`
- refonte `AppShell`
- refonte `Sidebar`
- refonte `BottomNav`

C'est la partie la plus rentable parce qu'elle modernise tout le site d'un coup.
