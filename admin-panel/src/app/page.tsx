"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  type ClientPlan,
  type ClientStatus,
} from "@/lib/client-options";
import type { ClientRecord } from "@/types/client";
import { BLOG_STATUS_OPTIONS } from "@/lib/posts";
import type { BlogPostRecord, BlogStatus } from "@/types/blog";

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

type BlogFormState = {
  title: string;
  slug: string;
  status: BlogStatus;
  excerpt: string;
  content: string;
  coverImage: string;
  publishedAt: string;
};

const emptyClientForm: ClientFormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  plan: "Starter",
  status: "Pending",
  password: "",
  notes: "",
};

const emptyBlogForm: BlogFormState = {
  title: "",
  slug: "",
  status: "Draft",
  excerpt: "",
  content: "",
  coverImage: "",
  publishedAt: "",
};

const navItems = [
  { id: "overview", label: "Overview", description: "Pulse" },
  { id: "clients", label: "Clients", description: "Operations" },
  { id: "blog", label: "Blog", description: "Content" },
] as const;

type NavSection = (typeof navItems)[number]["id"];

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
  const [activeNav, setActiveNav] = useState<NavSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
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

  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [postForm, setPostForm] = useState<BlogFormState>(emptyBlogForm);
  const [postSearch, setPostSearch] = useState("");
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postDeletingId, setPostDeletingId] = useState<string | null>(null);
  const [postEditingId, setPostEditingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [postMessage, setPostMessage] = useState<string | null>(null);

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

  const filteredPosts = useMemo(() => {
    if (!postSearch.trim()) {
      return posts;
    }
    const query = postSearch.trim().toLowerCase();
    return posts.filter((post) =>
      [post.title, post.slug, post.status, post.excerpt]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [posts, postSearch]);

  const recentClients = useMemo(() => clients.slice(0, 3), [clients]);

  const clientMetrics = useMemo(() => {
    const active = clients.filter((client) => client.status === "Active").length;
    const pending = clients.filter((client) => client.status === "Pending").length;
    const trials = clients.filter((client) => client.status === "Trial").length;
    const risk = clients.filter((client) => client.status === "Churn Risk").length;
    return { active, pending, trials, risk };
  }, [clients]);

  const blogMetrics = useMemo(() => {
    const published = posts.filter((post) => post.status === "Published").length;
    const drafts = posts.filter((post) => post.status !== "Published").length;
    return { total: posts.length, published, drafts };
  }, [posts]);

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

  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch("/api/posts");
      if (!response.ok) {
        throw new Error("Failed to load blog posts.");
      }
      const data = (await response.json().catch(() => ({}))) as {
        posts?: BlogPostRecord[];
      };
      setPosts(data.posts ?? []);
    } catch (err) {
      console.error(err);
      setPostError(err instanceof Error ? err.message : "Unable to load posts.");
    }
  }, []);

  useEffect(() => {
    void loadClients();
    void loadPosts();
  }, [loadClients, loadPosts]);

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

  useEffect(() => {
    if (postError || postMessage) {
      const timeout = setTimeout(() => {
        setPostError(null);
        setPostMessage(null);
      }, 4000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [postError, postMessage]);

  const handleNavClick = (id: NavSection) => {
    setActiveNav(id);
    setSidebarOpen(false);
  };

  const handleChange = (field: keyof ClientFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        setForm(emptyClientForm);
        setEditingId(null);
        setMessage(isUpdating ? "Client updated successfully." : "Client saved successfully.");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save client details.");
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
          setForm(emptyClientForm);
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
      setError(err instanceof Error ? err.message : "Unable to remove client.");
    } finally {
      setDeletingId(null);
    }
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
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyClientForm);
  };

  const handlePostChange = (field: keyof BlogFormState, value: string) => {
    setPostForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePostSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPostError(null);
    setPostMessage(null);
    setPostSubmitting(true);

    const isUpdating = Boolean(postEditingId);
    const payload = isUpdating
      ? { id: postEditingId as string, ...postForm }
      : postForm;

    try {
      const response = await fetch("/api/posts", {
        method: isUpdating ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        post?: BlogPostRecord;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to save post.");
      }

      if (result.post) {
        setPosts((current) =>
          isUpdating
            ? current.map((post) =>
                post.id === result.post?.id ? (result.post as BlogPostRecord) : post
              )
            : [result.post as BlogPostRecord, ...current]
        );
        setPostForm(emptyBlogForm);
        setPostEditingId(null);
        setPostMessage(isUpdating ? "Post updated." : "Post drafted.");
      }
    } catch (err) {
      console.error(err);
      setPostError(err instanceof Error ? err.message : "Unable to save post.");
    } finally {
      setPostSubmitting(false);
    }
  };

  const handlePostEdit = (post: BlogPostRecord) => {
    setPostForm({
      title: post.title,
      slug: post.slug,
      status: post.status,
      excerpt: post.excerpt ?? "",
      content: post.content ?? "",
      coverImage: post.coverImage ?? "",
      publishedAt: post.publishedAt ?? "",
    });
    setPostEditingId(post.id);
  };

  const handlePostDelete = async (id: string) => {
    setPostError(null);
    setPostMessage(null);
    setPostDeletingId(id);

    try {
      const response = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as {
        removed?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to remove post.");
      }

      if (payload.removed) {
        setPosts((current) => current.filter((post) => post.id !== id));
        if (postEditingId === id) {
          setPostEditingId(null);
          setPostForm(emptyBlogForm);
        }
        setPostMessage("Post removed.");
      }
    } catch (err) {
      console.error(err);
      setPostError(err instanceof Error ? err.message : "Unable to remove post.");
    } finally {
      setPostDeletingId(null);
    }
  };

  const handlePostCancel = () => {
    setPostEditingId(null);
    setPostForm(emptyBlogForm);
  };

  const OverviewSection = () => (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500">GITANAI</p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Operations + Content Control Center
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                Keep client credentials, health scores, and editorial assets in sync for the core GitanAI team.
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
              onClick={() => {
                void loadClients();
                void loadPosts();
              }}
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
                    <p className="text-xs text-slate-500">Added on {formatDate(client.createdAt)}</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Active Clients</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{clientMetrics.active}</p>
          <p className="mt-1 text-sm text-slate-500">Workspaces currently live in production.</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{clientMetrics.pending}</p>
          <p className="mt-1 text-sm text-slate-500">Clients waiting for access and kickoff.</p>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">Trials</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{clientMetrics.trials}</p>
          <p className="mt-1 text-sm text-slate-500">Accounts testing premium automations.</p>
        </div>
        <div className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-500">Blog Published</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{blogMetrics.published}</p>
          <p className="mt-1 text-sm text-slate-500">Live posts on gitanai.co/blog.</p>
        </div>
      </section>
    </div>
  );

  const ClientsSection = () => (
    <div className="space-y-8">
      {error || message ? (
        <div
          className={`rounded-2xl border p-4 text-sm shadow-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ?? message}
        </div>
      ) : null}

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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {editingId ? "Update client" : "Add new client"}
            </h2>
            <p className="text-sm text-slate-500">
              {editingId
                ? "You are editing an existing relationship. Save changes or cancel to create a new record."
                : "Capture key contacts, passwords, and onboarding context in a single, secure place."}
            </p>
          </div>
          {editingId && (
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
                onChange={(event) => handleChange("plan", event.target.value as ClientPlan)}
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
                onChange={(event) => handleChange("status", event.target.value as ClientStatus)}
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
                {editingId && (
                  <span className="text-xs font-normal text-slate-500">(leave blank to keep current)</span>
                )}
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required={!editingId}
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
            {editingId && (
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
                ? editingId
                  ? "Updating..."
                  : "Creating..."
                : editingId
                ? "Update client"
                : "Create client"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  const BlogSection = () => (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Editorial
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Blog publishing workflow</h2>
            <p className="text-sm text-slate-500">
              Draft, review, and publish homepage/blog updates for gitanai.co.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total</p>
              <p className="text-xl font-semibold text-slate-900">{blogMetrics.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Published</p>
              <p className="text-xl font-semibold text-emerald-700">{blogMetrics.published}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Drafts</p>
              <p className="text-xl font-semibold text-amber-700">{blogMetrics.drafts}</p>
            </div>
          </div>
        </div>
        {postError || postMessage ? (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm shadow-sm ${
              postError
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {postError ?? postMessage}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Search posts
            </label>
            <input
              type="text"
              value={postSearch}
              onChange={(event) => setPostSearch(event.target.value)}
              placeholder="Find by title, slug, or status"
              className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <p className="text-xs text-slate-500">
            {filteredPosts.length} of {posts.length} visible
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No posts yet. Draft something on the right.
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{post.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{post.excerpt || "No excerpt"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{post.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          post.status === "Published"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(post.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handlePostEdit(post)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            postEditingId === post.id
                              ? "border-purple-300 bg-purple-50 text-purple-700"
                              : "border-slate-200 text-slate-600 hover:border-purple-200 hover:text-purple-600"
                          }`}
                        >
                          {postEditingId === post.id ? "Editing" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePostDelete(post.id)}
                          disabled={postDeletingId === post.id}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {postDeletingId === post.id ? "Removing" : "Remove"}
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              {postEditingId ? "Update blog post" : "Draft a new blog post"}
            </h3>
            <p className="text-sm text-slate-500">
              Keep marketing, product, and GTM teams aligned with scheduled updates.
            </p>
          </div>
          {postEditingId && (
            <button
              type="button"
              onClick={handlePostCancel}
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
            >
              Cancel edit
            </button>
          )}
        </div>

        <form className="mt-6 grid gap-5" onSubmit={handlePostSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="post-title">
                Title
              </label>
              <input
                id="post-title"
                type="text"
                required
                value={postForm.title}
                onChange={(event) => handlePostChange("title", event.target.value)}
                placeholder="Autonomous workflows for support teams"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="post-slug">
                Slug
              </label>
              <input
                id="post-slug"
                type="text"
                value={postForm.slug}
                onChange={(event) => handlePostChange("slug", event.target.value)}
                placeholder="autonomous-support-workflows"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="post-status">
                Status
              </label>
              <select
                id="post-status"
                value={postForm.status}
                onChange={(event) => handlePostChange("status", event.target.value as BlogStatus)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
              >
                {BLOG_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="post-published">
                Publish at (optional)
              </label>
              <input
                id="post-published"
                type="datetime-local"
                value={postForm.publishedAt}
                onChange={(event) => handlePostChange("publishedAt", event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="post-cover">
              Cover image URL
            </label>
            <input
              id="post-cover"
              type="text"
              value={postForm.coverImage}
              onChange={(event) => handlePostChange("coverImage", event.target.value)}
              placeholder="https://cdn.gitanai.co/blog/cover.png"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="post-excerpt">
              Excerpt
            </label>
            <textarea
              id="post-excerpt"
              rows={3}
              value={postForm.excerpt}
              onChange={(event) => handlePostChange("excerpt", event.target.value)}
              placeholder="Short preview used on social and listing pages."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="post-content">
              Content
            </label>
            <textarea
              id="post-content"
              rows={6}
              value={postForm.content}
              onChange={(event) => handlePostChange("content", event.target.value)}
              placeholder="Long form content, markdown supported via MDX pipeline."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {postEditingId && (
              <button
                type="button"
                onClick={handlePostCancel}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-600 sm:w-auto"
              >
                Discard changes
              </button>
            )}
            <button
              type="submit"
              disabled={postSubmitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:bg-purple-300 sm:w-auto"
            >
              {postSubmitting
                ? postEditingId
                  ? "Updating..."
                  : "Saving..."
                : postEditingId
                ? "Update post"
                : "Save draft"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-40 w-72 translate-x-0 transform space-y-6 rounded-r-3xl border-r border-slate-200 bg-white p-6 shadow-xl transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">GITANAI OPS</p>
                <h2 className="text-2xl font-semibold text-slate-900">Control Center</h2>
                <p className="text-sm text-slate-500">Switch between revenue, delivery, and content tracks.</p>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition ${
                    activeNav === item.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {item.description}
                  </span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Production checklist</p>
              <ul className="mt-3 space-y-2">
                <li>• Client passwords encrypted in Neon</li>
                <li>• Blog drafts staged before publishing</li>
                <li>• Manual QA before pushing new posts</li>
              </ul>
            </div>
          </aside>
        </>
      )}

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">GITANAI</p>
            <p className="text-base font-semibold text-slate-900">Admin Control</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Menu
          </button>
        </div>

        <main className="space-y-10">
          {activeNav === "overview" && <OverviewSection />}
          {activeNav === "clients" && <ClientsSection />}
          {activeNav === "blog" && <BlogSection />}
        </main>
      </div>
    </div>
  );
}
