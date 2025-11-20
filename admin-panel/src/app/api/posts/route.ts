import { NextRequest, NextResponse } from "next/server";
import { addPost, readPosts, removePost, updatePost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await readPosts();
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Failed to load posts", error);
    return NextResponse.json({ message: "Failed to load posts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const post = await addPost(body);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create post.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const post = await updatePost(body);
    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update post.";
    const status = message === "Post not found." ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Post id is required." }, { status: 400 });
  }

  try {
    const result = await removePost(id);
    if (!result.removed) {
      return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Unable to remove post", error);
    return NextResponse.json({ message: "Unable to remove post." }, { status: 500 });
  }
}
