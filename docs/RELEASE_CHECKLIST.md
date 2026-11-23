# H&S AI — critères bloquants de mise en production

## Avant tout branchement de `ai.hns.ma`

- [ ] Sources authentiques de la landing page et de son formulaire récupérées.
- [ ] Export chiffré et restauration vérifiée des candidatures Netlify ; jamais dans Git.
- [ ] Formulaire de candidature, upload CV et accès RH existant : tests de non-régression.
- [ ] Aucun secret en dépôt (dépôt GitHub actuellement public).
- [ ] Branch Netlify staging branchée sur la bonne branche GitHub.
- [ ] Secrets Netlify : HNS_SESSION_SECRET, HNS_ADMIN_KEY, HNS_RH_KEY, HNS_JURY_KEY.
- [ ] Admin, RH, jury, participant : sessions et droits vérifiés sur backend réel.
- [ ] Check-in solo/binôme <= 2, création et révocation des accès.
- [ ] Sauvegarde, conflit de version, reprise et soumission testés.
- [ ] Jury : visibilité uniquement des dossiers soumis, notation et historique.
- [ ] CSP, accessibilité clavier, mobile, tests E2E et charge.
- [ ] Sauvegarde et plan de retour arrière préparés.

## Sécurité

Le code d'accès ne doit jamais être inclus en clair dans les données persistées. Ne jamais enregistrer de CV ou de données personnelles des candidats dans le dépôt. L'API applique les autorisations côté serveur. Tous les événements critiques doivent être audités avant ouverture au public.

## Statut

Ce document est une checklist, pas une preuve que les contrôles sont passés.
