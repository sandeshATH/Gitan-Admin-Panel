import { randomUUID } from "crypto";
import { createPool } from "@vercel/postgres";
import {
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  type ClientPlan,
  type ClientStatus,
} from "./client-options";
import { decryptSecret, encryptSecret } from "./crypto";
import type {
  ClientCreateInput,
  ClientRecord,
  ClientUpdateInput,
} from "@/types/client";

export type { ClientPlan, ClientStatus };

type ClientRow = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  plan: ClientPlan;
  status: ClientStatus;
  password_ciphertext: string;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

let ensureTablePromise: Promise<void> | null = null;

type Pool = ReturnType<typeof createPool>;
let pool: Pool | null = null;

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString =
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL_NO_SSL ??
    process.env.DATABASE_URL ??
    "";

  if (!connectionString) {
    throw new Error(
      "POSTGRES_URL (or DATABASE_URL) env var is required. Update your .env.local before starting the server."
    );
  }

  pool = createPool({ connectionString });
  return pool;
}

function normalizePlan(plan: string | undefined): ClientPlan {
  if (!plan) return "Starter";
  const match = PLAN_OPTIONS.find(
    (option) => option.toLowerCase() === plan.trim().toLowerCase()
  );
  return match ?? "Starter";
}

function normalizeStatus(status: string | undefined): ClientStatus {
  if (!status) return "Pending";
  const match = STATUS_OPTIONS.find(
    (option) => option.toLowerCase() === status.trim().toLowerCase()
  );
  return match ?? "Pending";
}

async function ensureClientsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await getPool().sql`
        CREATE TABLE IF NOT EXISTS gitan_clients (
          id uuid PRIMARY KEY,
          name text NOT NULL,
          company text,
          email text NOT NULL UNIQUE,
          phone text,
          plan text NOT NULL DEFAULT 'Starter',
          status text NOT NULL DEFAULT 'Pending',
          password_ciphertext text NOT NULL,
          notes text,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;
      await getPool().sql`
        CREATE UNIQUE INDEX IF NOT EXISTS gitan_clients_email_lower_idx
        ON gitan_clients ((lower(email)))
      `;
    })();
  }
  return ensureTablePromise;
}

function validateEmail(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required.");
  }
}

function mapRowToClient(row: ClientRow): ClientRecord | null {
  try {
    const createdAt = new Date(row.created_at).toISOString();
    const updatedAt = new Date(row.updated_at).toISOString();
    const password = decryptSecret(row.password_ciphertext);
    return {
      id: row.id,
      name: row.name,
      company: row.company ?? "",
      email: row.email,
      phone: row.phone ?? "",
      plan: normalizePlan(row.plan),
      status: normalizeStatus(row.status),
      password,
      notes: row.notes ?? "",
      createdAt,
      updatedAt,
    };
  } catch (error) {
    console.error(`Unable to hydrate client ${row.id}`, error);
    return null;
  }
}

export async function readClients(): Promise<ClientRecord[]> {
  await ensureClientsTable();
  const result = await getPool().sql<ClientRow>`
    SELECT *
    FROM gitan_clients
    ORDER BY created_at DESC
  `;
  return result.rows
    .map((row) => mapRowToClient(row))
    .filter((row): row is ClientRecord => Boolean(row));
}

export async function addClient(input: ClientCreateInput) {
  const trimmedName = input.name.trim();
  const trimmedEmail = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const notes = input.notes?.trim();
  const company = input.company?.trim();
  const phone = input.phone?.trim();
  const plan = normalizePlan(input.plan);
  const status = normalizeStatus(input.status);

  if (!trimmedName) {
    throw new Error("Client name is required.");
  }
  validateEmail(trimmedEmail);
  if (!password) {
    throw new Error("A password is required.");
  }

  await ensureClientsTable();

  try {
    const ciphertext = encryptSecret(password);
    const now = new Date().toISOString();
    const result = await getPool().sql<ClientRow>`
      INSERT INTO gitan_clients
        (id, name, company, email, phone, plan, status, password_ciphertext, notes, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${trimmedName}, ${company ?? null}, ${trimmedEmail}, ${phone ?? null}, ${plan}, ${status}, ${ciphertext}, ${notes ?? null}, ${now}, ${now})
      RETURNING *
    `;
    const client = mapRowToClient(result.rows[0]);
    if (!client) {
      throw new Error("Unable to save client.");
    }
    return client;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("A client with this email already exists.");
    }
    throw error;
  }
}

export async function removeClient(id: string) {
  await ensureClientsTable();
  const result = await getPool().sql`
    DELETE FROM gitan_clients
    WHERE id = ${id}
    RETURNING id
  `;
  const removed = (result.rowCount ?? 0) > 0;
  return { removed };
}

export async function updateClient(input: ClientUpdateInput) {
  const trimmedId = input.id?.trim();
  if (!trimmedId) {
    throw new Error("Client id is required.");
  }

  await ensureClientsTable();

  const existingResult = await getPool().sql<ClientRow>`
    SELECT *
    FROM gitan_clients
    WHERE id = ${trimmedId}
    LIMIT 1
  `;

  const existing = existingResult.rows[0];
  if (!existing) {
    throw new Error("Client not found.");
  }

  const name =
    typeof input.name === "string" ? input.name.trim() : existing.name;
  if (!name) {
    throw new Error("Client name is required.");
  }

  const email =
    typeof input.email === "string"
      ? input.email.trim().toLowerCase()
      : existing.email;

  validateEmail(email);

  const plan = normalizePlan(input.plan ?? existing.plan);
  const status = normalizeStatus(input.status ?? existing.status);
  const company =
    typeof input.company === "string" ? input.company.trim() : existing.company;
  const phone =
    typeof input.phone === "string" ? input.phone.trim() : existing.phone;
  const notes =
    typeof input.notes === "string" ? input.notes.trim() : existing.notes;

  let passwordCiphertext = existing.password_ciphertext;
  if (typeof input.password === "string") {
    const trimmed = input.password.trim();
    if (!trimmed) {
      throw new Error("Password cannot be empty.");
    }
    passwordCiphertext = encryptSecret(trimmed);
  }

  const updatedAt = new Date().toISOString();

  try {
    const result = await getPool().sql<ClientRow>`
      UPDATE gitan_clients
      SET
        name = ${name},
        email = ${email},
        company = ${company ?? null},
        phone = ${phone ?? null},
        plan = ${plan},
        status = ${status},
        notes = ${notes ?? null},
        password_ciphertext = ${passwordCiphertext},
        updated_at = ${updatedAt}
      WHERE id = ${trimmedId}
      RETURNING *
    `;

    const client = mapRowToClient(result.rows[0]);
    if (!client) {
      throw new Error("Unable to update client.");
    }
    return client;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("A client with this email already exists.");
    }
    throw error;
  }
}
