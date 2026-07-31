// Neon PostgreSQL client — replaces Supabase
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(connectionString);

// Legacy alias kept so any remaining imports of `supabase` still resolve
export const supabase = { sql };

export interface DbChat {
  id: string;
  session_id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  model_id: string | null;
  created_at: string;
}
