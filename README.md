# Sales Manager

Sales Manager is a responsive, multi-tenant sales and inventory application for small businesses. It gives owners and staff one place to record transactions, monitor stock, manage customer credit, and understand business performance.

## What the application does

- **Authentication:** Sign up and log in with email/password or Google OAuth through Supabase Auth.
- **Business onboarding:** Create a business, choose a category, add starter products, configure branding, and invite staff. Existing businesses can be joined with an invite code.
- **Sales recording:** Record products, quantities, prices, dates, customers, notes, and payment methods (cash, transfer, POS, or credit).
- **Sales history:** Search and filter transactions, review grouped sales history, delete sales where permitted, and track credit payment status.
- **Stock management:** Add and review stock purchases with quantities, unit costs, dates, units, and notes. Authorized users can remove stock records.
- **Inventory overview:** See product-level stock summaries, low-stock information, sales activity, and estimated inventory value.
- **Credit management:** View outstanding credit sales, record repayments, and track how credit was paid.
- **Analytics:** Review revenue, profit estimates, stock costs, payment-method breakdowns, sales trends, and period comparisons.
- **Reports:** Export sales and stock data to Excel or generate a PDF sales report for a selected period or the full history.
- **Team and branding controls:** Admins can update the company name, app name, logo, brand color, product catalog, staff access, and invite code.
- **Permissions:** Staff access is controlled by permissions for recording sales, viewing history or stock, adding stock, viewing analytics, and managing credit.
- **Offline support:** Sales recorded while offline are queued locally and synchronized automatically when the connection returns.
- **Responsive experience:** Works in modern browsers and is configured for Capacitor Android builds. Light/dark themes, keyboard shortcuts, and persisted query data are included.

## Technology

- React 18, TypeScript, and Vite
- React Router, TanStack React Query, and persisted local query caching
- Tailwind CSS, shadcn/ui, Radix UI, and Lucide icons
- Supabase Auth, PostgreSQL, Row Level Security, and RPC functions
- Recharts for analytics
- SheetJS (`xlsx`) for Excel exports and jsPDF for PDF reports
- Capacitor for Android packaging

## Requirements

- Node.js 18+
- A Supabase project with the migrations in `supabase/migrations` applied
- Supabase URL and publishable/anon key in a local environment file

## Local development

```bash
npm install
cp .env.example .env
# Set the Supabase values in .env (or .env.local)
npm run dev
```

The Vite development server runs at `http://localhost:8080`.

## Useful commands

```bash
npm run dev          # Start the development server
npm run build        # Create a production web build
npm run preview      # Preview the production build
npm run lint         # Run ESLint
npm test             # Run the Vitest test suite
npm run static-build # Build the web app and copy it into Capacitor
npm run android-open # Open the Android project in Android Studio
```

## Supabase configuration

Apply the SQL migrations in `supabase/migrations` to create the tenant, profile, product, sales, stock, credit, and company-settings data model and supporting RPC functions. Enable Google in **Supabase → Authentication → Providers** if Google sign-in is required. For a deployed web app, add its origin to the Supabase authentication URL and redirect URL configuration.

The optional `delete-user` Edge Function supports admin-only account deletion and must be deployed separately in Supabase when that workflow is enabled.

## Project structure

```text
src/components/       Shared UI, forms, dashboard widgets, and dialogs
src/features/         Tenant and analytics feature components
src/pages/             Application entry and dashboard pages
src/services/          Sales, stock, and tenant data services
src/lib/               Types, Supabase helpers, offline queue, and exports
supabase/migrations/   Database schema and RPC migrations
public/                PWA manifest and app icons
```
