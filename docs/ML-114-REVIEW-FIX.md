# ML-114 review fix

Frontend PR: https://github.com/nexora-neural/medilink-frontend/pull/42

The lab selector now requests all pages from
`GET /api/v1/admin/integration-clients/eligible-laboratories` instead of treating every
public active laboratory as eligible. The companion backend change shares the predicate
with client creation: an active laboratory and the same active user's approved Lab Staff
membership, approved professional profile and approved application for that laboratory.
Only laboratory ID/name reach the selector. API failure does not fall back to an
unverified public list. The creation endpoint still rechecks eligibility.

## Integration requirement

The companion backend endpoint must be available before this frontend fix is deployed.
Create its separate backend PR and link it from frontend PR #42. No database migration
is added. Keep the existing backend authentication, authorization and create-time checks.

## Verification

The new adapter regressions cover paginated eligible options, minimal field mapping,
no eligible labs, access/service errors without fallback, and invalid pagination.
Existing component regressions cover lifecycle actions, credential clearing, role loss,
validation, cancel/Escape and focus restoration. These DOM/API tests do not establish
real-browser accessibility or live Firebase session behavior.

Run `npm ci`, `npm run lint`, `npm test -- --watch=false`, and `npm run build`.
Then sign in to the local application with your authorized Super Admin account and
perform the live checks below. Use synthetic lab/client data; do not capture credentials
in screenshots, issue comments or logs.

- Compare eligible/noneligible labs, including no approved staff and suspended staff.
- Approve, close the one-time credential dialog, and refresh. The client persists and
  the credential cannot be recovered from the list or browser storage.
- Rotate with a reason/future expiry; old credential denied, replacement accepted.
- Suspend/revoke and verify the API denies credentials, including after refresh.
- Check submissions, error/retry, expired session and delegated Admin denial.
- At 390px and desktop widths check layout, labels, Tab/Shift+Tab containment,
  focus return, Escape, validation announcements and keyboard-only operation.

The delivery bundle records actual validation results and a live-check worksheet.
Record each live outcome before describing the review as fully verified.
