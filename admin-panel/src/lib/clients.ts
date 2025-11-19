import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PLAN_OPTIONS, STATUS_OPTIONS, type ClientPlan, type ClientStatus } from "./client-options";

export type { ClientPlan, ClientStatus };

export type ClientRecord = {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  plan: ClientPlan;
  status: ClientStatus;
  password: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientInput = {
  name: string;
  email: string;
  password: string;
  notes?: string;
  company?: string;
  phone?: string;
  plan?: string;
  status?: string;
};

const dataDir = path.join(process.cwd(), "data");
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
    } catch (err) {
      // If lock exists, check if it's stale and remove it
      try {
        const stat = await fs.stat(lockFile);
        const age = Date.now() - stat.mtimeMs;
        if (age > staleMs) {
          await fs.unlink(lockFile);
          // try immediately again
          continue;
        }
      } catch (_statErr) {
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
  } catch (_err) {
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

function normalizeClient(raw: unknown): ClientRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<ClientRecord> & { id?: string };
  if (!candidate.id || !candidate.name || !candidate.email || !candidate.password) {
    return null;
  }

  const createdAt = candidate.createdAt ?? new Date().toISOString();
  const updatedAt = candidate.updatedAt ?? createdAt;

  return {
    id: candidate.id,
    name: candidate.name,
    company: candidate.company ?? "",
    email: candidate.email,
    phone: candidate.phone ?? "",
    plan: normalizePlan(candidate.plan),
    status: normalizeStatus(candidate.status),
    password: candidate.password,
    notes: candidate.notes ?? "",
    createdAt,
    updatedAt,
  };
}

export async function readClients(): Promise<ClientRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(clientsFile, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeClient(item))
      .filter((item): item is ClientRecord => Boolean(item))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

async function writeClients(clients: ClientRecord[]) {
  await ensureDataFile();
  await acquireLock();
  const tmp = `${clientsFile}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(clients, null, 2), "utf-8");
    await fs.rename(tmp, clientsFile);
  } finally {
    await releaseLock();
  }
}

export async function addClient(input: ClientInput) {
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

  const clients = await readClients();
  const now = new Date().toISOString();

  if (clients.some((client) => client.email === trimmedEmail)) {
    throw new Error("A client with this email already exists.");
  }

  const newClient: ClientRecord = {
    id: randomUUID(),
    name: trimmedName,
    company,
    email: trimmedEmail,
    phone,
    plan,
    status,
    password: bcrypt.hashSync(password, 10),
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newClient, ...clients];
  await writeClients(updated);
  return newClient;
}

export async function removeClient(id: string) {
  await acquireLock();
  try {
    await ensureDataFile();
    const raw = await fs.readFile(clientsFile, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      // If the file is corrupted, attempt to recover with an empty list
      console.error("clients.json corrupted, recovering to empty array", parseErr);
      parsed = [];
    }

    let arr: unknown[] = [];
    if (Array.isArray(parsed)) {
      arr = parsed as unknown[];
    }

    const clients: ClientRecord[] = arr
      .map((item: unknown) => normalizeClient(item))
      .filter((item): item is ClientRecord => Boolean(item));

    const updated = clients.filter((client) => client.id !== id);
    const removed = updated.length !== clients.length;

    if (!removed) {
      return { removed: false };
    }

    await writeClients(updated);
    return { removed: true };
  } finally {
    await releaseLock();
  }
}
