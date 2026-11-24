# H&S AI Talent Challenge — 2026

Plateforme unifiée : recrutement, CV, invitations, confirmation, accueil, Mission Control et jury.

## Routes
- `/` — site public et candidature
- `/admin-recrutement.html` — Talent Center RH
- `/invitation-confirm/` — confirmation candidat
- `/mission-control/` — hackathon et espaces de travail

## Développement
```sh
npm install
npm run verify
npx netlify dev
```

Les tests utilisent uniquement des candidats fictifs, des stores simulés et un fournisseur de mail mocké. La préproduction est un projet Netlify distinct.

## Production : conserver le projet existant
Site Netlify `ai-hns-hackathon` (33dae2ce-086d-4470-b6fe-248f3ca49b70), domaine `ai.hns.ma`.
Ne pas transférer le domaine à la préproduction, recréer le site, réimporter le CSV ou renommer le store. Le recrutement conserve le store `hns-ai-recruitment-2026` (eu-central-1) et le formulaire `hns-ai-candidates-2026`. Les CV restent liés au formulaire historique. Mission Control utilise son store distinct `hns-ai-mission-control` sur le même projet.

Le code est restauré et testé en CI ; la validation réelle sur production reste une étape distincte. Voir [procédure de publication](docs/UNIFIED_RELEASE.md) et [.env.example](.env.example). Aucun secret, dossier candidat, CV ou export CSV ne doit entrer dans GitHub.
