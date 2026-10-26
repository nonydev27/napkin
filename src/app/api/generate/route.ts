import { NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION = 2400;

function cleanAndCompleteHtml(raw: string): string {
  let code = raw
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // If model returned a snippet without full <html> structure, wrap it into a modern responsive document
  if (!code.toLowerCase().includes("<html")) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Napkin Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; background: #fff; color: #111; line-height: 1.5; }
  </style>
</head>
<body>
${code}
</body>
</html>`;
  }

  // If opening <html> exists but </html> is missing at the end due to truncation, auto-close it
  if (!code.toLowerCase().includes("</html>")) {
    if (code.toLowerCase().includes("<body") && !code.toLowerCase().includes("</body>")) {
      code += "\n</body>";
    }
    code += "\n</html>";
  }

  if (!/^<!doctype\s+html/i.test(code)) {
    code = `<!DOCTYPE html>\n${code}`;
  }

  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i.test(code)) {
    const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1">';
    const headTag = /<head(?:\s[^>]*)?>/i;
    const htmlTag = /<html(?:\s[^>]*)?>/i;

    if (headTag.test(code)) {
      code = code.replace(headTag, (opening) => `${opening}\n${viewportMeta}`);
    } else if (htmlTag.test(code)) {
      code = code.replace(
        htmlTag,
        (opening) => `${opening}\n<head>${viewportMeta}</head>`,
      );
    }
  }

  return code;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const imageValue = formData.get("image");
  const prompt = formData.get("prompt");
  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));

  if (imageValue !== null && !(imageValue instanceof File)) {
    return NextResponse.json(
      { error: "The sketch upload is invalid. Choose an image and try again." },
      { status: 400 },
    );
  }

  const image = imageValue instanceof File ? imageValue : null;
  if (
    image &&
    (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES)
  ) {
    return NextResponse.json(
      { error: "Use a PNG, JPEG, or WebP image smaller than 8 MB." },
      { status: 400 },
    );
  }

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 240 ||
    height < 320 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    return NextResponse.json(
      { error: "Canvas dimensions must be between 240 and 2,400 pixels wide and 320 and 2,400 pixels tall." },
      { status: 400 },
    );
  }

  if (
    typeof prompt !== "string" ||
    prompt.length > 1200 ||
    (!image && !prompt.trim())
  ) {
    return NextResponse.json(
      { error: "Describe the interface you want, or add a sketch first." },
      { status: 400 },
    );
  }

  const designPrompt = `Build a polished, responsive, multi-page ${width}x${height}px website that runs as one self-contained HTML file in a browser preview.
${image ? "Use the attached sketch as the visual source of truth for the home page; preserve every visible region and extend its style to the other pages." : `Design idea: ${prompt}`}
Create at least 4 genuinely distinct, fully designed pages: Home plus 3 relevant pages (for example About, Services/Features, and Contact; choose equivalents that fit the idea). Do not make these just sections stacked on one long page.
Use hash routes such as #/home, #/about, #/services, and #/contact. Each page must be its own <main data-page="home">...</main> element, with all but the active page hidden. The visible desktop/mobile navigation must link to every page. Add a small inline script that reads the hash on load and on hashchange, shows the matching page, and updates the active navigation state. Include working back/forward navigation through normal browser history.
Return only one complete HTML5 document with doctype, responsive viewport meta tag, semantic markup, and inline CSS/JavaScript. Use no external scripts, markdown fences, or explanations.
Make every page feel complete with idea-specific content and consistent shared navigation. The site must adapt cleanly from 360px phones through tablets to wide desktop screens: use fluid widths, flexible grids, and CSS media queries; collapse navigation and columns for small screens; avoid fixed-width layouts and horizontal overflow; make controls comfortable for touch. Treat the requested dimensions as the initial preview viewport, not the only supported size or a total page-height limit. Allow natural vertical scrolling; never clip page content with fixed heights or hidden body overflow.`;

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const isGeminiConfigured = Boolean(
    geminiApiKey &&
    geminiApiKey !== "your_actual_api_key_here" &&
    geminiApiKey.length > 8,
  );
  const explicitProvider = process.env.AI_PROVIDER?.toLowerCase().trim();
  const isVercelDeployment = process.env.VERCEL === "1";
  const useGemini =
    isVercelDeployment ||
    explicitProvider === "gemini" ||
    (explicitProvider !== "ollama" &&
      (isGeminiConfigured || process.env.NODE_ENV === "production"));

  if (useGemini && !isGeminiConfigured) {
    const error =
      isVercelDeployment
        ? "AI generation is not configured on Vercel. Add GEMINI_API_KEY in Project Settings → Environment Variables for Production, then redeploy."
        : process.env.NODE_ENV === "production"
          ? "AI generation is not configured for this deployment. Add GEMINI_API_KEY to the production environment variables, then redeploy."
        : "GEMINI_API_KEY is missing or invalid. Add it to .env.local, or set AI_PROVIDER=ollama to use local Ollama.";
    return NextResponse.json({ error }, { status: 503 });
  }

  // 1. Google Gemini API flow (Cloud / Vercel / Local with key)
  if (useGemini && isGeminiConfigured && geminiApiKey) {
    // Model candidates: prioritize fast, multimodal vision models
    const candidateModels = [
      process.env.GEMINI_MODEL,
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
    ].filter(Boolean) as string[];

    // Remove duplicates while preserving priority order
    const modelsToTry = Array.from(new Set(candidateModels));

    let lastError = "Generation failed. Check your Gemini API key and try again.";

    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

      try {
        const parts: Array<{
          text?: string;
          inline_data?: { mime_type: string; data: string };
        }> = [{ text: designPrompt }];

        if (image) {
          const base64Data = Buffer.from(await image.arrayBuffer()).toString("base64");
          parts.push({
            inline_data: {
              mime_type: image.type,
              data: base64Data,
            },
          });
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(45_000),
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 12288,
            },
          }),
        });

        if (!response.ok) {
          const errorDetail = await response.json().catch(() => null);
          const apiError = errorDetail?.error?.message;
          console.warn(`Gemini model ${model} returned ${response.status}:`, apiError);

          if (response.status === 400 && apiError?.includes("API_KEY_INVALID")) {
            return NextResponse.json(
              { error: "Your GEMINI_API_KEY is invalid. Please check your key in .env.local or Vercel settings." },
              { status: 401 },
            );
          }

          if (response.status === 429) {
            return NextResponse.json(
              { error: "Gemini API rate limit reached. Please wait a few seconds and try again." },
              { status: 429 },
            );
          }

          lastError = apiError || `Model ${model} returned ${response.status}`;
          // If this model returned 404/503, try next candidate model
          continue;
        }

        const result = (await response.json()) as {
          candidates?: Array<{
            finishReason?: string;
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const candidate = result.candidates?.[0];
        const rawContent =
          candidate?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";

        if (rawContent.length > 20) {
          const html = cleanAndCompleteHtml(rawContent);
          return NextResponse.json({ code: html });
        }
      } catch (err) {
        console.warn(`Attempt with ${model} failed:`, err);
        if (err instanceof Error && err.name === "TimeoutError") {
          lastError = "Generation took too long. Try with a simpler description or sketch.";
        }
      }
    }

    return NextResponse.json({ error: lastError }, { status: 502 });
  }

  // 2. Ollama / Gemma flow (Local offline inference)
  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434")
    .trim()
    .replace(/\/+$/, "");
  const model = process.env.GEMMA_MODEL || "gemma3n:e2b";

  try {
    const userMessage: {
      role: "user";
      content: string;
      images?: string[];
    } = {
      role: "user",
      content: designPrompt,
    };
    if (image) {
      userMessage.images = [Buffer.from(await image.arrayBuffer()).toString("base64")];
    }

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        stream: false,
        messages: [userMessage],
        options: { temperature: 0.25 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`Ollama returned HTTP ${response.status}:`, detail);
      if (response.status === 404) {
        return NextResponse.json(
          { error: `Gemma model "${model}" is not installed in Ollama. Run: ollama pull ${model}` },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Local Ollama generation failed. Check that Ollama is running and try again." },
        { status: 502 },
      );
    }

    const result = (await response.json()) as {
      message?: { content?: string };
      error?: string;
    };

    if (result.error) {
      return NextResponse.json(
        { error: "Local Ollama generation error: " + result.error },
        { status: 502 },
      );
    }

    const rawContent = result.message?.content || "";
    if (rawContent.length > 20) {
      const html = cleanAndCompleteHtml(rawContent);
      return NextResponse.json({ code: html });
    }

    return NextResponse.json(
      { error: "The model returned incomplete HTML. Try generating again." },
      { status: 502 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Local Ollama took too long. Try a smaller model or add GEMINI_API_KEY for instant cloud generation." },
        { status: 504 },
      );
    }

    console.error("Could not reach Ollama:", error);
    return NextResponse.json(
      {
        error:
          "Could not reach Ollama at 127.0.0.1:11434. To fix this: add your GEMINI_API_KEY in .env.local (and restart dev server), or start local Ollama (`ollama run gemma3n:e2b`).",
      },
      { status: 503 },
    );
  }
}
