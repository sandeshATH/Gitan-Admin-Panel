export type BlogStatus = "Draft" | "Review" | "Scheduled" | "Published";

export type BlogPostRecord = {
  id: string;
  title: string;
  slug: string;
  status: BlogStatus;
  excerpt: string;
  content: string;
  coverImage?: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  status?: BlogStatus;
  publishedAt?: string | null;
};

export type BlogPostUpdateInput = BlogPostInput & {
  id: string;
};
