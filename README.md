# H&S AI Talent Challenge — 2026

Dépôt de développement du programme H&S AI Talent Challenge du 28 novembre 2026.

> **Statut : reconstruction contrôlée.** Le site officiel `ai.hns.ma` a été publié précédemment hors de GitHub ; ses sources complètes ne sont pas encore intégrées ici. Ne pas connecter ce dépôt à la production avant migration et recette des candidatures.

## Périmètre

- **Site public / candidatures** : conservation du site existant, récupération des sources à effectuer.
- **Mission Control** : portail opérationnel du hackathon, sous `/mission-control/`.
- **Backend** : fonctions Netlify, Netlify Blobs pour les espaces de travail.
- **Rôles** : administrateur, RH, jury, participant, autorisations vérifiées côté serveur.
- **Tests** : suite Node.js et future recette E2E sur staging.

## Démarrage local

```sh
npm install
npx netlify dev
```

La page Mission Control est disponible à `/mission-control/`. Voir `.env.example` pour les variables nécessaires. **Aucun secret ni aucune donnée réelle de candidature ne doit être commité.**

## État de livraison

Le code présent ici est une **base de développement**, non une livraison validée en production. Les accès, la persistance Netlify et les parcours doivent être testés sur un déploiement Netlify avant activation.

## Déploiement

Déployer initialement en préproduction uniquement. Ne jamais remplacer directement `ai.hns.ma` avec ce dépôt tant que sa landing page, son formulaire et les candidatures n'ont pas été migrés et vérifiés. Voir `docs/RELEASE_CHECKLIST.md`.
