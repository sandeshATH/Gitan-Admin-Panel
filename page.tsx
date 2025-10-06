"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ClientRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type ClientFormState = {
  name: string;
  email: string;
  password: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: "",
  email: "",
  password: "",
  notes: "",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminDashboard() {
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    if (!search.trim()) {
      return clients;
    }

    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const notes = client.notes?.toLowerCase() ?? "";
      return (
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        notes.includes(query)
      );
    });
  }, [clients, search]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/clients");
      if (!response.ok) {
        throw new Error("Failed to load client records.");
      }
      const data = (await response.json().catch(() => ({}))) as {
        clients?: ClientRecord[];
      };
      setClients(data.clients ?? []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading clients."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (error || message) {
      const timeout = setTimeout(() => {
        setError(null);
        setMessage(null);
      }, 4000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [error, message]);

  const handleChange = (
    field: keyof ClientFormState,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        client?: ClientRecord;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to save client.");
      }

      if (payload.client) {
        setClients((current) => [payload.client as ClientRecord, ...current]);
        setForm(emptyForm);
        setMessage("Client saved successfully.");
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to save client details."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (password: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError("Clipboard access is not available in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      setMessage("Password copied to clipboard.");
    } catch (err) {
      console.error(err);
      setError("Unable to copy password on this device.");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setMessage(null);
    setDeletingId(id);

    try {
      const response = await fetch(`/api/clients?id=${id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        removed?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to remove client.");
      }

      if (payload.removed) {
        setClients((current) => current.filter((client) => client.id !== id));
        setMessage("Client removed.");
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to remove client."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const stats = useMemo(
    () => ({
      total: clients.length,
      recent: clients[0]?.createdAt ?? null,
    }),
    [clients]
  );

  return (
    <div className="min-h-screen py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
        <header className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-blue-600">
                Gitan AI / Internal Use
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Client Credential Vault
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span>Secure workspace ready</span>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Capture and maintain client login details for gitanai.co projects in
            a centralized, password-protected vault. Keep entries organised and
            easy to audit.
          </p>
        </header>

        {(error || message) && (
          <div
            className={`rounded-lg border p-4 text-sm shadow-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Total clients
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Last updated
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {stats.recent ? formatDate(stats.recent) : "No records yet"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Encrypted backups
            </p>
            <p className="mt-2 text-sm font-medium text-emerald-600">
              Configured manually
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Export options
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              Coming soon
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Add client credentials
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Keep records complete to avoid losing access to client systems.
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="name">
                  Client name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Primary email or username
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="admin@gitanai.co"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Password (store securely)
                </label>
                <input
                  id="password"
                  name="password"
                  type="text"
                  required
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder="Strong password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(event) => handleChange("notes", event.target.value)}
                  placeholder="Access URL, security questions, support contacts, and more"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {submitting ? "Saving..." : "Save client"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full items-center gap-3 sm:max-w-sm">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <span className="text-xs font-semibold uppercase">Go</span>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Quick search
                  </label>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search client, email, or note"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {filteredClients.length} of {clients.length} records visible
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Email or Username</th>
                    <th className="px-4 py-3 font-semibold">Password</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Loading client records...
                      </td>
                    </tr>
                  ) : filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No client records found. Add your first entry with the form on the left.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {client.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{client.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {revealed[client.id] ? client.password : "********"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleReveal(client.id)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                            >
                              {revealed[client.id] ? "Hide" : "Reveal"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(client.password)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {client.notes?.length ? client.notes : "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDate(client.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleDelete(client.id)}
                            disabled={deletingId === client.id}
                            className="inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === client.id ? "Removing" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
