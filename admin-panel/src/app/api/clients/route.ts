import { NextRequest, NextResponse } from "next/server";
import { addClient, readClients, removeClient, updateClient } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clients = await readClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Failed to load clients", error);
    return NextResponse.json(
      { message: "Failed to load clients." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await addClient(body);
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to add client.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "Client id is required." },
      { status: 400 }
    );
  }

  try {
    const result = await removeClient(id);
    if (!result.removed) {
      return NextResponse.json(
        { message: "Client not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Unable to remove client", error);
    return NextResponse.json(
      { message: "Unable to remove client." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    const client = await updateClient(payload);
    return NextResponse.json({ client });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update client.";
    const status =
      message === "Client not found." ? 404 : message.includes("required") ? 400 : 422;
    return NextResponse.json({ message }, { status });
  }
}
