# Plan : Comptes utilisateurs + Paris fictifs avec Supabase

## Objectif
Ajouter un système de compte ultra simple (email + mot de passe, sans vérification email) et permettre aux utilisateurs de placer des paris fictifs sur les courses pour ensuite voir leurs résultats.

## Stack
- **@supabase/supabase-js** - Client Supabase
- **@supabase/ssr** - Helpers pour Next.js (cookies)
- Tables Supabase pour les paris fictifs

## Base de données Supabase (3 tables)

### Table `profiles` (auto-créée via trigger)
- `id` (uuid, FK vers auth.users)
- `email` (text)
- `solde` (integer, default 1000) — solde fictif en unités
- `created_at` (timestamp)

### Table `bets` (paris fictifs)
- `id` (uuid, auto)
- `user_id` (uuid, FK vers profiles)
- `date_str` (text) — date de la course DDMMYYYY
- `reunion` (integer)
- `course` (integer)
- `hippodrome` (text)
- `heure_depart` (text)
- `cheval_num` (integer)
- `cheval_nom` (text)
- `type_pari` (text) — 'GAGNANT' ou 'PLACE'
- `mise` (integer) — montant misé
- `cote` (numeric) — cote au moment du pari
- `statut` (text) — 'EN_ATTENTE', 'GAGNE', 'PLACE', 'PERDU'
- `gain` (numeric, nullable) — gain net
- `created_at` (timestamp)

## Fichiers à créer/modifier

### Nouveaux fichiers :
1. **`src/lib/supabase.ts`** — Client Supabase (browser + server)
2. **`src/app/login/page.tsx`** — Page de connexion/inscription (un seul formulaire toggle)
3. **`src/app/api/bets/route.ts`** — API POST pour placer un pari, GET pour lister ses paris
4. **`src/app/api/bets/settle/route.ts`** — API POST pour régler les paris (vérifier résultats)
5. **`src/app/mes-paris/page.tsx`** — Page "Mes Paris" avec historique et solde
6. **`.env.local`** — Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY

### Fichiers à modifier :
7. **`src/app/course/[reunion]/[course]/page.tsx`** — Ajouter bouton "Parier" sur la page pronostic
8. **`src/app/page.tsx`** — Ajouter icône profil dans le header + vérifier auth
9. **`src/app/layout.tsx`** — Potentiellement wrapper auth context

## Flux utilisateur

1. **Premier lancement** : L'utilisateur voit le site normalement (pas de login obligatoire)
2. **Pour parier** : Clic sur "Parier" → redirigé vers /login s'il n'est pas connecté
3. **Login/Inscription** : Page simple avec email + mot de passe, toggle entre "Se connecter" et "Créer un compte"
4. **Placer un pari** : Sur la page course, bouton vert "PARIER" en bas. Modal ou section avec :
   - Choix du cheval (proposé = favori, mais peut choisir dans le top 5)
   - Type de pari (Gagnant ou Placé)
   - Mise (1-5 unités via +/- ou slider)
   - Affichage de la cote et du gain potentiel
   - Bouton "Confirmer le pari"
5. **Mes Paris** : Page accessible depuis la bottom bar ou le header, affiche le solde, historique des paris avec résultats

## Config Supabase (à faire manuellement par l'utilisateur)
- Créer un projet Supabase
- Désactiver la vérification email dans Auth > Settings > Email > "Confirm email" = OFF
- Exécuter le SQL pour créer les tables
- Copier l'URL et l'anon key dans .env.local

## Bottom Tab Bar mise à jour
- 🏇 Courses (/)
- ⚡ Live (/course/...)
- 💰 Mes Paris (/mes-paris) — remplace ou s'ajoute à Bilan
- 📊 Bilan (/bilan)

Comme on a 4 items, la tab bar s'adapte en 4 colonnes.
