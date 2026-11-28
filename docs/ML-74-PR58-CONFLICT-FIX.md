# ML-74 / PR #58 — Develop conflict resolution

PR: https://github.com/nexora-neural/medilink-frontend/pull/58
PR head: bf84a091d807758fd446879b0b9ee7a634390fa0.
Develop: 1785a858ea61b97e8a36abd8dc7c427834bef0d5.

The merge conflicts in the shared clinical records HTML and TypeScript. ML-74 implements real patient/doctor history reads and consultation-authorized appends; later develop implements the doctor queue's direct read-only patient route. Choosing a whole side would discard one workflow. The automatic route merge also leaves a reference to a removed eager ClinicalRecords import.

Resolution:

- Keep ML-74's API-backed clinical history, attributed/source/status display, complete allergy state, pagination, patient appends and consultation/grant checks for doctor writes.
- Keep develop's direct `/workspace/doctor/patients/:id` route and its role guard, title and livePatientRecords data. Load the shared component lazily, consistently with the other clinical-record routes; do not reintroduce an eager import.
- Delegate that route's read-only view to DoctorPatientRecords, using the same clinical-record API adapter and canonical DTO projection. It never loads write eligibility or consultation state, presents no append controls and has no write method. Backend access is checked on each read.
- Resolve the template conflict by dispatching only the direct queue route to the read-only view; the normal patient history/doctor record template remains the existing ML-74 implementation.
- Bind direct-view results to account, patient id, page and refresh request. Clear stale content immediately when any identity changes, ignore old/destroyed requests, distinguish denied/expired/service failures, and keep patient pagination read-only. Allergy status is read through the existing complete allergy query rather than inferred from a partial history page.
- Preserve the three incoming read-only regression scenarios in a focused suite: authorized read without writes, empty/denied states, patient switching and delayed responses. Add account-loss, session expiry, retry, destruction, pagination and shared-route delegation checks. Existing ML-74 component/service tests remain in place.

No backend, API contract, package, lockfile or budget change is introduced by the conflict-resolution payload. Other develop changes are retained by the ordinary Git merge. Production build/lint/test logs and exact counts are in the bundle verification report.

Validation is automated Angular DOM/service testing. This conflict fix does not claim a new live Firebase, real-browser visual or real-backend smoke test. The original PR's validation limitations still apply. Two existing external-workflow tests are skipped by their existing configuration.

The prepared Windows launcher uses a separate checkout, fetches the pinned branch/develop, resolves only the known merge, verifies locally, stages the resolution and creates one local merge commit. It never pushes, opens a PR, posts comments, resolves remote reviews or updates Jira. It stops on a newer upstream SHA, unknown changes or additional conflicts rather than force-resetting work.
