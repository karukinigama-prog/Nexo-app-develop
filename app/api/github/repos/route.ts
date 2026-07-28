import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listUserRepos } from "@/lib/github.server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const supabase = getSupabase();
  const { data: githubData } = await supabase
    .from("user_github_tokens")
    .select("access_token, github_username, selected_repo")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!githubData?.access_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 401 });
  }

  try {
    const repos = await listUserRepos(githubData.access_token);
    return NextResponse.json({ 
      repos, 
      username: githubData.github_username,
      selectedRepo: githubData.selected_repo
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, selectedRepo } = body;

  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_github_tokens")
    .update({ selected_repo: selectedRepo })
    .eq("session_id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
