import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
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

type StoredClientRecord = Omit<ClientRecord, "password"> & {
  passwordCiphertext: string;
};

const dataDir = process.env.CLIENTS_DATA_DIR
  ? path.resolve(process.env.CLIENTS_DATA_DIR)
  : path.join(process.cwd(), "data");
const clientsFile = path.join(dataDir, "clients.json");
const lockFile = `${clientsFile}.lock`;

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(clientsFile);
  } catch {
    await fs.writeFile(clientsFile, "[]", "utf-8");
  }
}

async function acquireLock(retries = 20, delay = 100) {
  const staleMs = 5_000; // consider locks older than 5s stale
  for (let i = 0; i < retries; i++) {
    try {
      const handle = await fs.open(lockFile, "wx");
      try {
        await handle.writeFile(String(process.pid));
      } finally {
        await handle.close();
      }
      return;
    } catch {
      // If lock exists, check if it's stale and remove it
      try {
        const stat = await fs.stat(lockFile);
        const age = Date.now() - stat.mtimeMs;
        if (age > staleMs) {
          await fs.unlink(lockFile);
          // try immediately again
          continue;
        }
      } catch {
        // ignore stat errors and fall through to wait
      }

      // exponential backoff with jitter
      const wait = delay * Math.min(1 << i, 8) + Math.floor(Math.random() * 50);
      await new Promise((res) => setTimeout(res, wait));
    }
  }
  throw new Error("Could not acquire file lock for clients data. Try again later.");
}

async function releaseLock() {
  try {
    await fs.unlink(lockFile);
  } catch {
    // ignore
  }
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

function normalizeStoredClient(raw: unknown): StoredClientRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<StoredClientRecord> & {
    id?: string;
    passwordCiphertext?: string;
  };
  if (
    !candidate.id ||
    !candidate.name ||
    !candidate.email ||
    (!candidate.passwordCiphertext && !(candidate as { password?: string }).password)
  ) {
    return null;
  }

  const createdAt = candidate.createdAt ?? new Date().toISOString();
  const updatedAt = candidate.updatedAt ?? createdAt;
  const passwordCiphertext =
    candidate.passwordCiphertext ??
    (candidate as { password?: string }).password;

  if (!passwordCiphertext) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    company: candidate.company ?? "",
    email: candidate.email,
    phone: candidate.phone ?? "",
    plan: normalizePlan(candidate.plan),
    status: normalizeStatus(candidate.status),
    passwordCiphertext,
    notes: candidate.notes ?? "",
    createdAt,
    updatedAt,
  };
}

function toClientRecord(record: StoredClientRecord): ClientRecord | null {
  try {
    const password = decryptSecret(record.passwordCiphertext);
    return {
      ...record,
      password,
    };
  } catch (error) {
    console.error(`Unable to decrypt password for client ${record.id}`, error);
    return null;
  }
}

async function readStoredClientsUnsafe(): Promise<StoredClientRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(clientsFile, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeStoredClient(item))
      .filter((item): item is StoredClientRecord => Boolean(item))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

async function writeStoredClientsUnsafe(clients: StoredClientRecord[]) {
  await ensureDataFile();
  const tmp = `${clientsFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(clients, null, 2), "utf-8");
  await fs.rename(tmp, clientsFile);
}

async function runWithClientLock<T>(operation: () => Promise<T>) {
  await acquireLock();
  try {
    return await operation();
  } finally {
    await releaseLock();
  }
}

export async function readClients(): Promise<ClientRecord[]> {
  const stored = await readStoredClientsUnsafe();
  return stored
    .map((record) => toClientRecord(record))
    .filter((item): item is ClientRecord => Boolean(item));
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

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error("A valid email address is required.");
  }

  if (!password) {
    throw new Error("A password is required.");
  }

  const now = new Date().toISOString();
  const storedClient: StoredClientRecord = {
    id: randomUUID(),
    name: trimmedName,
    company,
    email: trimmedEmail,
    phone,
    plan,
    status,
    passwordCiphertext: encryptSecret(password),
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const plainRecord: ClientRecord = {
    ...storedClient,
    password,
  };

  await runWithClientLock(async () => {
    const clients = await readStoredClientsUnsafe();

    if (clients.some((client) => client.email === trimmedEmail)) {
      throw new Error("A client with this email already exists.");
    }

    const updated = [storedClient, ...clients];
    await writeStoredClientsUnsafe(updated);
  });

  return plainRecord;
}

export async function removeClient(id: string) {
  return runWithClientLock(async () => {
    const clients = await readStoredClientsUnsafe();
    const updated = clients.filter((client) => client.id !== id);
    const removed = updated.length !== clients.length;

    if (!removed) {
      return { removed: false };
    }

    await writeStoredClientsUnsafe(updated);
    return { removed: true };
  });
}

export async function updateClient(input: ClientUpdateInput) {
  const trimmedId = input.id?.trim();
  if (!trimmedId) {
    throw new Error("Client id is required.");
  }

  return runWithClientLock(async () => {
    const clients = await readStoredClientsUnsafe();
    const index = clients.findIndex((client) => client.id === trimmedId);

    if (index === -1) {
      throw new Error("Client not found.");
    }

    const existing = clients[index];

    const name =
      typeof input.name === "string" ? input.name.trim() : existing.name;
    if (!name) {
      throw new Error("Client name is required.");
    }

    const email =
      typeof input.email === "string"
        ? input.email.trim().toLowerCase()
        : existing.email;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("A valid email address is required.");
    }

    if (
      clients.some(
        (client, idx) => idx !== index && client.email.toLowerCase() === email
      )
    ) {
      throw new Error("A client with this email already exists.");
    }

    const plan = normalizePlan(input.plan ?? existing.plan);
    const status = normalizeStatus(input.status ?? existing.status);
    const company =
      typeof input.company === "string"
        ? input.company.trim()
        : existing.company;
    const phone =
      typeof input.phone === "string" ? input.phone.trim() : existing.phone;
    const notes =
      typeof input.notes === "string" ? input.notes.trim() : existing.notes;

    let passwordCiphertext = existing.passwordCiphertext;
    let password: string | undefined;

    if (typeof input.password === "string") {
      const trimmed = input.password.trim();
      if (!trimmed) {
        throw new Error("Password cannot be empty.");
      }
      passwordCiphertext = encryptSecret(trimmed);
      password = trimmed;
    }

    const updatedAt = new Date().toISOString();
    const updatedRecord: StoredClientRecord = {
      ...existing,
      name,
      email,
      plan,
      status,
      company,
      phone,
      notes,
      updatedAt,
      passwordCiphertext,
    };

    clients[index] = updatedRecord;
    await writeStoredClientsUnsafe(clients);

    const resolvedPassword =
      password ?? decryptSecret(existing.passwordCiphertext);

    return {
      ...updatedRecord,
      password: resolvedPassword,
    };
  });
}
