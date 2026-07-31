import { NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messages = await sql`
      SELECT id, role, content, model_id, created_at
      FROM messages
      WHERE chat_id = ${params.id}
      ORDER BY created_at ASC
      LIMIT 200
    `;
    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { role, content, modelId } = body;

  if (!role || content === undefined) {
    return new Response(JSON.stringify({ error: "Missing role or content" }), {
      status: 400,
    });
  }

  try {
    const [message] = await sql`
      INSERT INTO messages (chat_id, role, content, model_id)
      VALUES (${params.id}, ${role}, ${content}, ${modelId ?? null})
      RETURNING *
    `;

    await sql`
      UPDATE chats SET updated_at = now() WHERE id = ${params.id}
    `;

    return new Response(JSON.stringify({ message }), { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
