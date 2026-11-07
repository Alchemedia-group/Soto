import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, TOOLS } from "@/lib/assistant-tools";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text, context } = (await req.json()) as { text?: string; context?: unknown };
  if (!text?.trim()) return Response.json({ error: "Sin texto" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ offline: true, reply: "", actions: [] });
  }

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\nContexto actual del negocio (JSON):\n${JSON.stringify(context)}`,
      tools: TOOLS as unknown as Anthropic.Tool[],
      messages: [{ role: "user", content: text }],
    });

    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    const actions = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ name: b.name, input: b.input as Record<string, unknown> }));

    return Response.json({ reply, actions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return Response.json({ error: msg }, { status: 502 });
  }
}
