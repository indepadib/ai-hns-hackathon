# Présélection groupée RH — intégration production à terminer

Cette branche contient une logique et une interface réutilisables, pas un back-office de production. Le dépôt officiel est incomplet : ne pas connecter ce dépôt à ai.hns.ma et ne pas déployer cette branche sur le site officiel.

## Parcours RH
1. Coller les numéros de soumission Netlify (virgules, points-virgules, retours à la ligne).
2. Prévisualiser : correspondance exacte, doublons, statut actuel, dossier protégé ou introuvable.
3. Confirmer uniquement les lignes éligibles ; aucune invitation.
4. Relire les dossiers, appliquer chaque mise à jour conditionnelle, afficher résultats et écarts.
5. Actualiser la liste RH et filtrer par le statut déjà existant « Sélectionné ».

## Intégration
- Retrouver la dernière archive complète de production et identifier les fonctions authentifiées de consultation et de mise à jour RH.
- Importer `mountBulkPreselection` depuis `public/rh-tools/bulk-preselection.js` dans la page RH existante. Fournir des adaptateurs `preview`, `apply`, `refresh` utilisant la session RH déjà en place.
- Intégrer `planPreselection` et `applyPreselection` côté serveur. L'autorisation vient de la session vérifiée, jamais du corps de la requête. Configurer la vraie valeur persistée de « Sélectionné » et la liste exhaustive des statuts éligibles, sans inclure les statuts finaux ou rejetés.
- Mapper les numéros Netlify vers les véritables identifiants et versions des dossiers. La mise à jour doit préserver les notes, l'historique, les décisions concurrentes, enregistrer l'acteur et ne déclencher aucun e-mail. Si le stockage existant ne permet pas une mise à jour conditionnelle sûre, ne pas activer la mutation.
- Ne pas committer les identifiants réels, les noms, CV, e-mails ou secrets. La liste est collée par un utilisateur RH autorisé.
- Tester sur données synthétiques dans un site de staging distinct, jamais sur les blobs de production. Vérifier en particulier l'accès refusé hors rôle RH, l'idempotence, les conflits et la persistance après rechargement.

Objectif métier : 150 dossiers en présélection, 60 décisions RH positives, environ 50 présents. Aucun quota ne doit écraser une décision existante.
