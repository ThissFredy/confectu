# Confectu

Mobile-first invoicing system for tailoring workshops.

Confectu aims to replace the manual creation of invoices in Word documents with
a web application for managing customers, services, and invoices from a phone
or computer.

The project is currently under development.

## Goal

The application will allow each clothing factory to:

- Sign in with Google.
- Manage its customer catalog.
- Manage tailoring services or garments.
- Create invoices with multiple lines, quantities, and prices.
- View invoice history.
- View and download invoices.

Confectu uses a multi-tenant model: each account represents a factory, and its
data is isolated from every other user's data.

## Technology Stack

- [Next.js](https://nextjs.org/) with App Router.
- [React](https://react.dev/).
- [TypeScript](https://www.typescriptlang.org/).
- [Supabase](https://supabase.com/) for PostgreSQL and authentication.
- Tailwind CSS or CSS Modules.
- [pnpm](https://pnpm.io/) as the package manager.

The project follows a minimal dependency policy. Native browser APIs, Next.js,
and React are preferred before adding external dependencies.

## Security

- Authentication is handled exclusively through Google OAuth with Supabase Auth.
- Private routes require an active session.
- Supabase tables must use Row Level Security (RLS).
- Each factory can only read and modify its own data.
- Permissions are validated on the server and not only in the interface.

## Architecture

Confectu uses a modular monolith organized by business functionality. Each
module keeps its components, Server Actions, queries, types, validations, and
specific logic together.

The main modules are:

- `modules/auth/`: authentication.
- `modules/clients/`: customers.
- `modules/services/`: services or garments.
- `modules/invoices/`: invoices and invoice lines.

Next.js routes remain in `app/` and act as entry points for screens. Shared and
genuinely reusable code is placed in `components/` or `lib/`.

## Structure

```text
app/                         # Next.js routes, layouts, and pages
components/                  # Shared UI components
lib/                         # Shared infrastructure and utilities
lib/supabase/                # Supabase clients
modules/auth/                # Authentication module
modules/clients/             # Customer module
modules/services/            # Services or garments module
modules/invoices/            # Invoices module
public/                      # Static assets
```

Specific Server Actions must live inside their module. Modules communicate
through public functions and do not directly access the internal files of other
modules.

## Local Development

### Requirements

- Node.js.
- pnpm.
- A Supabase project for database and authentication services.

### Installation

```bash
pnpm install
```

Configure the required Supabase environment variables in a `.env.local` file
before starting the application.

### Commands

```bash
# Start the development server
pnpm dev

# Run the linter
pnpm lint

# Create a production build
pnpm build

# Start the built application
pnpm start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Status

The initial project foundation has been created and the business architecture is
defined. Authentication, customer, service, and invoicing features will be
implemented progressively.

## License

This project is licensed under the GNU Affero General Public License,
version 3, or (at your option) any later version. See [LICENSE](LICENSE) for
the license notice and the official license terms.
