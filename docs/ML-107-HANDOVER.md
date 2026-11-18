# ML-107 — Super Admin integration-client screens

Implemented against `develop` commit `7bcbd310b1efc7674c6a3b0fc07cc09c40380754`.

## Scope and review

- `/super-admin/integrations`: searchable, status-filtered client list; organization, name, reports:write, expiry and lifecycle status.
- Approve a laboratory client with an approved-organization selector, trimmed name (1–200 characters), fixed reports:write scope and future expiry.
- Separate suspend/revoke/rotate confirmation dialogs. Reason required (1–1,000 characters). Rotation requires a future expiry. Revoked clients cannot be changed; only active, unexpired clients can rotate or suspend.
- Credential shown in a single transient dialog after approval/rotation. Clearing, Escape, component destruction and loss of Super Admin role clear it. No credential/hash in list models, browser storage, logs or URLs.
- `/super-admin/integrations/submissions`: operational metadata only (submission ID, client ID, status, received time, allowlisted outcome explanation). No patient/report content, request tokens, idempotency keys, raw exception text or credentials displayed.
- Both routes reuse the authenticated Super Admin shell/guards. Sidebar link and header titles updated. Both are client-rendered (not prerendered).
- Loading, empty, validation, failure/retry and preview-success states. Mobile card layouts, keyboard-operable native controls, CDK focus trap, focus return, error focus and Escape dismissal.

**This is the ML-107 screen task. All data and mutations are an explicitly labelled in-memory preview. No HTTP calls, backend changes, real key generation, authorization enforcement or credential hashing have been added. Demo credentials cannot authenticate.** Approval creates a new client; no unapproved pending-client transition endpoint is invented. Pending clients can be displayed and revoked; how an existing pending request is approved must be reconciled with the real API during ML-114.

## ML-114 integration boundary

Replace the `INTEGRATION_CLIENTS` provider with an authenticated adapter implementing `IntegrationClientsPort`. The existing preview provider is scoped to the Super Admin route. Do not enable the preview provider in the eventual production integration.

| Port method | Reference API |
| --- | --- |
| listClients | GET /api/v1/admin/integration-clients |
| listSubmissions | GET /api/v1/admin/integration-submissions |
| approve | POST /api/v1/admin/integration-clients |
| change: rotate | POST /api/v1/admin/integration-clients/{client_id}/rotate |
| change: suspend | POST /api/v1/admin/integration-clients/{client_id}/suspend |
| change: revoke | POST /api/v1/admin/integration-clients/{client_id}/revoke |
| listApprovedLabs | Reuse the approved laboratory organization source; validate eligibility on the server. |

Use the authoritative backend contract to map camelCase screen fields to snake_case DTOs, validate runtime responses and map errors safely. Add authenticated pagination/filtering to the adapter/screens when integrating server pages; current search/filter works over the complete sample list. `SubmissionOutcome` deliberately projects only a subset of the reference read DTO.

ML-114/backend must verify reports:write-only scope, approved lab and patient/request binding, expiry, hash-only storage, one-time issuance, immediate old-key invalidation, suspended/revoked access denial, duplicate prevention and audit events. UI controls and sample lifecycle checks are not server security controls. Keep real credentials out of logs and never add a recover/reveal endpoint. Suspended clients have no resume action because none is specified in this reference contract.

## Sources

- Jira ML-107 description retrieved 2026-11-18; explicit ML-114 integration boundary.
- `MediLink_Final_Team_Reference_2026-11-08(1).zip`: API contract, screens/flows, validation and API object catalogue.
- Current frontend develop source and existing Angular/CDK patterns.

## Verification

- Full test suite: 66 test files, **305 tests passed** (includes 30 added component/store/route cases).
- `npm run lint`: passed (Prettier + app/spec TypeScript checking).
- `npm run build`: passed. Angular emitted initial-bundle and other existing component style warning budgets; no new integration-component style warning, and no budget changes.
- `git diff --check`: passed.
- Tested with Node 24.22.3, npm 11.9.0. Repository pins Node 24.16.0 / npm 11.13.0; use those for local/CI parity. Dependencies and lockfile unchanged.
- Real-browser visual QA could not run: Chromium launch failed with `socket() failed: Operation not permitted`. No claim of visual or screen-reader testing. Dialog keyboard/focus behavior was verified in DOM component tests. Test 390px and desktop layouts manually before approving the PR.

## Manual review

1. Authenticate with a Super Admin account and open `/super-admin/integrations`.
2. Confirm the sample banner, list, search, filters and narrow scope.
3. Approve a sample client; check missing/blank/overlong name, unavailable lab and invalid/past expiry. A valid approval shows a demo credential once.
4. Close or press Escape; ensure the credential is gone and focus returns to the initiating control. Reopening a dialog must not recover an old credential.
5. Rotate an active client with a reason and future expiry. Suspend/revoke only after explicit confirmation. Cancelling has no effect. No rotate/suspend for suspended, revoked or expired clients.
6. Open submission outcomes via the tab; filter/search and inspect only safe metadata.
7. Check 390px and 1440px widths, 200% zoom, Tab/Shift+Tab containment in dialogs and Escape. Check labels/error announcements using a screen reader.
8. A delegated Admin and a signed-out visitor must not enter either route.
9. Reset sample state by a full page refresh. A list reload preserves sample mutations within the active preview store.
