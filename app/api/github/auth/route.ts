import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const sessionId = searchParams.get("state");

  if (!code || !sessionId) {
    return NextResponse.json({ error: "Missing code or sessionId" }, { status: 400 });
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json({ error: "Failed to get access token" }, { status: 500 });
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${accessToken}` },
    });
    const userData = await userRes.json();

    await sql`
      INSERT INTO user_github_tokens (session_id, access_token, github_username, updated_at)
      VALUES (${sessionId}, ${accessToken}, ${userData.login}, now())
      ON CONFLICT (session_id) DO UPDATE
      SET access_token = EXCLUDED.access_token,
          github_username = EXCLUDED.github_username,
          updated_at = now()
    `;

    return NextResponse.redirect(new URL("/?github=success", req.url));
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  await sql`DELETE FROM user_github_tokens WHERE session_id = ${sessionId}`;
  return NextResponse.json({ success: true });
}
