# Architecture V6

## Cible retenue

Architecture idiomatique pour `Next.js + React + TypeScript + Vercel` :

- `src/app`
  - routes, layouts et entrypoints Next.js uniquement
  - pages minces qui deleguent aux modules metier
- `src/features`
  - modules par domaine fonctionnel
  - UI metier, orchestration d'ecran, clients API front dedies
- `src/components/ui`
  - couche de compatibilite temporaire pendant la migration
  - re-exports vers les nouveaux modules `features/*`
- `src/lib`
  - logique transverse, moteur, services serveur et integrations deja stables
  - a migrer progressivement par domaines sensibles quand la surface sera plus sure

## Domaines actifs

- `features/home`
- `features/race`
- `features/layout`
- `features/account`
- `features/premium`
- `features/results`
- `features/blog`
- `features/performance`
- `features/races/api`

## Regles

1. Une page Next.js dans `src/app` ne porte pas la logique principale d'ecran.
2. Un composant metier vit dans sa `feature`.
3. Un composant reellement transverse peut rester dans `src/components/ui`.
4. Les appels front vers `/api/*` passent par des clients dedies de feature.
5. La navigation du shell ne doit pas etre dupliquee : config centralisee.
6. Les shims `src/components/ui/*` sont temporaires et servent a eviter une migration cassante.

## Prochaine etape naturelle

- reduire progressivement les shims `src/components/ui`
- continuer la migration serveur par domaines (`races`, `billing`, `learning`, `cron`)
- rapprocher les types metier des features quand ils ne sont plus transverses
