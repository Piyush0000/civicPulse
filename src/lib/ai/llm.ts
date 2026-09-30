import { config } from "../config";

// Free-tier LLMs only. Groq and Gemini both expose OpenAI-compatible chat endpoints, so one client
// covers both. Providers are tried in order; on any failure (429, timeout, bad JSON) we fall through
// and callers finally use their deterministic rule-based fallback.

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: object } };

type Provider = { name: string; url: string; key: string; model: string };

export function providers(): Provider[] {
  const out: Provider[] = [];
  if (config.groqKey)
    out.push({ name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: config.groqKey, model: config.groqModel });
  if (config.geminiKey)
    out.push({
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: config.geminiKey,
      model: config.geminiModel,
    });
  return out;
}

export const hasLLM = () => providers().length > 0;

export type ChatResult = { text: string; toolCalls: ToolCall[]; provider: string; model: string };

export async function chat(opts: {
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDef[];
  timeoutMs?: number;
  prefer?: "groq" | "gemini";
}): Promise<ChatResult> {
  const errors: string[] = [];
  const list = providers().sort((a, b) => Number(b.name === opts.prefer) - Number(a.name === opts.prefer));
  for (const p of list) {
   for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model: p.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1500,
      };
      // gpt-oss models reason before answering; "low" keeps latency close to a plain chat model.
      if (p.model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
      if (opts.json) body.response_format = { type: "json_object" };
      if (opts.tools?.length) {
        body.tools = opts.tools;
        body.tool_choice = "auto";
      }
      const res = await fetch(p.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
      });
      if (!res.ok) {
        const msg = `${res.status} ${(await res.text()).slice(0, 200)}`;
        // Free tiers return 429/503 under load ("model is experiencing high demand"): retry once, then fall through.
        if ((res.status === 429 || res.status === 503) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as {
        choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
      };
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("empty response");
      return { text: msg.content ?? "", toolCalls: msg.tool_calls ?? [], provider: p.name, model: p.model };
    } catch (e) {
      errors.push(`${p.name}: ${(e as Error).message}`);
      break;
    }
   }
  }
  throw new Error(errors.length ? `all LLM providers failed: ${errors.join(" | ")}` : "no LLM provider configured");
}

/** Parse a JSON object out of a model reply (tolerates code fences and leading prose). */
export function parseJsonObject(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error("no JSON object in model output");
  }
}
