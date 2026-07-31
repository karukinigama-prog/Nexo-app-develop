import { NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/chats?sessionId=xxx — list all chats for a session
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
    });
  }

  try {
    const chats = await sql`
      SELECT * FROM chats
      WHERE session_id = ${sessionId}
      ORDER BY updated_at DESC
    `;
    return new Response(JSON.stringify({ chats }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

// POST /api/chats — create a new chat
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, title, modelId } = body;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
    });
  }

  try {
    const [chat] = await sql`
      INSERT INTO chats (session_id, title, model_id)
      VALUES (${sessionId}, ${title || "New chat"}, ${modelId || "nexio-1.1"})
      RETURNING *
    `;
    return new Response(JSON.stringify({ chat }), { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

// PATCH /api/chats — update chat title
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, title } = body;

  if (!id || !title) {
    return new Response(JSON.stringify({ error: "Missing id or title" }), {
      status: 400,
    });
  }

  try {
    const [chat] = await sql`
      UPDATE chats SET title = ${title}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return new Response(JSON.stringify({ chat }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

// DELETE /api/chats?id=xxx — delete a chat
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
    });
  }

  try {
    await sql`DELETE FROM chats WHERE id = ${id}`;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
