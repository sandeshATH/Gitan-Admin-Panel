# Gitan Admin Panel

A production-ready Next.js 15 dashboard for GitanAI operators to capture, audit, and maintain client credentials, plan assignments, onboarding status, and internal notes. The UI is optimized for success/engineering teams working together in real time while the backend keeps secrets encrypted at rest.

## Tech Stack
- Next.js 15 (App Router) + React 19 client dashboard
- Tailwind CSS 4 for theming
- File-based persistence with optimistic locking and AES-256-GCM encryption
- TypeScript end-to-end for shared domain contracts

## Quick Start
1. Install dependencies inside `admin-panel`:
   ```bash
   npm install
   ```
2. Create `.env.local` using [.env.example](./.env.example) and set a 32+ character `CLIENT_ENCRYPTION_KEY`. Optional: point `CLIENTS_DATA_DIR` to a secure path outside the repo.
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
| `CLIENTS_DATA_DIR` | Optional | Absolute directory for `clients.json`. Defaults to `<project>/data` when omitted. |

## Operational Flow
1. **Ingest / Create** – Fill the form on the right with client + org metadata, password/token, and operational notes. On submit (`POST /api/clients`) the password is encrypted, deduplicated by email, and the table refreshes instantly.
2. **Search & Filter** – Use the global search bar or status filter chips to find accounts by name, company, plan, status, or note keywords. Metrics cards stay in sync with the filtered dataset.
3. **Reveal / Copy** – Each row masks the password by default. Click **Reveal** to temporarily display, or **Copy** to push the decrypted secret to the OS clipboard.
4. **Edit / Update** – Press **Edit** in any row to load details back into the form. Update plan/status/notes, optionally change the password, and save (`PATCH /api/clients`). Leaving the password blank keeps the existing secret.
5. **Remove / Offboard** – Use **Remove** to delete a record (`DELETE /api/clients?id=...`). Deleting a client that is being edited automatically cancels the edit session.
6. **Auditing** – Recent additions surface at the top of the hero panel, and timestamps render with locale-friendly formatting for traceability.

## API Surface
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/clients` | Returns every client record with decrypted passwords for authenticated admins. |
| `POST` | `/api/clients` | Creates a client. Validates presence of name/email/password and enforces unique emails. |
| `PATCH` | `/api/clients` | Updates an existing client. Accepts the client `id` plus any subset of editable fields; optional password updates trigger re-encryption. |
| `DELETE` | `/api/clients?id=CLIENT_ID` | Removes a client if it exists. |

The API always responds with `{ client }`, `{ clients }`, or `{ message }` envelopes. Validation failures surface as `400/422`, missing records emit `404`, and unexpected errors return `500`.

## Data & Security
- Client data lives in `clients.json` within the configured data directory. Reads/writes run through a PID-based lock file to prevent corruption during concurrent deployments.
- Secrets are encrypted with AES-256-GCM before touching disk. Only the API layer decrypts them when responding to authenticated requests.
- Legacy plain-text data is ignored to avoid leaking previously compromised secrets; re-import records through the UI to re-encrypt.
- UI copy actions rely on the browser Clipboard API and gracefully degrade when unavailable.

## Testing Scenarios
- `npm run lint` ensures TypeScript + ESLint coverage across server, client, and shared types.
- Manual flows to verify before shipping:
  1. Add a new client (expect success toast + entry in table and hero cards).
  2. Edit the client status/plan without changing the password (ensure password stays masked but copy still works).
  3. Edit again with a password change (ensure clipboard reveals the new value).
  4. Delete the client and confirm it vanishes from all widgets and any edit session resets.

With the above, the admin panel covers the complete lifecycle—create, monitor, update, and retire clients—while keeping operational secrets production ready.
