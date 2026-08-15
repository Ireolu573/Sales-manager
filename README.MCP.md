**MCP Integration**

- **Purpose:** Fetch production DB credentials (Postgres) securely from your MCP endpoint and write them to `.env.local` for local use or CI.

- **Usage:**

Set environment variables for the MCP endpoint and auth token in your shell or CI:

```
export MCP_URL=https://your-mcp.example.com
export MCP_TOKEN=your-mcp-token
```

Then run:

```
npm run mcp:fetch-db
```

The script will merge returned secrets into `.env.local` (creates or updates). Do not commit `.env.local`.

- **What the script expects from MCP:** a JSON object with key/value pairs, for example:

```
{
  "DATABASE_URL": "postgres://user:pass@host:5432/db",
  "VITE_SUPABASE_URL": "https://...",
  "VITE_SUPABASE_ANON_KEY": "anon-key"
}
```

- **Security:** Use environment variables or a secrets manager in CI. Never paste credentials into chat or commit them to git.

---

**Running migrations / seeds**

After fetching secrets with `npm run mcp:fetch-db` the `.env.local` file will contain `DATABASE_URL` (if returned by your MCP). On Linux/macOS you can run the provided npm scripts which will source `.env.local` and run the SQL files with `psql`:

```
npm run migrate:apply
npm run migrate:seed
```

Notes:
- These scripts rely on having `psql` installed and available in your PATH.
- The scripts source `.env.local` using a `bash -c` wrapper; adjust for other shells or CI as needed.

**Frontend runtime**

The frontend Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`. The fetch script will merge any `VITE_` values into `.env.local`, so running the app locally with `npm run dev` after fetching will use production Supabase values if provided.
