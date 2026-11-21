# ML-117 — Doctor prescription review and issue screens

Base: frontend develop `5678757e4675afd23ac8913b03e13f8fa4fd369d`, verified against GitHub on 2026-11-21.

## Implemented

- Doctor-only route `/workspace/doctor/prescriptions/:id/issue`, protected by the existing workspace authentication and role guards, client-rendered.
- Doctor sidebar entry **Issue prescription (preview)** opens `/workspace/doctor/prescriptions/sample-order/issue`. Existing prescription list/draft routes are retained for ML-113.
- Responsive patient/consultation/order summary, dates, verification/access states, every item (medicine, dose, route, frequency, duration, quantity/unit, PRN and instructions), and all supplied warnings.
- Explicit per-item review checkboxes and overall acknowledgment, followed by a separate issue confirmation. Cancelling never mutates state. Duplicate submissions and dismissal during saving are blocked.
- Only a valid doctor-source owner draft with sample verified doctor, current consultation permission and prescription grant can enter confirmation. Invalid fields, missing items, invalid dates, incomplete review and missing permission block it.
- Sample state changes to active only after the port returns active for the expected order. It is retained in the route-scoped in-memory store on data reload, and is reset by full browser refresh. No clinical persistence is claimed.
- Loading, no-result, validation, load-error/retry, issue-error/retry and active states. Permission loss clears visible data; stale responses after navigation/destruction/role loss are ignored.
- Native labelled controls, CDK dialog focus trap, heading/error focus, Escape dismissal, focus restoration, status/error announcements and narrow-screen card layouts.
- Explicit synthetic QA scenarios exercise load and issue failures without changing application source.

## Scope boundary — ML-162

This is a labelled frontend preview with synthetic data. It does not create real clinical orders, perform clinical allergy/interaction clearance, call an API or change backend code. Sample medication text is not medical advice.

Replace `PRESCRIPTION_ISSUE` in `prescription-issue.routes.ts` with an authenticated adapter implementing `PrescriptionIssuePort`:

- `load(id)`: authorized `GET /api/v1/prescriptions/{prescription_id}`, mapped to a safe screen view plus current consultation/verification/grant context. An unavailable required permission must deny issuance.
- `issue(id)`: explicit `POST /api/v1/prescriptions/{prescription_id}/issue` with **no body**. Do not send UI booleans as authority.
- Backend must recheck authenticated owner doctor, verification, current consultation and category permission, every item's validity, source and persisted lifecycle; enforce atomic/idempotent issue and audit.
- Map DTO snake_case to view camelCase and safely validate all responses/errors. The current preview route is not a production adapter. Synthetic query scenarios must be removed/disabled when integrating real data.
- Persist and re-fetch active state server-side; a reload of real data must show the authoritative persisted state. Handle stale drafts/permissions, concurrent issue and safe authorization failures.

## References

Jira ML-117 description (retrieved 2026-11-21), integration boundary ML-162; scope references ML-051/ML-055. `MediLink_Final_Team_Reference_2026-11-08(1).zip`: API contract issue endpoint, screens/flows, prescription input/read objects and screen fields/validation.

## Verification

- 25 new component/model/store/route tests passed.
- Full suite: 370 tests in 72 files passed.
- `npm run lint`: passed (Prettier and app/spec TypeScript checks).
- `npm run build`: passed. Initial bundle 999.33 kB under the existing 1 MB error budget; existing initial/style budget warnings remain. No budget, dependency or lockfile changes.
- `git diff --check`: passed.
- Runtime used: Node 24.22.3, npm 11.19.1; repository pins Node 24.16.0 / npm 11.13.0 for local/CI parity.
- Chromium could not launch in this environment (`socket() failed: Operation not permitted`). Real-browser 390px/desktop, actual Tab/Shift+Tab trapping and screen-reader announcements remain manual QA; DOM/component tests are not a substitute. No claim of completed visual or screen-reader QA.

## Browser QA

Use a configured local frontend session with the Doctor active role. The sidebar preview opens the sample route. No new credentials or Firebase configuration are included.

1. Open the sample route; inspect all fields for both synthetic items, both warnings and source/date/permission context. No issue occurs merely by loading it.
2. Check only one item and overall acknowledgment: issue must remain disabled. Review both items and acknowledge: confirmation becomes available.
3. Open confirmation, Cancel: still draft, no success. Reopen and press Escape: focus returns to the initiating control.
4. Confirm: active sample status and preview-only success; no second issue action. Reload data via navigation back to the route: store retains active state. Full page refresh resets synthetic state.
5. Add `?preview=unverified`, `?preview=denied`, or `?preview=invalid`: issuance stays blocked. `?preview=empty`, `?preview=loading`, `?preview=error` show page states. Remove the query to restore normal data. Retry in a forced-error URL intentionally remains an error until its query is removed.
6. `?preview=issue-error`: review and confirm; safe error stays in the dialog without an active/success state; Cancel works. This is a controlled failure before store mutation.
7. Unknown prescription ID: empty state. Patient/signed-out visitor: access denied/login via existing guards.
8. Verify at 390px and 1440px, 200% zoom, no clipped content/controls. Verify native checkboxes, Tab/Shift+Tab containment, Escape, focus return, labelled controls and screen-reader status/error announcements.

No PR, push, merge, Jira transition or comments were performed.
