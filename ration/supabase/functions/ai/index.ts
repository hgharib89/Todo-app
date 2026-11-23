// راشن · Ration — AI edge function (Supabase Edge Functions, Deno).
// Keeps the Claude API key on the server. Needs the secret ANTHROPIC_API_KEY.
// Callers must be signed in (anonymous sign-in counts); the function checks the token itself.
//
// POST body:
//   { mode: "json", prompt, images?: [{ media_type, data }], tier?: "quick"|"default"|"complex" }
//     -> { value }            (Claude's answer parsed as JSON)
//   { mode: "messages", messages, tools? }
//     -> { content, stop_reason }   (raw Claude turn; the app runs its own tools)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODELS: Record<string, string> = {
  quick: "claude-haiku-5-5",
  default: "claude-sonnet-5-5",
  complex: "claude-sonnet-5-5",
};
const MAX_BODY = 12 * 1024 * 1024; // 12 MB (a few flyer photos)

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function claude(payload: Record<string, unknown>) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Claude API ${res.status}`);
  return data;
}

function parseJson(text: string) {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return reply({ error: "Request too large" }, 413);

  // Only signed-in app users (anonymous sign-in counts) may call Claude.
  // Checked here so it works with both legacy and new JWT signing keys ("Verify JWT" can stay OFF).
  const who = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: req.headers.get("authorization") || "", apikey: req.headers.get("apikey") || "" },
  });
  if (!who.ok) return reply({ error: "Sign in required" }, 401);

  try {
    const body = await req.json();

    if (body.mode === "json") {
      const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
      const content = [
        ...images.map((im: { media_type: string; data: string }) => ({
          type: "image",
          source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data },
        })),
        { type: "text", text: String(body.prompt || "").slice(0, 150000) + "\n\nReturn only the JSON, no other text." },
      ];
      const msg = await claude({
        model: MODELS[body.tier] || MODELS.default,
        max_tokens: 8000,
        messages: [{ role: "user", content }],
      });
      const text = (msg.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      return reply({ value: parseJson(text) });
    }

    if (body.mode === "messages") {
      const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
      const tools = Array.isArray(body.tools) ? body.tools.slice(0, 8) : [];
      const msg = await claude({
        model: MODELS.default,
        max_tokens: 2000,
        messages,
        ...(tools.length ? { tools } : {}),
      });
      return reply({ content: msg.content, stop_reason: msg.stop_reason });
    }

    return reply({ error: "Unknown mode" }, 400);
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
