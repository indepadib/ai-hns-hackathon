# Invitation deployment contract — 28 November 2026

## Safety defaults
No actual email is sent unless the runtime is ai.hns.ma, HNS_INVITATION_SEND_ENABLED=true, a verified sender and API key exist, and an authenticated RH/admin explicitly confirms the action. Preview and EML do not imply delivery. Resend acceptance is not inbox delivery. An uncertain response stays review_required; do not automatically resend. Do not replace the existing production recruitment site with this repository.

## Server-side configuration
- HNS_RECRUITMENT_KEY: existing production recruitment API access.
- HNS_RECRUITMENT_BRIDGE_KEY: separate random secret (32+ chars); share with recruitment backend only.
- HNS_RESEND_API_KEY: approved transactional provider credential.
- HNS_INVITATION_FROM: verified H&S sender identity.
- HNS_INVITATION_SEND_ENABLED: keep false/unset until acceptance testing and operator approval.

## Recruitment integration contract
The current candidate source is GET https://ai.hns.ma/.netlify/functions/candidates-admin (Bearer recruitment key). Verify exact schema id/name/email/status and the meaning of selected/invited/confirmed with the recruitment owner; do not invite merely shortlisted candidates. Mission Control sync creates deterministic, idempotent access records. Staging is isolated to TEST- records for RSVP/check-in/email previews.

Recruitment backend may poll Mission Control POST /api/mission with Authorization: Bearer HNS_RECRUITMENT_BRIDGE_KEY and JSON {"action":"recruitment-status","candidateIds":["candidate-id"]}. Maximum 100 IDs. The response entries contain candidateId, passStatus, mailStatus, sentAt (provider acceptance time), rsvp, respondedAt, checkedInAt, submitted. Merge by original candidate ID; never infer RH selection from operational status. Do not send the bridge secret to browsers. Recruitment UI/backend connector remains to be installed in the actual recruitment sources.

## Release gates
1. Recover live recruitment source and verify hosting/route ownership and approved statuses. Map email fields, consent, event logistics and sender identity; verify provider data handling.
2. Deploy preview only; create TEST- pass, export EML, open Outlook/Gmail/mobile; test CID attachment and plain text.
3. RSVP with TEST code, confirm/decline, check-in twice, login, revoke; verify repeat scans and concurrent state transitions.
4. Validate authenticated status bridge with synthetic IDs and reject bad secret; integrate recruitment UI via its own backend.
5. Deploy production without replacing candidate forms, records or functions; smoke-test approved synthetic identity first.
6. Verify transactional provider against an authorized test recipient. Enable real send only after explicit operational approval. Reconcile accepted/review_required with provider and implement authenticated delivery webhooks before claiming delivered.
