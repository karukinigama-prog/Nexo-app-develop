import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const rows = await sql`
    SELECT * FROM user_settings WHERE session_id = ${sessionId} LIMIT 1
  `;
  return NextResponse.json(rows[0] ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, ...settings } = body;
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  await sql`
    INSERT INTO user_settings (session_id, memory_content, theme, updated_at)
    VALUES (${sessionId}, ${settings.memory_content ?? ""}, ${settings.theme ?? null}, now())
    ON CONFLICT (session_id) DO UPDATE
    SET memory_content = EXCLUDED.memory_content,
        theme          = EXCLUDED.theme,
        updated_at     = now()
  `;
  return NextResponse.json({ success: true });
}
