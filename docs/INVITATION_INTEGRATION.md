# Unified invitation contract — H&S AI Talent Challenge 2026

## Production and safety
Production is the original ai.hns.ma Netlify project, 33dae2ce-086d-4470-b6fe-248f3ca49b70. Preserve its candidate store and historical Forms data. Mission Control reads the original RH store directly; there is no cross-site recruitment API dependency. Real sending is disabled unless the site and deploy context match, HNS_UNIFIED_PRODUCTION=true, HNS_INVITATION_SEND_ENABLED=true, provider configuration exists and RH explicitly confirms.

## Configuration
Preserve HNS_ADMIN_TOKEN and HNS_NETLIFY_API_TOKEN. Configure separate HNS_SESSION_SECRET, HNS_ADMIN_KEY, HNS_RH_KEY and HNS_JURY_KEY. HNS_RESEND_API_KEY / HNS_INVITATION_FROM (or RESEND_API_KEY / HNS_EMAIL_FROM) are required for delivery. HNS_RECRUITMENT_BRIDGE_KEY is optional for a server integration, never expose it in a browser. The original RH UI uses its existing authenticated RH access, not this optional key.

## Flow
Eligible RH records: selected, invited, confirmed. Real sending is allowed only for selected records without a prior invitation. The stable pass links the original candidate ID to a deterministic invitation code. A signed QR is scanned by authorized staff; access activates on successful check-in. RSVP and operational statuses are read by the RH UI from POST /api/mission action recruitment-status (maximum 100 IDs per call). Provider acceptance and RH reconciliation are separate statuses; an uncertain result needs manual review, never automated resend. Provider acceptance does not prove delivery.

## Release
The synthetic integration suite covers the flow with mock stores and provider. It does not certify real mail delivery or production credentials. See UNIFIED_RELEASE.md for cutover, preview, and rollback. Do not send real mail until authorized sender and internal delivery test are verified.
