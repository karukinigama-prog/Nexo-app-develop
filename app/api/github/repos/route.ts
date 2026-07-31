import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { listUserRepos } from "@/lib/github.server";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const rows = await sql`
    SELECT access_token, github_username, selected_repo
    FROM user_github_tokens
    WHERE session_id = ${sessionId}
    LIMIT 1
  `;
  const githubData = rows[0] as { access_token: string; github_username: string; selected_repo: string } | undefined;

  if (!githubData?.access_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 401 });
  }

  try {
    const repos = await listUserRepos(githubData.access_token);
    return NextResponse.json({
      repos,
      username: githubData.github_username,
      selectedRepo: githubData.selected_repo,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, selectedRepo } = body;
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  await sql`
    UPDATE user_github_tokens SET selected_repo = ${selectedRepo}
    WHERE session_id = ${sessionId}
  `;
  return NextResponse.json({ success: true });
}
