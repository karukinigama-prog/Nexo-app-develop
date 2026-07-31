import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { PROVIDER_CONFIG } from "@/lib/providers.server";
import { readUrlsFromText } from "@/lib/urlReader.server";
import type { NexoModelId } from "@/lib/models";

export const runtime = "nodejs";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DAILY_MESSAGE_LIMIT = 50;
const CODER_DAILY_LIMIT = 5;

async function checkAndIncrementRateLimit(
  sessionId: string,
  isCoder: boolean
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const limit = isCoder ? CODER_DAILY_LIMIT : DAILY_MESSAGE_LIMIT;

  const rows = await sql`
    SELECT message_count, coder_count FROM rate_limits
    WHERE session_id = ${sessionId} AND date = ${today}
    LIMIT 1
  `;
  const existing = rows[0] as { message_count: number; coder_count: number } | undefined;
  const currentCount = isCoder
    ? (existing?.coder_count ?? 0)
    : (existing?.message_count ?? 0);

  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  if (!existing) {
    await sql`
      INSERT INTO rate_limits (session_id, date, message_count, coder_count)
      VALUES (${sessionId}, ${today}, ${isCoder ? 0 : 1}, ${isCoder ? 1 : 0})
      ON CONFLICT (session_id, date) DO UPDATE
      SET message_count = rate_limits.message_count + ${isCoder ? 0 : 1},
          coder_count   = rate_limits.coder_count   + ${isCoder ? 1 : 0}
    `;
  } else {
    if (isCoder) {
      await sql`UPDATE rate_limits SET coder_count = coder_count + 1 WHERE session_id = ${sessionId} AND date = ${today}`;
    } else {
      await sql`UPDATE rate_limits SET message_count = message_count + 1 WHERE session_id = ${sessionId} AND date = ${today}`;
    }
  }

  return { allowed: true, remaining: limit - currentCount - 1, limit };
}

async function getUserMemory(sessionId: string): Promise<string> {
  try {
    const rows = await sql`
      SELECT memory_content FROM user_settings
      WHERE session_id = ${sessionId}
      LIMIT 1
    `;
    return (rows[0] as { memory_content: string } | undefined)?.memory_content?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = body.modelId as NexoModelId;
    const messages = body.messages as IncomingMessage[];
    const sessionId = body.sessionId as string | undefined;
    const isCoderMode = body.isCoderMode as boolean | undefined;

    if (sessionId) {
      const { allowed, remaining, limit } = await checkAndIncrementRateLimit(
        sessionId,
        !!isCoderMode
      );
      void remaining;
      void limit;
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "rate_limit_exceeded",
            message: isCoderMode
              ? `You've reached your free limit of ${CODER_DAILY_LIMIT} Nexo Coder queries today. Upgrade for unlimited access.`
              : `You've reached today's limit of ${DAILY_MESSAGE_LIMIT} messages. Come back tomorrow, or upgrade for unlimited access.`,
          }),
          { status: 429 }
        );
      }
    }

    const config = PROVIDER_CONFIG[modelId];
    if (!config) {
      return new Response(JSON.stringify({ error: "Unknown model" }), { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENROUTER_API_KEY environment variable." }),
        { status: 500 }
      );
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const webContext = lastUserMessage
      ? await readUrlsFromText(lastUserMessage.content)
      : "";

    const memory = sessionId ? await getUserMemory(sessionId) : "";
    let systemPrompt = memory
      ? `${config.systemPrompt}\n\nThe user has saved the following information for you to always remember about them:\n"""\n${memory}\n"""`
      : config.systemPrompt;

    if (webContext) {
      systemPrompt += `\n\n===== FETCHED WEB CONTENT =====\n${webContext}\n===== END WEB CONTENT =====`;
    }

    const upstreamRes = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://nexo.ai",
        "X-Title": "NEXO AI",
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 1.0,
        top_p: 1.0,
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const errText = await upstreamRes.text().catch(() => "Unknown error");
      return new Response(
        JSON.stringify({ error: "Upstream provider error", detail: errText }),
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamRes.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") { controller.close(); return; }
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch { /* ignore */ }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500 }
    );
  }
}
