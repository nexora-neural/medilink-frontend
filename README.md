# MediLink Frontend

Responsive healthcare web application frontend built with Angular 21 and SCSS. Patient registration, sign-in, and profile account details connect to the configured Firebase and local backend. Other workspace features may still use preview data.

## Requirements

- Node.js 24.16.0
- npm 11.13.0

Use the versions above for a consistent team setup.

## Get started

```bash
npm ci
npm start
```

Open `http://localhost:4200/`. The development server reloads when source files change.

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Quality checks

After installing dependencies with npm ci, run these checks from the frontend repository root:

    npm run lint
    npm test -- --watch=false
    npm run build

The lint command checks TypeScript formatting and type-checks application and test code. The unit tests use the configured Vitest runner and do not require a live backend.

The workspace role selector lists roles returned by the authenticated
`GET /api/v1/me` response. Route guards check that the selected role
belongs to the account and is allowed for the route. Connected APIs
authenticate requests using Firebase ID tokens and enforce permissions
on the server. Other preview screens are not completed API integrations.

## Project structure

- `src/app/core/` — app-wide authentication, guards, interceptors, and services.
- `src/app/shared/` — reusable components, directives, and pipes.
- `src/app/layout/` — shared responsive shell and navigation.
- `src/app/features/` — feature areas such as patients, doctors, appointments, prescriptions, medical records, and measurements.
- `src/assets/` — images and custom SVG icons.
- `src/environments/` — public, non-secret environment configuration.
- `src/styles/` — shared SCSS tokens and typography. Keep component-specific styles beside their components.

The empty feature folders are planned placeholders, not implemented clinical features. Add feature-specific pages, components, services, and models inside the relevant feature when that work begins. The current workspace routes use a shared preview page until each feature is implemented.

## Shared libraries and conventions

- Angular Material and CDK are the shared UI foundation.
- Use locally bundled Material Symbols Outlined for standard icons. Use custom SVGs only for product-specific icons that are not covered. Icon-only controls need an accessible label.
- Chart.js is available for measurement and trend charts. Keep chart setup within the relevant feature until a shared use case appears.
- Use Angular Router, Reactive Forms, HttpClient, and RxJS for navigation, forms, and API/data flows.
- English is the current UI language; no translation library is configured.
- Agree on new dependencies as a team and check compatibility with Angular 21. Commit `package.json` and `package-lock.json`; do not commit `node_modules/`.
- Never place credentials or private API keys in frontend source or environment files.

## Team workflow

Create a feature branch for each piece of work and merge through a reviewed pull request. Avoid committing generated output, local environment files, or patient data.

## Account support and Admin accounts ML-38

These screens use fictional, in-memory accounts. Changes reset when
the page reloads. Real API integration is tracked separately in ML-42.

### Preview steps

1. Configure and start the frontend and backend.
2. Sign in with a development account assigned the required backend roles.
3. Open `/workspace`.
4. With Admin or Super Admin selected, use Account support to preview
   searching accounts and suspend/reactivate actions.
5. With Super Admin selected, open Organizations, then use Admin accounts
   to preview granting and removing delegated Admin access.

Only roles assigned to the authenticated account appear in the selector.
Selecting a role does not grant additional permissions. After a full
reload, roles are loaded again and the initial role is selected from
the account's assigned roles.

### Access rules

- Admin and Super Admin can open Account support.
- Only Super Admin can open Admin accounts and change Admin access.
- Delegated Admin access does not grant clinical access.
- Workspace navigation uses roles returned by the backend.
  Account support and Admin account changes still use fictional,
  in-memory data; their API integration requires server-side authorization.

### Validation

- Production build passed with an initial bundle-size warning.
- Formatting and TypeScript checks passed.
- All 70 automated tests passed.
- Account Support was visually checked at a 375px viewport width.
- Keyboard focus was manually verified on Account Support and Admin Accounts.

### Keyboard accessibility

- Confirmation panels move focus to Cancel when opened.
- Tab and Shift+Tab keep focus within the confirmation panel.
- Escape closes the confirmation panel.
- Cancel and Confirm return focus to the original action button.


## Onboarding and patient profile integration ML-33

### Local setup

1. Install dependencies using `npm ci`.
2. Copy `public/medilink-config.example.js` to
   `public/medilink-config.js`.
3. Configure the Firebase web app settings and backend API base URL
   in the local config file.
4. Configure and start the backend using its setup instructions.
   Apply the required migrations and configure the required roles.
5. Run `npm start`.

The frontend and backend must use the same Firebase project.
Keep local configuration files, backend credentials, and service-account
JSON files out of Git. Never put service-account credentials in frontend
code or public assets.

For local production-server testing at http://localhost:4000,
include that origin in the backend's local CORS_ORIGINS configuration.
Start the backend with its required Firebase Admin credentials configured.
Keep credentials and local configuration files out of Git.

### Connected behavior

- Patient registration submits onboarding data to `/api/v1/me/onboard`.
- If Firebase account creation succeeds but backend onboarding fails,
  registration can be retried using the same email and correct password.
- Existing Firebase accounts require successful password authentication
  before an onboarding retry.
- Backend onboarding reconciles accounts by verified Firebase UID,
  rather than merging accounts by email.
- The Patient sidebar includes My profile at
  `/workspace/patient/profile`.
- Profile account details load through `GET /api/v1/me`.
- Name and mobile number updates use `PATCH /api/v1/me`.
- Email is read-only in the profile form.
- Failed saves retain the edit form and draft for retry.
- Save and Cancel are disabled while saving.
- Emergency contacts load from the patient profile and save through
    `PATCH /api/v1/me/patient-profile`.
- Emergency contacts can be cleared by saving both fields empty.
- Medication and vaccination in-app notification preferences can be
  saved, including setting both to false.
- Failed contact and preference saves retain drafts for retry.
- Session restoration loads the account's assigned roles from `GET /api/v1/me`.
- The role selector cannot select roles absent from that account.
- Missing sessions and failed session checks clear the role context.
- Protected role routes redirect unauthorized role selections to `/access-denied`.
- Organization options load from memberships returned by `GET /api/v1/me`.
- Options include only the account's approved memberships matching the selected role.
- The selector displays organization IDs and is hidden when no matching memberships exist.
- Organization selection is held in memory and resets after a full refresh.
- Selecting an organization does not grant backend permissions.


### Verification

- 132 automated tests passed across 49 test files.
- Formatting and TypeScript checks passed.
- Production build passed with exit code 0 using Node.js 24.16.0
  and npm 11.13.0, with bundle and component-style budget warnings.
- Manually checked profile updates after refresh and cancellation.
- Manually checked failed saves and successful retries.
- Manually checked registration recovery after backend unavailability.
- Database checks found no duplicate Firebase UIDs, patient profiles,
  or user-role assignments.
- An unauthenticated `GET /api/v1/me` returned
  `401 AUTHENTICATION_REQUIRED`.
- Two separate patient sessions displayed their respective account
  details; updating one did not change the other.
- Manually verified emergency contact saving, clearing, refresh
    persistence, and failure/retry.
- Manually verified notification preference persistence, both settings
  disabled, and failure/retry.
- Manually checked the profile page at 375px width and keyboard
  navigation through its fields and buttons.
- Eight backend profile validation and authorization tests passed;
  authenticated denied-access tests use mocked identities and sessions.
- A signed-in Doctor account without the Patient role received
  `403 Forbidden` when calling `PATCH /api/v1/me/patient-profile`.
- Verified organization selection against the local backend using a
  Doctor test account with an approved membership.
- Automated tests exclude pending, rejected, and suspended memberships.
- Initial bundle size: 813.50 kB against a 500 kB warning budget.
- Verified direct patient-profile navigation, repeated refresh,
    and opening the route in a new tab on the production server.

### Verification limits

These checks cover the documented local scenarios, not the complete
authorization matrix.



## Admin dashboard ML-238

### Scope

- Admin dashboard is available at `/workspace/admin/dashboard`.
- The Admin sidebar includes an Overview link.
- Pending professional application counts use fictional sample data.
- Loading, empty, error, and retry states can be previewed.
- Account support links to the delegated support workspace.
- Operational status is labelled Not connected.
- No clinical records or Super Admin review actions are exposed.
- API integration is tracked separately in ML-244.

### Verification

- Lint and TypeScript checks passed.
- All 144 tests passed across 50 test files.
- Production build passed with bundle and component-style budget warnings.
- Initial bundle size was 823.01 kB against a 500 kB warning budget.
- Manually checked direct dashboard navigation and repeated refresh.
- Manually checked preview states, retry, and account support navigation.
- Checked the mobile layout at 375px width.
- Automated routing tests cover Admin session restoration,
  signed-out access, and denial for other roles.

## Account support integration (ML-42)

Account support and Admin role management use the authenticated backend API.

- Account support: `/workspace/admin/account-support`
- Admin role management: `/super-admin/admin-accounts`
- Search supports server pagination.
- Status changes require a reason and explicit confirmation.
- Only Super Admin can appoint or revoke Admin access.
- Backend permission and MFA requirements remain enforced.
- Admin access does not grant clinical access.
- Search results include the current Admin assignment through the backend `is_admin` field.
- Admin actions follow the assignment state; only active non-Admin accounts can be appointed.
- Successful Admin changes reload the assignment state from the backend.
- Account support offers suspension for active accounts and reactivation for suspended accounts.
- Pending and disabled accounts have no suspend/reactivate action in this UI.

### Verification

Manually checked account search, status changes, status persistence after
refresh, permission-denied responses, keyboard navigation, and mobile layouts.

Component and service tests cover mocked success and failure responses.

Live Admin appointment/revocation success testing remains pending because
an MFA-authenticated Super Admin test session is unavailable.
MFA enrollment and login implementation are outside this change.

## Doctor access grants preview — ML-49

- Added record-category selection using the five existing consent categories.
- Added duration choices: 24 hours by default, 7 days and 30 days.
- Kept consultation permission separate and off by default.
- Required a reviewed reference, selected categories and explicit confirmation
  before displaying the sample access summary.
- Reset the summary and confirmation when choices or the reference change,
  while preserving selected categories.
- Added fictional active, expired and revoked grant records with example expiry dates.
- Added sample loading, empty, error and retry states.
- Added local revoke confirmation and cancellation.
- Kept grant history distinct from record-access activity.
- Used client rendering for the patient access route to fix refresh redirects.

### Integration boundary

This is a frontend preview. Doctor references remain unverified, and no real
grants are created or revoked. Sample records use fixed example dates and statuses.
ML-65 connects the workflow to the real API and verifies authorization, expiry,
revocation and grant-list contract behavior.

### Verification

- TypeScript checks passed.
- All 163 tests passed across 53 test files.
- The doctor access component has 16 passing tests.
- Checked the layout at 375px width.
- Manually checked reference editing, sample summary and revoke behavior.
- Production build passed with size warnings:
  initial bundle 859.04 kB and doctor access styles 7.93 kB.
- Git whitespace checks passed.


## Private document controls ML-24

### Scope

- Added reusable document upload and download UI controls.
- Professional verification uses the shared upload control.
- File selection checks extensions, browser-reported MIME types,
  empty files, and the 10 MiB (10,485,760 bytes) per-file limit.
- Invalid replacements preserve the previous valid selection.
- Selected files can be removed and selected again.
- Download controls support empty, loading, disabled, error,
  retry, and status-message states.
- Download requests emit a document record ID.
- The Documents tab includes a clearly labelled fictional download preview.
- No files are uploaded to or downloaded from the server by these controls.

### Integration boundary

ML-43 connects the controls to the real API. Detected content-type
validation, readability checks, private storage, and authorization
on every retrieval remain backend/integration responsibilities.
Browser checks do not establish file safety or access permission.

### Verification

- Lint and TypeScript checks passed.
- All 175 tests passed across 55 test files.
- Upload tests cover the exact 10 MiB boundary, oversized and empty
  files, unsupported extensions, MIME mismatch, selection preservation,
  removal, and disabled controls.
- Download tests cover request events, empty/loading/disabled states,
  errors, retry, and status messages.
- Manually checked selection/removal and download preview states.
- Checked the layout at 375px width.
- Production build passed with bundle and component-style warnings.
- Initial bundle size: 848.90 kB against a 500 kB warning budget.
- Professional verification styles: 7.71 kB against a 4 kB warning budget.
