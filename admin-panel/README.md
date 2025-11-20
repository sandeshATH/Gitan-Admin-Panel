# Gitan Admin Panel

A production-ready Next.js 15 dashboard for GitanAI operators to capture, audit, and maintain client credentials, plan assignments, onboarding status, and internal notes. The UI is optimized for success/engineering teams working together in real time while the backend keeps secrets encrypted at rest in Postgres.

## Tech Stack
- Next.js 15 (App Router) + React 19 client dashboard
- Tailwind CSS 4 for theming
- Vercel Postgres (or any Postgres-compatible DB) with AES-256-GCM encryption for secrets
- TypeScript end-to-end for shared domain contracts
- Blog editor tooling to manage gitanai.co content alongside client ops

## Quick Start
1. Install dependencies inside `admin-panel`:
   ```bash
   npm install
   ```
2. Create `.env.local` using [.env.example](./.env.example) and set a 32+ character `CLIENT_ENCRYPTION_KEY` plus `POSTGRES_URL` (Vercel Postgres or your own database).
3. Start the dashboard:
   ```bash
   npm run dev
   ```
4. Build & serve for production:
   ```bash
   npm run build
   npm start
   ```
5. Lint before deploy:
   ```bash
   npm run lint
   ```

## Environment Variables
| Variable | Required | Description |
| --- | --- | --- |
| `CLIENT_ENCRYPTION_KEY` | Yes | Secret used to derive the AES-256 key that encrypts every stored password. Generate via `openssl rand -hex 32`. |
| `POSTGRES_URL` | Yes | Connection string for the Postgres instance (Vercel Postgres, Neon, Supabase, etc.). |

## Operational Flow
1. **Ingest / Create** – Fill the form on the right with client + org metadata, password/token, and operational notes. On submit (`POST /api/clients`) the password is encrypted, deduplicated by email, and the table refreshes instantly.
2. **Search & Filter** – Use the global search bar or status filter chips to find accounts by name, company, plan, status, or note keywords. Metrics cards stay in sync with the filtered dataset.
3. **Reveal / Copy** – Each row masks the password by default. Click **Reveal** to temporarily display, or **Copy** to push the decrypted secret to the OS clipboard.
4. **Edit / Update** – Press **Edit** in any row to load details back into the form. Update plan/status/notes, optionally change the password, and save (`PATCH /api/clients`). Leaving the password blank keeps the existing secret.
5. **Manage Blog Content** – Switch to the Blog section to draft, review, publish, or archive posts that power gitanai.co/blog.
6. **Remove / Offboard** – Use **Remove** to delete a record (`DELETE /api/clients?id=...`). Deleting a client that is being edited automatically cancels the edit session.
7. **Auditing** – Recent additions surface at the top of the hero panel, and timestamps render with locale-friendly formatting for traceability.

## API Surface
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/clients` | Returns every client record with decrypted passwords for authenticated admins. |
| `POST` | `/api/clients` | Creates a client. Validates presence of name/email/password and enforces unique emails. |
| `PATCH` | `/api/clients` | Updates an existing client. Accepts the client `id` plus any subset of editable fields; optional password updates trigger re-encryption. |
| `DELETE` | `/api/clients?id=CLIENT_ID` | Removes a client if it exists. |
| `GET` | `/api/posts` | Lists blog posts ordered by recency. |
| `POST` | `/api/posts` | Creates a blog post (title + slug + status, optional publish time). |
| `PATCH` | `/api/posts` | Updates title/slug/status/content for an existing blog post. |
| `DELETE` | `/api/posts?id=POST_ID` | Removes a blog post. |

The API always responds with `{ client }`, `{ clients }`, or `{ message }` envelopes. Validation failures surface as `400/422`, missing records emit `404`, and unexpected errors return `500`.

## Data & Security
- Client data lives in the `gitan_clients` table inside Postgres. The API lazily creates the table/index if they do not exist, which makes local setup easy.
- Secrets are encrypted with AES-256-GCM before being inserted. Only the API layer decrypts them when responding to authenticated requests.
- To migrate older `clients.json` data, run the dashboard locally with both the JSON file and Postgres configured, then manually re-enter each record so it is re-encrypted.
- UI copy actions rely on the browser Clipboard API and gracefully degrade when unavailable.

## Testing Scenarios
- `npm run lint` ensures TypeScript + ESLint coverage across server, client, and shared types.
- Manual flows to verify before shipping:
  1. Add a new client (expect success toast + entry in table and hero cards).
  2. Edit the client status/plan without changing the password (ensure password stays masked but copy still works).
  3. Edit again with a password change (ensure clipboard reveals the new value).
  4. Delete the client and confirm it vanishes from all widgets and any edit session resets.

With the above, the admin panel covers the complete lifecycle—create, monitor, update, and retire clients—while keeping operational secrets production ready.
