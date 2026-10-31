# MediLink Frontend

Responsive healthcare web application frontend built with Angular 21 and SCSS. The current screen is a starter welcome page; feature screens and backend integration are not implemented yet.

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

The lint command checks TypeScript formatting with Prettier. The unit tests use the app's configured Vitest runner and do not require a live backend.

## Project structure

- `src/app/core/` — app-wide authentication, guards, interceptors, and services.
- `src/app/shared/` — reusable components, directives, and pipes.
- `src/app/layout/` — shared responsive shell and navigation.
- `src/app/features/` — feature areas such as patients, doctors, appointments, prescriptions, medical records, and measurements.
- `src/assets/` — images and custom SVG icons.
- `src/environments/` — public, non-secret environment configuration.
- `src/styles/` — shared SCSS tokens and typography. Keep component-specific styles beside their components.

Add feature-specific pages, components, services, and models inside the relevant feature when that work begins.

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
