"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  type ClientPlan,
  type ClientStatus,
} from "@/lib/client-options";
import type { ClientRecord } from "@/types/client";

type ClientFormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: ClientPlan;
  status: ClientStatus;
  password: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  plan: "Starter",
  status: "Pending",
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const statusBadgeStyles: Record<ClientStatus, string> = {
  Active: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  Pending: "bg-amber-50 text-amber-600 border border-amber-200",
  Trial: "bg-blue-50 text-blue-600 border border-blue-200",
  "Churn Risk": "bg-rose-50 text-rose-600 border border-rose-200",
  Offboarded: "bg-slate-100 text-slate-500 border border-slate-200",
};

const planBadgeStyles: Record<ClientPlan, string> = {
  Starter: "bg-slate-100 text-slate-600",
  Growth: "bg-indigo-50 text-indigo-600",
  Enterprise: "bg-purple-50 text-purple-600",
  Custom: "bg-teal-50 text-teal-600",
};

export default function AdminDashboard() {
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ClientStatus>("All");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const byStatus =
      statusFilter === "All"
        ? clients
        : clients.filter((client) => client.status === statusFilter);

    if (!search.trim()) {
      return byStatus;
    }

    const query = search.trim().toLowerCase();
    return byStatus.filter((client) => {
      const notes = client.notes?.toLowerCase() ?? "";
      const company = client.company?.toLowerCase() ?? "";
      const plan = client.plan.toLowerCase();
      const status = client.status.toLowerCase();
      return (
        client.name.toLowerCase().includes(query) ||
        company.includes(query) ||
        client.email.toLowerCase().includes(query) ||
        notes.includes(query) ||
        plan.includes(query) ||
        status.includes(query)
      );
    });
  }, [clients, search, statusFilter]);

  const recentClients = useMemo(() => clients.slice(0, 3), [clients]);

  const metrics = useMemo(() => {
    const active = clients.filter((client) => client.status === "Active").length;
    const pending = clients.filter((client) => client.status === "Pending").length;
    const trials = clients.filter((client) => client.status === "Trial").length;
    const risk = clients.filter((client) => client.status === "Churn Risk").length;
    return { active, pending, trials, risk };
  }, [clients]);

  const editingClient = useMemo(
    () =>
      editingId ? clients.find((client) => client.id === editingId) ?? null : null,
    [clients, editingId]
  );
  const isEditing = Boolean(editingId);

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

  const handleChange = (field: keyof ClientFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (client: ClientRecord) => {
    setForm({
      name: client.name,
      company: client.company ?? "",
      email: client.email,
      phone: client.phone ?? "",
      plan: client.plan,
      status: client.status,
      password: "",
      notes: client.notes ?? "",
    });
    setEditingId(client.id);
    setError(null);
    setMessage(null);
    if (typeof document !== "undefined") {
      document.getElementById("client-form")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const isUpdating = Boolean(editingId);
    const payload = isUpdating
      ? {
          id: editingId as string,
          ...form,
          password: form.password.trim() ? form.password : undefined,
        }
      : form;

    try {
      const response = await fetch("/api/clients", {
        method: isUpdating ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        client?: ClientRecord;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to save client.");
      }

      if (result.client) {
        setClients((current) =>
          isUpdating
            ? current.map((client) =>
                client.id === result.client?.id ? (result.client as ClientRecord) : client
              )
            : [result.client as ClientRecord, ...current]
        );
        setForm(emptyForm);
        setEditingId(null);
        setMessage(isUpdating ? "Client updated successfully." : "Client saved successfully.");
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
        if (editingId === id) {
          setEditingId(null);
          setForm(emptyForm);
        }
        setRevealed((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
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

  return (
    <div className="min-h-screen bg-slate-100 py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold tracking-[0.2em] text-slate-500">
                GITANAI
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  Client Operations Control Center
                </h1>
                <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                  Keep passwords, onboarding progress, and account health in sync for every
                  client. Collaborate with success, engineering, and finance teams in real time.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs uppercase tracking-wide text-slate-400">Logged in</p>
                <p className="font-medium text-slate-700">admin@gitanai.co</p>
              </div>
              <button
                type="button"
                onClick={() => void loadClients()}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                Refresh data
              </button>
            </div>
          </div>

          {recentClients.length > 0 && (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {recentClients.map((client) => (
                <article
                  key={client.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                      {getInitials(client.name) || "CL"}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">
                        Added on {formatDate(client.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {client.notes?.length ? client.notes : "No notes added yet."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
              Active Clients
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.active}</p>
            <p className="mt-1 text-sm text-slate-500">
              Workspaces currently live in production.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
              Pending Onboarding
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.pending}</p>
            <p className="mt-1 text-sm text-slate-500">
              Clients waiting for access and kickoff.
            </p>
          </div>
          <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">
              Trials Running
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.trials}</p>
            <p className="mt-1 text-sm text-slate-500">
              Accounts testing premium automations.
            </p>
          </div>
          <div className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
              Churn Risk
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.risk}</p>
            <p className="mt-1 text-sm text-slate-500">
              Accounts flagged by success team.
            </p>
          </div>
        </section>

        {(error || message) && (
          <div
            className={`rounded-2xl border p-4 text-sm shadow-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Client credentials</h2>
              <p className="text-sm text-slate-500">
                Securely manage workspace passwords, onboarding status, and plan details.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by client, email, or plan"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "All" | ClientStatus)
                }
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-40"
              >
                <option value="All">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Client</th>
                  <th className="px-5 py-4 font-semibold">Plan</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Password</th>
                  <th className="px-5 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      Loading client records...
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      No client records found. Add your first entry below.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900">{client.name}</p>
                          <p className="text-sm text-slate-500">
                            {client.company?.length ? client.company : "Company not set"}
                          </p>
                          <p className="text-xs text-slate-400">{client.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${planBadgeStyles[client.plan]}`}
                        >
                          {client.plan}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeStyles[client.status]}`}
                        >
                          {client.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {revealed[client.id] ? client.password : "••••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(client.id)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                          >
                            {revealed[client.id] ? "Hide" : "Reveal"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(client.password)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                          >
                            Copy
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(client)}
                            className={`inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold transition ${
                              editingId === client.id
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "text-slate-600 hover:border-blue-200 hover:text-blue-600"
                            }`}
                          >
                            {editingId === client.id ? "Editing" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(client.id)}
                            disabled={deletingId === client.id}
                            className="inline-flex items-center rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === client.id ? "Removing" : "Remove"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          id="client-form"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {isEditing ? "Update client" : "Add new client"}
              </h2>
              <p className="text-sm text-slate-500">
                {isEditing && editingClient
                  ? `You are editing ${editingClient.name}. Save changes or cancel to add someone new.`
                  : "Capture key contact information and credentials in a single, secure place."}
              </p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
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
                  placeholder="Ahmed Hassan"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="company">
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={form.company}
                  onChange={(event) => handleChange("company", event.target.value)}
                  placeholder="Hassan Logistics"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Email
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
                <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => handleChange("phone", event.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="plan">
                  Plan
                </label>
                <select
                  id="plan"
                  name="plan"
                  value={form.plan}
                  onChange={(event) =>
                    handleChange("plan", event.target.value as ClientPlan)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={(event) =>
                    handleChange("status", event.target.value as ClientStatus)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Password or token{" "}
                  {isEditing && (
                    <span className="text-xs font-normal text-slate-500">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  id="password"
                  name="password"
                  type="text"
                  required={!isEditing}
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder="Secure password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="notes">
                  Notes for success team
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => handleChange("notes", event.target.value)}
                  placeholder="Trial expires next week. Interested in automation workflows."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-600 sm:w-auto"
                >
                  Discard changes
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
              >
                {submitting
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                  ? "Update client"
                  : "Create client"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
