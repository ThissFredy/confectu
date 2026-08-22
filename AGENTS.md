# Confectu

## Context

Confectu is a mobile-first web application for tailoring workshops.
It allows each user to manage their customers, services, and invoices in
isolation and view and download their invoices.

The application is multi-tenant: each account represents a workshop and must
never have access to another user's data.

## Stack

- Next.js with App Router.
- React and TypeScript.
- Supabase for PostgreSQL and authentication.
- Tailwind CSS or CSS Modules.
- pnpm as the package manager.

## Dependencies

Keep the project strictly minimal.

Do not add form, validation, or heavy UI component libraries.
Use native forms, HTML5 validation, and manual validation with
TypeScript/JavaScript.

Before adding a dependency, check whether the functionality can be implemented
with native browser APIs, Next.js, or React.

## Authentication and Security

- Use only Supabase Auth with Google OAuth.
- Do not implement passwords or manual registration.
- Protect private routes with an active session.
- Enable RLS on all Supabase tables.
- Enforce per-user isolation: a workshop must not read or modify another
  workshop's data.
- Do not expose private credentials or server keys in client components.
- Validate permissions and data ownership on the server as well; do not rely
  solely on the interface.

## Data and Mutations

- Every entity belonging to a workshop must be associated with its user.
- Mutations must be implemented exclusively with Server Actions.
- Server Actions must receive and process native `FormData`.
- Calculations shown on the client must be revalidated on the server before
  saving an invoice.
- Maintain consistency across customers, services, invoices, and invoice lines.

## Interface and User Experience

- Always design mobile-first.
- Keep touch controls at least 44x44 px.
- Use semantic HTML and accessible controls.
- The sign-in page must provide a clear action to continue with Google.
- The invoice flow must allow users to quickly select or create a customer, add
  services or garments, enter quantities and prices, and review the total.
- The interface must account for loading, empty, success, and error states.
- Use `nextjs-toast-notify` for all toast notifications across the
  application. Notifications must always appear in the top-right position
  (`position: "top-right"`). Import `showToast` from `nextjs-toast-notify` in
  client components and call `showToast.success`, `showToast.error`,
  `showToast.warning`, or `showToast.info` as needed.

## Architecture

Use a modular monolith organized by business functionality.

Each module must keep its components, Server Actions, queries, types,
validations, and specific logic together.

The main modules are:

- `modules/auth/`: authentication.
- `modules/clients/`: customers.
- `modules/services/`: services or garments.
- `modules/invoices/`: invoices and invoice lines.

Next.js routes must remain in `app/` and act as entry points for screens.

Modules must communicate through public functions and must not directly depend
on the internal files of other modules.

Shared and genuinely reusable code must be placed in `components/` or `lib/`;
avoid creating unnecessary generic abstractions.

## Structure

- `app/`: Next.js routes, layouts, pages, and endpoints.
- `modules/`: independent business modules.
- `components/`: UI components shared across modules.
- `lib/`: shared infrastructure and utilities.
- `lib/supabase/`: Supabase clients for the server and browser.
- `public/`: static assets.

Follow the existing structure in `app/` and do not create an alternative
structure with `src/` without an explicit project decision.

The expected structure within a module is:

```text
modules/<module>/
├── components/
├── actions.ts
├── queries.ts
├── types.ts
├── validations.ts
└── module-specific logic
```

Specific Server Actions must live inside their module. Do not create a global
`actions/` directory unless there is a clear cross-cutting need.

## Verification

- Use `pnpm dev` for development.
- Run `pnpm lint` after code changes.
- Run `pnpm build` when changes affect routes, authentication, Server Actions,
  configuration, or types.
- Do not modify generated files inside `.next/`.

## Workflow

- Inspect the existing code before creating files or dependencies.
- Prefer the smallest necessary change.
- Follow the patterns already established in the project.
- Consult the local Next.js documentation when an API or convention is unclear.
- Explain what changed and which checks were run at the end.
