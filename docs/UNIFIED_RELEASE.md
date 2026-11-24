# Release runbook — H&S AI Talent Challenge

## Verified target and rollback
- Original production project: ai-hns-hackathon, ID 33dae2ce-086d-4470-b6fe-248f3ca49b70.
- Domain: https://ai.hns.ma.
- Previously verified production deploy: 6af2529e0ab21479671527f5. Recheck current deploy immediately before cutover and save its ID for rollback.
- Separate staging: bcd59e76-cfeb-483a-8575-66c40202b230. Never move the custom domain to staging.
- Keep Netlify Forms enabled on the existing production project. Preserve original RH store, region, form name and CV form ID. The provided CSV is not a complete RH decision backup and must not be imported.

## Preflight
- Merge only after CI and isolated Netlify staging checks pass.
- Link existing Netlify production project to indepadib/ai-hns-hackathon, or use an explicitly authorized deployment credential in GitHub Actions. Linking is an administrative Netlify operation, not a source-code commit.
- Preserve HNS_ADMIN_TOKEN and HNS_NETLIFY_API_TOKEN. Set new Mission Control credentials HNS_SESSION_SECRET (32+ random characters), HNS_ADMIN_KEY, HNS_RH_KEY, HNS_JURY_KEY (distinct strong values). Do not put secrets in GitHub source or logs.
- Set HNS_UNIFIED_PRODUCTION=true only for the original site's production functions. Keep HNS_INVITATION_SEND_ENABLED=false. Set verified provider configuration separately.
- Confirm that current submissions, decisions, notes and CV access are backed up without exporting PII to GitHub. Do not use production candidates as test records.
- Verify preview static pages, denial of RH/CV access and invitation endpoints; verify synthetic full pass flow in CI.

## Cutover
Deploy the exact verified main commit to the original production project. Keep staging linked separately; never change domain ownership. If using Git-linked continuous deployment, select main, publish public, functions netlify/functions, Netlify Forms enabled. Confirm original production deploy remains restorable.

## Smoke checks after cutover
1. Public routes /, /admin-recrutement.html, /mission-control/, /invitation-confirm/ return 200.
2. GET /api/mission reports configuration healthy (no secrets).
3. Anonymous /candidates-admin and /candidate-cv requests are refused.
4. Authorized RH login: verify aggregate record count, existing statuses and notes, and an authorized existing CV, without editing. Verify same form ID and historical submissions.
5. Verify authenticated Mission Control operations against approved synthetic data only. Do not create a real invitation, send real mail or reimport candidates as part of smoke tests.
6. Roll back to saved Netlify production deploy immediately if access, forms, CVs, or data preservation fails. Rollback of code is not rollback of data: avoid destructive writes.

## Email activation
Confirm H&S sender identity, location, approved provider and authorized internal test address. Only after an email rendering and real provider test succeeds, enable HNS_INVITATION_SEND_ENABLED. Provider acceptance is not inbox delivery. For uncertain responses, review the provider before retrying; no automatic resend.

## Status
Source restoration and synthetic integration passed CI. Real production cutover, credential configuration and real delivery validation are not certified by those tests.
