import "server-only";
import { BIN_PROMPT, ROOM_PROMPT } from "./prompts";
import { extractJson, normalizeBin, normalizeRoom, type BinResult, type RoomResult } from "./normalize";

// AI provider switch. Set AI_PROVIDER in the environment:
//   gemini    (default) → GEMINI_API_KEY, GEMINI_MODEL (default gemini-3.5-flash-lite),
//                         GEMINI_FALLBACK_MODEL (optional: tried once if the main model fails, e.g. hits a usage limit)
//   anthropic           → ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-sonnet-5-5)
//   mock                → fixed answers, for local testing only (no key, no network)
type Provider = "gemini" | "anthropic" | "mock";

export function aiConfig(): { provider: Provider; model: string; ready: boolean } {
  const provider = (process.env.AI_PROVIDER ?? "gemini") as Provider;
  if (provider === "anthropic") {
    return { provider, model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5", ready: !!process.env.ANTHROPIC_API_KEY };
  }
  if (provider === "mock") return { provider, model: "mock-1", ready: true };
  return { provider: "gemini", model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", ready: !!process.env.GEMINI_API_KEY };
}

type Image = { data: Buffer; mime: string };
const TIMEOUT_MS = 45_000;

async function callGemini(model: string, system: string | null, prompt: string, image: Image | null, json: boolean) {
  const parts: unknown[] = [];
  if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.data.toString("base64") } });
  parts.push({ text: prompt });
  const res = await fetch(`${process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts }],
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body?.error?.message ?? "request failed"}`);
  const text = (body?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini returned no text (${body?.candidates?.[0]?.finishReason ?? body?.promptFeedback?.blockReason ?? "unknown"})`);
  return text;
}

async function callAnthropic(model: string, system: string | null, prompt: string, image: Image | null) {
  const content: unknown[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.data.toString("base64") } });
  content.push({ type: "text", text: prompt });
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.1,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  const text = (body?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  if (!text) throw new Error("Claude returned no text");
  return text;
}

function mockReply(kind: "bin" | "room" | "text" | "json", prompt: string): string {
  if (kind === "bin") {
    return JSON.stringify({
      usable: true, people_visible: false, plastic_items: 9, wrong_bin_items: 1, confidence: 0.82,
      summary: "Mostly snack wrappers and two plastic bottles.",
      items: [
        { label: "crisp packet", kind: "plastic", box_2d: [120, 140, 300, 330] },
        { label: "wrapper", kind: "plastic", box_2d: [340, 420, 470, 560] },
        { label: "plastic bottle", kind: "plastic", box_2d: [200, 600, 640, 720] },
        { label: "plastic bottle", kind: "plastic", box_2d: [520, 180, 860, 300] },
        { label: "straw", kind: "plastic", box_2d: [700, 520, 760, 800] },
        { label: "wrapper", kind: "plastic", box_2d: [600, 330, 700, 470] },
        { label: "cling film", kind: "plastic", box_2d: [90, 700, 220, 880] },
        { label: "yoghurt pot", kind: "plastic", box_2d: [430, 760, 580, 900] },
        { label: "biscuit packet", kind: "plastic", box_2d: [780, 120, 920, 340] },
        { label: "banana peel", kind: "wrong_bin", box_2d: [300, 300, 420, 420] },
      ],
    });
  }
  if (kind === "room") {
    return JSON.stringify({
      usable: true, people_visible: false, lights_on: true, litter_level: 1, bin_overflowing: false, confidence: 0.9,
      summary: "Lights were left on; the floor is mostly tidy.",
      items: [
        { label: "light on", kind: "light", box_2d: [20, 200, 90, 420] },
        { label: "paper scrap", kind: "litter", box_2d: [800, 500, 870, 580] },
      ],
    });
  }
  if (kind === "json") {
    const classes = [...new Set(prompt.match(/"class":"(\d{1,2}[A-Z]{1,2})"/g) ?? [])].map((m) => m.slice(9, -1));
    return JSON.stringify({ challenges: classes.map((c) => ({ class: c, text: `${c}: aim for a plastic-free lunch every day this week!` })) });
  }
  return "Mock answer (AI_PROVIDER=mock): based on the data provided, 7A leads this month. Set a real AI provider to get real answers.";
}

async function run(kind: "bin" | "room" | "text" | "json", system: string | null, prompt: string, image: Image | null) {
  const cfg = aiConfig();
  if (!cfg.ready) throw new Error(`AI isn't set up: add the API key for ${cfg.provider} to the environment`);
  if (cfg.provider === "mock") return { text: mockReply(kind, prompt), ...cfg };
  const json = kind !== "text";
  if (cfg.provider === "anthropic") return { text: await callAnthropic(cfg.model, system, prompt, image), ...cfg };
  try {
    return { text: await callGemini(cfg.model, system, prompt, image, json), ...cfg };
  } catch (e) {
    // Backup model: a different model has its own usage limits. Not used for a bad/missing key.
    const fallback = process.env.GEMINI_FALLBACK_MODEL;
    const msg = e instanceof Error ? e.message : String(e);
    if (!fallback || fallback === cfg.model || /Gemini (401|403)|API key/i.test(msg)) throw e;
    console.warn(`Gemini ${cfg.model} failed (${msg}); trying ${fallback}`);
    return { text: await callGemini(fallback, system, prompt, image, json), ...cfg, model: fallback };
  }
}

export async function analyzePhoto(kind: "bin", image: Image): Promise<{ result: BinResult; provider: string; model: string }>;
export async function analyzePhoto(kind: "room", image: Image): Promise<{ result: RoomResult; provider: string; model: string }>;
export async function analyzePhoto(
  kind: "bin" | "room",
  image: Image,
): Promise<{ result: BinResult | RoomResult; provider: string; model: string }> {
  const r = await run(kind, null, kind === "bin" ? BIN_PROMPT : ROOM_PROMPT, image);
  const j = extractJson(r.text);
  return { result: kind === "bin" ? normalizeBin(j) : normalizeRoom(j), provider: r.provider, model: r.model };
}

export async function generateText(system: string, prompt: string) {
  return run("text", system, prompt, null);
}

export async function generateJson(system: string, prompt: string) {
  const r = await run("json", system, prompt, null);
  return { json: extractJson(r.text), provider: r.provider, model: r.model };
}

/** Short, readable reason for the screen (prototype: show the real cause). */
export function aiErrorReason(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").trim();
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timed? ?out|aborted/i.test(msg)) return "couldn't reach the AI service (internet or timeout)";
  return msg.slice(0, 220);
}
