import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrompt,
  buildThumbnailPrompt,
  extractFinishReason,
  extractGeneratedImage,
  extractOpenRouterImage,
  extractOpenRouterText,
  extractOutputText,
  generateScriptWithOpenRouter,
  generateThumbnailWithOpenRouter,
  normalizeScriptRequest,
  validateCredentials,
  validateScriptRequest
} from "../server.js";
import { hashPassword, normalizeEmail, verifyPassword } from "../src/auth.js";

test("normalizeScriptRequest trims incoming values", () => {
  const normalized = normalizeScriptRequest({
    topic: "  AI automation  ",
    audience: "  startup founders ",
    tone: "  bold ",
    duration: " 8 minutes ",
    objective: "  build authority ",
    keyPoints: "  case study, mistakes ",
    callToAction: "  subscribe "
  });

  assert.deepEqual(normalized, {
    topic: "AI automation",
    audience: "startup founders",
    tone: "bold",
    duration: "8 minutes",
    platform: "YouTube",
    objective: "build authority",
    keyPoints: "case study, mistakes",
    callToAction: "subscribe"
  });
});

test("validateScriptRequest reports missing required fields", () => {
  const result = validateScriptRequest({
    topic: "How to use ChatGPT",
    audience: "",
    tone: "Friendly"
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(result.missingFields, ["audience", "duration"]);
});

test("validateCredentials checks email and password rules", () => {
  const invalid = validateCredentials({
    email: "not-an-email",
    password: "short"
  });

  assert.equal(invalid.isValid, false);
  assert.match(invalid.error, /valid email address/);

  const valid = validateCredentials({
    email: "  Creator@Narrivox.ai ",
    password: "supersecure"
  });

  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.data, {
    email: "creator@narrivox.ai",
    password: "supersecure"
  });
});

test("buildPrompt includes optional strategy details", () => {
  const prompt = buildPrompt({
    topic: "Faceless channel ideas",
    audience: "beginner creators",
    tone: "friendly and practical",
    duration: "4 to 6 minutes",
    platform: "YouTube",
    objective: "increase subscribers",
    keyPoints: "mention niches, posting cadence, monetization",
    callToAction: "ask viewers to comment their niche"
  });

  assert.match(prompt, /Topic: Faceless channel ideas/);
  assert.match(prompt, /Video goal: increase subscribers/);
  assert.match(prompt, /Call to action: ask viewers to comment their niche/);
  assert.match(prompt, /Full script/);
});

test("buildThumbnailPrompt includes thumbnail direction and script context", () => {
  const prompt = buildThumbnailPrompt(
    {
      topic: "Movie endings explained",
      audience: "film fans",
      tone: "Critical and analytical",
      duration: "8 to 10 minutes",
      objective: "increase click-through rate",
      keyPoints: "highlight one twist and one unresolved question"
    },
    "This is the full script body."
  );

  assert.match(prompt, /16:9/);
  assert.match(prompt, /Movie endings explained/);
  assert.match(prompt, /Critical and analytical/);
  assert.match(prompt, /Script context/);
});

test("extractOutputText joins Gemini candidate text parts", () => {
  const text = extractOutputText({
    candidates: [
      {
        content: {
          parts: [{ text: "Hook section" }, { inlineData: "ignored" }]
        }
      },
      {
        content: {
          parts: [{ text: "Body section" }]
        }
      }
    ]
  });

  assert.equal(text, "Hook section\n\nBody section");
});

test("extractGeneratedImage reads an Imagen prediction", () => {
  const image = extractGeneratedImage({
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: "abc123"
              }
            }
          ]
        }
      }
    ]
  });

  assert.deepEqual(image, {
    mimeType: "image/png",
    base64: "abc123"
  });
});

test("extractOpenRouterImage reads a base64 data URL response", () => {
  const image = extractOpenRouterImage({
    choices: [
      {
        message: {
          images: [
            {
              image_url: {
                url: "data:image/png;base64,openrouter-thumbnail-bytes"
              }
            }
          ]
        }
      }
    ]
  });

  assert.deepEqual(image, {
    mimeType: "image/png",
    base64: "openrouter-thumbnail-bytes"
  });
});

test("extractFinishReason reads Gemini candidate finish reason", () => {
  assert.equal(
    extractFinishReason({
      candidates: [{ finishReason: "MAX_TOKENS" }]
    }),
    "MAX_TOKENS"
  );
});

test("extractOpenRouterText reads response content", () => {
  const text = extractOpenRouterText({
    choices: [
      {
        message: {
          content: "Generated script from OpenRouter"
        }
      }
    ]
  });

  assert.equal(text, "Generated script from OpenRouter");
});

test("generateScriptWithOpenRouter returns trimmed output text", async () => {
  const script = await generateScriptWithOpenRouter(
    {
      topic: "Morning routines",
      audience: "busy professionals",
      tone: "clear",
      duration: "60 seconds",
      platform: "YouTube",
      objective: "",
      keyPoints: "",
      callToAction: ""
    },
    {
      apiKey: "test-key",
      model: "openai/gpt-4o-mini",
      fetchImpl: async (url, options) => {
        assert.equal(
          url,
          "https://openrouter.ai/api/v1/chat/completions"
        );
        assert.equal(options.method, "POST");

        return {
          ok: true,
          async json() {
            return {
              choices: [
                {
                  message: {
                    content: "  Final generated script  "
                  }
                }
              ]
            };
          }
        };
      }
    }
  );

  assert.equal(script, "Final generated script");
});

test("generateScriptWithOpenRouter surfaces provider errors", async () => {
  await assert.rejects(
    () =>
      generateScriptWithOpenRouter(
        {
          topic: "Morning routines",
          audience: "busy professionals",
          tone: "clear",
          duration: "60 seconds",
          platform: "YouTube",
          objective: "",
          keyPoints: "",
          callToAction: ""
        },
        {
          apiKey: "test-key",
          fetchImpl: async () => ({
            ok: false,
            async json() {
              return {
                error: {
                  message: "Invalid API key"
                }
              };
            }
          })
        }
      ),
    /Invalid API key/
  );
});

test("generateThumbnailWithOpenRouter returns generated image bytes", async () => {
  const image = await generateThumbnailWithOpenRouter(
    {
      topic: "AI startup myths",
      audience: "founders",
      tone: "Bold and persuasive",
      duration: "4 to 6 minutes",
      objective: "",
      keyPoints: "",
      callToAction: ""
    },
    "script body",
    {
      apiKey: "test-key",
      model: "openai/gpt-image-2",
      fetchImpl: async (url, options) => {
        assert.equal(
          url,
          "https://openrouter.ai/api/v1/chat/completions"
        );
        assert.equal(options.method, "POST");

        return {
          ok: true,
          async json() {
            return {
              choices: [
                {
                  message: {
                    images: [
                      {
                        image_url: {
                          url: "data:image/png;base64,thumbnail-bytes"
                        }
                      }
                    ]
                  }
                }
              ]
            };
          }
        };
      }
    }
  );

  assert.deepEqual(image, {
    mimeType: "image/png",
    base64: "thumbnail-bytes"
  });
});

test("normalizeEmail lowercases and trims addresses", () => {
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
});

test("hashPassword and verifyPassword work together", () => {
  const hash = hashPassword("correct horse battery staple");

  assert.equal(verifyPassword("correct horse battery staple", hash), true);
  assert.equal(verifyPassword("wrong password", hash), false);
});
