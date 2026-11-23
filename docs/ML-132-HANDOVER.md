# ML-132 — Prescription sharing frontend

Baseline: frontend develop `d638ef3495b071799eb57e919657387b7e020c06`, retrieved 23 November 2026. Task: ML-132; real API integration: ML-179. Sources: Jira ML-132 and repository reference contract `02_API_CONTRACT.md` (prescription share endpoints and DTOs).

## Delivered

- `/workspace/patient/prescription-shares`: eligible prescription selector, one-time code dialog, status-filtered share list, pharmacy identity review, explicit prescription-only access confirmation, and reasoned revoke confirmation.
- `/workspace/pharmacist/prescription-shares`: code entry, active sample pharmacy membership selection, claim result and pending/confirmed/expired/revoked sample outcomes. Claim does not expose medicines, other patient data or dispensing controls.
- Existing authenticated workspace, role guard, account context and navigation. Both routes are lazy loaded and client rendered before the SSR wildcard. Direct navigation and application refresh covered by routing tests.
- Width 1100px, centered within existing workspace gutters; no duplicate page padding. Responsive cards and identity grids at 700px, native labeled controls, explicit status/error announcements, focus-trapped dialogs, Escape, focus return and validation focus.
- Loading, empty, retryable load error and mutation failure handling. Preview scenarios are explicitly labeled; sample records remain synthetic. Status deadlines refresh every second; the selected code clears on expiry.
- Only active doctor-source orders are eligible. Sample code is single claim, expires after 15 minutes, and claim cannot extend that deadline. Only explicit patient confirmation starts 24-hour access. Expired/revoked shares cannot be confirmed; pending or live shares can be revoked sooner.
- One-time code is absent from list models and is cleared from the screen on close/Escape, account/role change and destruction. No sharing data or raw claim tokens are written to storage, logs or URLs. Pending results are ignored after account changes or navigation. Revoke reason is trimmed and limited to 1–1000 characters.

## Scope

**This is an in-memory screen preview. No HTTP calls, backend/migration changes, real grants, real credentials or dispensing have been added.** Existing authentication remains required. Sample professional verification and membership text is a fixture, not a check of the signed-in pharmacist's real eligibility.

Each component owns its preview adapter. Patient and Pharmacist screens have independent sample sessions; switching roles clears the previous session. They do not exchange codes or simulate two real accounts. Patient fixtures include a claimed share for identity review; Pharmacist uses `DEMO-CLAIM-132` once per component session. It expires 15 minutes after the dataset is initialized. The preview controls show the other claim outcomes. A generated patient demo code can be cleared and cannot be recovered from the list.

## ML-179 adapter boundary

Replace the component-level `PRESCRIPTION_SHARING` provider with an authenticated implementation of `PrescriptionSharingPort`; remove preview scenarios and synthetic fixtures for production integration. This port is a screen contract, not a backend DTO. Never enable the preview provider as a production fallback.

| Port operation | Reference API |
| --- | --- |
| load shares | GET /api/v1/me/prescription-shares |
| load eligible prescriptions | Existing authorized patient prescription source; only active doctor-issued records |
| load pharmacy memberships | Existing verified-professional/active pharmacy membership source |
| create | POST /api/v1/prescription-shares with prescription_id |
| claim | POST /api/v1/prescription-shares/claim with claim_token and organization_id |
| refresh share | GET /api/v1/prescription-shares/{share_id} |
| confirm | POST /api/v1/prescription-shares/{share_id}/confirm |
| revoke | POST /api/v1/prescription-shares/{share_id}/revoke with reason |

Map camelCase screen fields to authoritative snake_case DTOs, validate responses at runtime, paginate lists, add authenticated share-detail refresh/polling and map expired/conflict errors safely. Derive pharmacy identity only from trusted professional/organization data in ShareDetail and approved sources; never from patient-entered fields. This preview projection includes synthetic pharmacy address/registration for review: verify authoritative ProfessionalIdentity/organization mappings rather than inventing fields or endpoints.

Backend/integration must enforce ownership, active doctor source, verified pharmacist, active pharmacy membership, atomic single claim, original 15-minute claim/confirmation deadline, patient-only explicit confirmation, claimant/pharmacy binding, 24 hours from confirmation, immediate revoke/expiry checks, safe projection and audit events. Client clocks and disabled controls are not server authorization. Minimal medicines may only be fetched through GET /api/v1/prescription-shares/{share_id}/prescription after the server validates a confirmed unexpired share. The ordinary prescription detail endpoint must not substitute for it. Dispensing remains a separate workflow.

## Verification

- Full test suite: 86 test files, **571 tests passed**, including 58 new sharing component, lifecycle and routing cases.
- `npm run lint`: passed (Prettier TypeScript check and app/spec type checking).
- `npm run build`: passed. Existing initial-bundle and unrelated component style budget warnings remain; no budget, dependency or lockfile changes and no new sharing style warning.
- `git diff --check`: passed.
- Installer: fresh baseline, exact payload matching, repeated application, conflict refusal with no partial changes, CRLF baseline handling and patch applicability checked (see bundle verification).
- Runtime: Node 24.22.3, npm 11.19.1; project pins Node 24.16.0 / npm 11.13.0. Re-run with pinned versions in CI/local for exact parity.
- Real-browser QA could not run: Chromium aborts with `socket() failed: Operation not permitted`. No visual, real keyboard Tab traversal or screen-reader QA is claimed. DOM tests verify CDK focus-trap installation, heading focus, Escape, focus return and error focus. Existing unrelated media mock emits `HTMLMediaElement pause not implemented`; suite passes.

## Manual review before approval

1. Sign in normally as Patient; open the sidebar Prescription sharing link and refresh its direct URL. Confirm sample banner, shell alignment with Professional Verification, eligible/disabled prescription options and state filter.
2. Try creating without a selection. Create an active doctor-issued sample code; close or Escape and verify it disappears and focus returns. It must never reappear in the share list.
3. Use the seeded claimed share. Review pharmacist name, registration, pharmacy and address. Try confirming without acknowledgement, cancel, then explicitly confirm. Verify the access deadline is 24 hours from that confirmation, not from code creation.
4. Revoke pending or confirmed sample access. Blank/whitespace reasons must fail; cancel changes nothing. Verify revoked/expired entries have no mutation actions. Wait until a pending code deadline or use lifecycle tests to verify expiry.
5. Sign in as Pharmacist; claim `DEMO-CLAIM-132` with the active sample membership. Try blank/invalid codes, no pharmacy and repeated claim. Verify no medicines or other patient records appear. Preview confirmed, expired and revoked outcomes with the labeled scenario selector.
6. Check 390px and 1440px widths, 200% zoom, keyboard Tab/Shift+Tab, dialogs, Escape, focus return, labels and error announcements with a screen reader. Test loading/empty/error/retry scenarios.
7. Signed-out and wrong-role visitors must not enter either protected route. Switching accounts, roles or leaving the page must clear the prior sample state and raw codes. A complete browser refresh resets fixtures.
