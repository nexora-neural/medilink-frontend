# MediLink Frontend

Responsive healthcare web application frontend built with Angular 21 and SCSS. Public pages and a workspace preview are available; clinical features and backend integration are not implemented yet.

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

The workspace role selector and route guard are for frontend navigation only. The current backend is a development scaffold and does not yet implement authentication or authorization for clinical data. Enforce identity, role, and patient-consent permissions on the server before connecting real data. Registration, sign-in, and verification remain demonstration flows; `/verification-documents` is not currently configured as a route.

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

## Account support and Admin accounts — ML-38

These screens use fictional, in-memory accounts. Changes reset when
the page reloads. Real API integration is tracked separately in ML-42.

### Preview steps

1. Start the application with `npm start`.
2. Open `/workspace`.
3. Select Admin and use the Account support sidebar link.
4. Search accounts and preview suspend/reactivate actions.
5. Select Super Admin, open Organizations, then use the Admin accounts
   sidebar link to preview granting and removing delegated Admin access.

Use sidebar links during preview. A full page reload resets the
selected preview role to Patient.

### Access rules

- Admin can open Account support.
- Only Super Admin can open Admin accounts and change Admin access.
- Delegated Admin access does not grant clinical access.
- The role selector and route guards are frontend preview controls.
  Server-side authorization must be enforced during API integration.

### Validation

- Production build passed with an initial bundle-size warning.
- Formatting and TypeScript checks passed.
- All 68 automated tests passed.
- Account Support was visually checked at a 375px viewport width.

### Known issue

Keyboard focus can leave the page when opening the account-status
confirmation. Focus handling remains unresolved and requires review.
Keyboard accessibility is not yet fully verified.
