import { randomUUID } from "crypto";
import { createPool } from "@vercel/postgres";
import type {
  BlogPostInput,
  BlogPostRecord,
  BlogPostUpdateInput,
  BlogStatus,
} from "@/types/blog";

export const BLOG_STATUS_OPTIONS: BlogStatus[] = [
  "Draft",
  "Review",
  "Scheduled",
  "Published",
];

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

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  published_at: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

let ensurePostsTable: Promise<void> | null = null;

function normalizeStatus(status?: string): BlogStatus {
  if (!status) return "Draft";
  const match = BLOG_STATUS_OPTIONS.find(
    (option) => option.toLowerCase() === status.trim().toLowerCase()
  );
  return match ?? "Draft";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || randomUUID();
}

async function ensureTable() {
  if (!ensurePostsTable) {
    ensurePostsTable = (async () => {
      const client = getPool();
      await client.sql`
        CREATE TABLE IF NOT EXISTS gitan_blog_posts (
          id uuid PRIMARY KEY,
          title text NOT NULL,
          slug text NOT NULL UNIQUE,
          status text NOT NULL DEFAULT 'Draft',
          excerpt text,
          content text,
          cover_image text,
          published_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;
      await client.sql`
        CREATE UNIQUE INDEX IF NOT EXISTS gitan_blog_posts_slug_lower_idx
        ON gitan_blog_posts ((lower(slug)))
      `;
    })();
  }
  return ensurePostsTable;
}

function mapRow(row: BlogRow): BlogPostRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: normalizeStatus(row.status),
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    coverImage: row.cover_image ?? undefined,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function readPosts(): Promise<BlogPostRecord[]> {
  await ensureTable();
  const result = await getPool().sql<BlogRow>`
    SELECT * FROM gitan_blog_posts ORDER BY created_at DESC
  `;
  return result.rows.map((row) => mapRow(row));
}

export async function addPost(input: BlogPostInput) {
  const title = input.title?.trim();
  if (!title) {
    throw new Error("Post title is required.");
  }

  const slug = (input.slug?.trim() || slugify(title)).toLowerCase();
  const excerpt = input.excerpt?.trim();
  const content = input.content?.trim();
  const coverImage = input.coverImage?.trim();
  const status = normalizeStatus(input.status);
  const publishedAt = input.publishedAt ? new Date(input.publishedAt).toISOString() : null;
  const now = new Date().toISOString();

  await ensureTable();

  try {
    const result = await getPool().sql<BlogRow>`
      INSERT INTO gitan_blog_posts
        (id, title, slug, status, excerpt, content, cover_image, published_at, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${title}, ${slug}, ${status}, ${excerpt ?? null}, ${content ?? null}, ${coverImage ?? null}, ${publishedAt}, ${now}, ${now})
      RETURNING *
    `;
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("Another post already uses this slug.");
    }
    throw error;
  }
}

export async function updatePost(input: BlogPostUpdateInput) {
  const id = input.id?.trim();
  if (!id) {
    throw new Error("Post id is required.");
  }

  await ensureTable();

  const existingResult = await getPool().sql<BlogRow>`
    SELECT * FROM gitan_blog_posts WHERE id = ${id} LIMIT 1
  `;
  const existing = existingResult.rows[0];
  if (!existing) {
    throw new Error("Post not found.");
  }

  const title = typeof input.title === "string" ? input.title.trim() : existing.title;
  if (!title) {
    throw new Error("Post title is required.");
  }

  const slug = (typeof input.slug === "string" && input.slug.trim())
    ? input.slug.trim().toLowerCase()
    : existing.slug;

  const excerpt =
    typeof input.excerpt === "string" ? input.excerpt.trim() : existing.excerpt;
  const content =
    typeof input.content === "string" ? input.content.trim() : existing.content;
  const coverImage =
    typeof input.coverImage === "string" ? input.coverImage.trim() : existing.cover_image;
  const status = normalizeStatus(input.status ?? existing.status);
  const publishedAt =
    typeof input.publishedAt === "string"
      ? new Date(input.publishedAt).toISOString()
      : existing.published_at;

  const updatedAt = new Date().toISOString();

  try {
    const result = await getPool().sql<BlogRow>`
      UPDATE gitan_blog_posts
      SET
        title = ${title},
        slug = ${slug},
        status = ${status},
        excerpt = ${excerpt ?? null},
        content = ${content ?? null},
        cover_image = ${coverImage ?? null},
        published_at = ${publishedAt ?? null},
        updated_at = ${updatedAt}
      WHERE id = ${id}
      RETURNING *
    `;
    return mapRow(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("Another post already uses this slug.");
    }
    throw error;
  }
}

export async function removePost(id: string) {
  await ensureTable();
  const result = await getPool().sql`
    DELETE FROM gitan_blog_posts WHERE id = ${id}
  `;
  return { removed: (result.rowCount ?? 0) > 0 };
}
