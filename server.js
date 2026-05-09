import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import express from "express";
import { InferenceClient } from "@huggingface/inference";
import { createSession, hashPassword, normalizeEmail, validateSession, verifyPassword } from "./src/auth.js";
import {
  createScriptRecord,
  createUser,
  deleteScriptRecord,
  findScriptById,
  findUserByEmail,
  findUserBySessionToken,
  listScriptsByUserId,
  replaceUserSessions,
  updateScriptThumbnail
} from "./src/database.js";

const rootDir = fileURLToPath(new URL("./public/", import.meta.url));
const entryFileUrl = process.argv[1] ? fileURLToPath(new URL(import.meta.url)) : "";
const port = Number(process.env.PORT || 3000);
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const hfToken = process.env.HF_TOKEN;
const defaultTextModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const defaultImageModel = process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";

function getTextApiKey() {
  return process.env.OPENROUTER_API_KEY || openRouterApiKey || "";
}

function getImageClient() {
  if (!hfToken) return null;
  return new InferenceClient(hfToken);
}

function getTextModel() {
  return process.env.OPENROUTER_MODEL || defaultTextModel;
}

function getImageModel() {
  return process.env.HF_IMAGE_MODEL || defaultImageModel;
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt
  };
}

function sanitizeScript(script) {
  return {
    id: script.id,
    topic: script.topic,
    tone: script.tone,
    duration: script.duration,
    createdAt: script.createdAt,
    request: script.request,
    script: script.script,
    thumbnail: script.thumbnail || null
  };
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function requireAuth(req, res) {
  const token = getBearerToken(req);
  const user = token ? await findUserBySessionToken(token) : null;

  if (!user) {
    res.status(401).json({ error: "Please log in to continue." });
    return null;
  }

  const { session, activeSessions } = validateSession(user.sessions || [], token);

  if (!session) {
    await replaceUserSessions(user.id, activeSessions);
    res.status(401).json({ error: "Your session is no longer valid. Please log in again." });
    return null;
  }

  if (activeSessions.length !== (user.sessions || []).length) {
    await replaceUserSessions(user.id, activeSessions);
    user.sessions = activeSessions;
  }

  return { user };
}

export function normalizeScriptRequest(payload = {}) {
  return {
    topic: String(payload.topic || "").trim(),
    audience: String(payload.audience || "").trim(),
    tone: String(payload.tone || "").trim(),
    duration: String(payload.duration || "").trim(),
    platform: String(payload.platform || "YouTube").trim() || "YouTube",
    objective: String(payload.objective || "").trim(),
    keyPoints: String(payload.keyPoints || "").trim(),
    callToAction: String(payload.callToAction || "").trim()
  };
}

export function validateScriptRequest(payload) {
  const normalized = normalizeScriptRequest(payload);
  const missingFields = ["topic", "audience", "tone", "duration"].filter(
    (field) => !normalized[field]
  );

  return {
    isValid: missingFields.length === 0,
    missingFields,
    data: normalized
  };
}

export function buildPrompt(data) {
  const lines = [
    `Create a high-retention ${data.platform} video script.`,
    `Topic: ${data.topic}`,
    `Target audience: ${data.audience}`,
    `Tone: ${data.tone}`,
    `Target duration: ${data.duration}`
  ];

  if (data.objective) {
    lines.push(`Video goal: ${data.objective}`);
  }

  if (data.keyPoints) {
    lines.push(`Important points to include: ${data.keyPoints}`);
  }

  if (data.callToAction) {
    lines.push(`Call to action: ${data.callToAction}`);
  }

  lines.push(
    "Format the response in Markdown with these sections:",
    "1. Title ideas",
    "2. Thumbnail text ideas",
    "3. Hook",
    "4. Full script",
    "5. B-roll or visual cues",
    "6. Closing CTA",
    "Keep the script natural, specific, and optimized for watch time."
  );

  return lines.join("\n");
}

export function buildThumbnailPrompt(data, script = "") {
  const trimmedScript = String(script || "").trim().slice(0, 1200);
  const lines = [
    "Create a bold YouTube thumbnail image concept.",
    "Style requirements: cinematic, high contrast, visually clean, readable at small size, no watermark, no extra borders.",
    "Aspect ratio: 16:9.",
    `Topic: ${data.topic}`,
    `Audience: ${data.audience}`,
    `Tone: ${data.tone}`,
    `Video duration context: ${data.duration}`
  ];

  if (data.objective) {
    lines.push(`Goal: ${data.objective}`);
  }

  if (data.keyPoints) {
    lines.push(`Key points: ${data.keyPoints}`);
  }

  if (trimmedScript) {
    lines.push(`Script context: ${trimmedScript}`);
  }

  lines.push(
    "Generate one thumbnail image only.",
    "Focus on one clear focal subject, strong emotion or tension, and a dramatic background.",
    "If text appears in the image, keep it to 3 words or fewer, large and legible."
  );

  return lines.join("\n");
}

export function validateCredentials(payload = {}) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "").trim();
  const missingFields = [];

  if (!email) missingFields.push("email");
  if (!password) missingFields.push("password");

  if (missingFields.length > 0) {
    return { isValid: false, missingFields, data: { email, password } };
  }

  if (!email.includes("@")) {
    return { isValid: false, missingFields: [], error: "Please enter a valid email address.", data: { email, password } };
  }

  if (password.length < 8) {
    return { isValid: false, missingFields: [], error: "Password must be at least 8 characters long.", data: { email, password } };
  }

  return { isValid: true, missingFields: [], data: { email, password } };
}

export async function generateScriptWithOpenRouter(data, options = {}) {
  const apiKey = options.apiKey || getTextApiKey();
  const model = options.model || getTextModel();
  const fetchImpl = options.fetchImpl || fetch;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable.");
  }

  const payload = await requestOpenRouterChat({ apiKey, model, fetchImpl, prompt: buildPrompt(data) });
  const finalText = extractOpenRouterText(payload).trim();

  if (!finalText) {
    throw new Error("The AI provider returned an empty response.");
  }

  return finalText;
}

export function extractOpenRouterText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === "string" ? part.text : "")).filter(Boolean).join("\n\n");
  }

  return "";
}

export async function generateThumbnail(prompt, options = {}) {
  const client = options.client || getImageClient();
  const model = options.model || getImageModel();

  if (!client) {
    throw new Error("Missing HF_TOKEN environment variable.");
  }

  const imageBlob = await client.textToImage({
    provider: "hf-inference",
    model,
    inputs: prompt,
    parameters: { num_inference_steps: 5 }
  });

  const buffer = Buffer.from(await imageBlob.arrayBuffer());
  const base64 = buffer.toString("base64");

  return { mimeType: imageBlob.type || "image/png", base64 };
}

export function extractOutputText(payload) {
  const candidates = payload?.candidates;
  if (!Array.isArray(candidates)) return "";

  const textParts = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate?.content?.parts)) return;

    candidate.content.parts.forEach((part) => {
      if (typeof part?.text === "string") textParts.push(part.text);
    });
  });

  return textParts.join("\n\n");
}

export function extractGeneratedImage(payload) {
  const candidates = payload?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  for (const candidate of candidates) {
    if (!Array.isArray(candidate?.content?.parts)) continue;

    for (const part of candidate.content.parts) {
      const inlineData = part?.inlineData || part?.inline_data;
      const bytes = inlineData?.data;

      if (typeof bytes === "string" && bytes) {
        return { mimeType: inlineData?.mimeType || inlineData?.mime_type || "image/png", base64: bytes };
      }
    }
  }

  return null;
}

export function extractOpenRouterImage(payload) {
  const directImage = payload?.data?.[0];
  if (typeof directImage?.b64_json === "string" && directImage.b64_json) {
    return { mimeType: "image/png", base64: directImage.b64_json };
  }

  const dataUrl = payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    return { mimeType: match[1] || "image/png", base64: match[2] };
  }

  return null;
}

export function extractFinishReason(payload) {
  const finishReason = payload?.candidates?.[0]?.finishReason;
  return typeof finishReason === "string" ? finishReason : "";
}

async function requestGeminiContent({ apiKey, model, fetchImpl, contents, systemInstruction, generationConfig }) {
  const apiResponse = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        ...(generationConfig ? { generationConfig } : {})
      })
    }
  );

  let payload = null;
  try { payload = await apiResponse.json(); } catch { payload = null; }

  if (!apiResponse.ok) {
    throw new Error(payload?.error?.message || "The AI provider returned an error.");
  }

  return payload;
}

async function requestOpenRouterChat({ apiKey, model, fetchImpl, prompt }) {
  const apiResponse = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are an expert YouTube strategist and script writer. Write engaging, structured scripts that feel human and clear." },
        { role: "user", content: prompt }
      ],
      temperature: 0.9
    })
  });

  let payload = null;
  try { payload = await apiResponse.json(); } catch { payload = null; }

  if (!apiResponse.ok) {
    throw new Error(payload?.error?.message || "The AI provider returned an error.");
  }

  return payload;
}

// Express app

const app = express();
app.use(express.json());

// Auth routes

app.post("/api/auth/signup", async (req, res) => {
  try {
    const validation = validateCredentials(req.body);

    if (!validation.isValid) {
      res.status(400).json({
        error: validation.error || `Missing required fields: ${validation.missingFields.join(", ")}`
      });
      return;
    }

    const email = validation.data.email;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      throw new Error("An account with this email already exists.");
    }

    const session = createSession(randomUUID());
    const createdUser = {
      id: session.userId,
      email,
      passwordHash: hashPassword(validation.data.password),
      createdAt: new Date().toISOString(),
      sessions: [session]
    };

    await createUser(createdUser);

    res.status(201).json({
      token: session.token,
      user: sanitizeUser(createdUser),
      scripts: []
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create account."
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const validation = validateCredentials(req.body);

    if (!validation.isValid) {
      res.status(400).json({
        error: validation.error || `Missing required fields: ${validation.missingFields.join(", ")}`
      });
      return;
    }

    const user = await findUserByEmail(validation.data.email);

    if (!user || !verifyPassword(validation.data.password, user.passwordHash)) {
      throw new Error("Incorrect email or password.");
    }

    const session = createSession(user.id);
    const nextSessions = [...(user.sessions || []), session].slice(-5);
    await replaceUserSessions(user.id, nextSessions);
    user.sessions = nextSessions;

    const scripts = (await listScriptsByUserId(user.id, 30)).map(sanitizeScript);

    res.status(200).json({
      token: session.token,
      user: sanitizeUser(user),
      scripts
    });
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Unable to log in."
    });
  }
});

app.get("/api/auth/session", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const scripts = (await listScriptsByUserId(auth.user.id, 30)).map(sanitizeScript);

  res.json({
    user: sanitizeUser(auth.user),
    scripts
  });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = getBearerToken(req);
  const user = token ? await findUserBySessionToken(token) : null;

  if (!token || !user) {
    res.sendStatus(204);
    return;
  }

  const nextSessions = (user.sessions || []).filter((session) => session.token !== token);
  await replaceUserSessions(user.id, nextSessions);

  res.sendStatus(204);
});

// Script routes

app.post("/api/generate-script", async (req, res) => {
  try {
    const validation = validateScriptRequest(req.body);

    if (!validation.isValid) {
      res.status(400).json({
        error: `Missing required fields: ${validation.missingFields.join(", ")}`
      });
      return;
    }

    const auth = await requireAuth(req, res);
    if (!auth) return;

    const scriptText = await generateScriptWithOpenRouter(validation.data);
    const savedScript = {
      id: randomUUID(),
      userId: auth.user.id,
      topic: validation.data.topic,
      tone: validation.data.tone,
      duration: validation.data.duration,
      createdAt: new Date().toISOString(),
      request: validation.data,
      script: scriptText,
      thumbnail: null
    };

    await createScriptRecord(savedScript);

    res.json({
      script: scriptText,
      savedScript: sanitizeScript(savedScript)
    });
  } catch (error) {
    res.status(error instanceof SyntaxError ? 400 : 500).json({
      error: error instanceof Error ? error.message : "Something went wrong."
    });
  }
});

app.post("/api/generate-thumbnail", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const prompt = String(req.body.prompt || "").trim();

    if (!prompt) {
      res.status(400).json({ error: "Missing required field: prompt" });
      return;
    }

    const generated = await generateThumbnail(prompt);
    const thumbnail = {
      mimeType: generated.mimeType,
      base64: generated.base64,
      generatedAt: new Date().toISOString()
    };

    res.json({ thumbnail });
  } catch (error) {
    res.status(error instanceof SyntaxError ? 400 : 500).json({
      error: error instanceof Error ? error.message : "Something went wrong."
    });
  }
});

app.post("/api/delete-script", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const scriptId = String(req.body.scriptId || "").trim();

    if (!scriptId) {
      res.status(400).json({ error: "Missing required field: scriptId" });
      return;
    }

    const existingScript = await findScriptById(scriptId, auth.user.id);

    if (!existingScript) {
      res.status(404).json({ error: "Saved script not found." });
      return;
    }

    await deleteScriptRecord(scriptId, auth.user.id);

    res.json({ deletedId: scriptId });
  } catch (error) {
    res.status(error instanceof SyntaxError ? 400 : 500).json({
      error: error instanceof Error ? error.message : "Something went wrong."
    });
  }
});

// Static file serving

app.use(express.static(rootDir, {
  setHeaders(response, filePath) {
    const contentType = contentTypes[extname(filePath)];
    if (contentType) {
      response.setHeader("Content-Type", contentType);
    }
  }
}));

// SPA fallback

app.get("/{*path}", (req, res) => {
  const indexPath = join(rootDir, "index.html");
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not found");
  }
});

export default app;

if (entryFileUrl === process.argv[1]) {
  app.listen(port, () => {
    console.log(`Narrivox AI available at http://localhost:${port}`);
  });
}
