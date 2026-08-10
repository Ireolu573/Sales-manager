# Sales Manager — Enterprise Multi-Tenant Point of Sale & Inventory Platform

> **Academic Final-Year Computer Science Capstone Project**  
> *Live Production URL:* [sales-manager-rust.vercel.app](https://sales-manager-rust.vercel.app)  
> *GitHub Repository:* [github.com/Ireolu573/Sales-manager](https://github.com/Ireolu573/Sales-manager.git)

---

## 1. Executive Project Overview

Sales Manager is a full-stack, multi-tenant enterprise point-of-sale (POS) and business management platform designed to streamline sales recording, inventory tracking, customer credit management, role-based staff permissions, and real-time sales analytics.

The application is architected for both cloud deployment (Vercel + Supabase Cloud) and containerized local development via Docker and Supabase Local Stack.

---

## 2. System Architecture & Layered Design Pattern

The application strictly follows a **Layered, Feature-Based Modular Architecture**:

```
 ┌─────────────────────────────────────────────────────────┐
 │                   React 18 Frontend                     │
 │      (Vite + TypeScript + Tailwind CSS + Shadcn UI)     │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │                    Feature Components                   │
 │ (src/features/{auth, sales, stock, analytics, tenant})  │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │               State & Data Fetching Hooks               │
 │    (src/hooks/useSales, useStock, useTenant, etc.)      │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │               Services & Repository Layer               │
 │     (src/services/{sales, stock, tenant, analytics})    │
 └────────────────────────────┬────────────────────────────┘
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │               Local Docker / Cloud Database             │
 │         PostgreSQL + GoTrue Auth + PostgREST API        │
 └─────────────────────────────────────────────────────────┘
```

---

## 3. Entity-Relationship Diagram (ERD) & Database Schema

The database model is multi-tenant and enforces **Row Level Security (RLS)** at the PostgreSQL engine level.

```
+------------------+         +--------------------+         +-----------------------+
|     profiles     |         |      tenants       |         |   company_settings    |
+------------------+         +--------------------+         +-----------------------+
| id (PK, FK auth) |<------->| id (PK)            |<------->| id (PK)               |
| email            |         | name               |         | company_name          |
| is_admin         |         | plan               |         | brand_color           |
| permissions      |         | invite_code        |         | logo_emoji            |
| tenant_id (FK)   |         | created_by (FK)    |         | tenant_id (FK)        |
+------------------+         +--------------------+         +-----------------------+
                                       ^
                                       |
                   +-------------------+-------------------+
                   |                                       |
         +---------+----------+                  +---------+----------+
         |      products      |                  |        sales       |
         +--------------------+                  +--------------------+
         | id (PK)            |                  | id (PK)            |
         | name               |                  | user_id (FK)       |
         | tenant_id (FK)     |                  | item_name          |
         +---------+----------+                  | quantity           |
                   |                             | unit_price         |
         +---------+----------+                  | total_amount (GEN) |
         |   product_units    |                  | payment_method     |
         +--------------------+                  | tenant_id (FK)     |
         | id (PK)            |                  +--------------------+
         | product_id (FK)    |
         | unit_label         |
         | unit_price         |
         +--------------------+
```

---

## 4. Local Development & Docker Database Setup

You can run the entire database environment locally on your PC using Docker and the Supabase CLI.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Daemon installed & running.
- [Node.js](https://nodejs.org/) (v18+)

### Step-by-Step Local Setup

1. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/Ireolu573/Sales-manager.git
   cd Sales-manager
   npm install
   ```

2. **Configure Local Environment:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. **Start Local Database Stack (Docker):**
   ```bash
   npm run db:start
   ```
   This will spin up containerized PostgreSQL, GoTrue Auth, PostgREST, and Supabase Studio on local ports:
   - **API / Auth URL:** `http://127.0.0.1:55321`
   - **Supabase Studio (GUI):** `http://127.0.0.1:55323`

4. **Start the Frontend Application:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Run Everything Containerized in Docker (Optional):**
   ```bash
   npm run docker:up
   ```

---

## 5. Helpful NPM Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Runs the Vite development server on localhost |
| `npm run build` | Compiles production TypeScript bundle |
| `npm run test` | Runs the Vitest test suite |
| `npm run db:start` | Starts local Supabase Docker database stack |
| `npm run db:stop` | Stops local Supabase Docker containers |
| `npm run db:status` | Checks status and endpoints of local Docker stack |
| `npm run db:reset` | Resets local DB and reapplies migrations & seed data |
| `npm run docker:up` | Builds and runs full stack in Docker Compose |

---

## 6. Testing & Quality Assurance

The codebase includes automated unit tests covering business logic calculations, analytical metrics, permission models, and service abstractions.

Run tests:
```bash
npm run test
```

---

## 7. License & Credits

Built by Ireoluwa Opadotun as a Final Year Computer Science Capstone Project.
