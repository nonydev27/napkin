import { NextResponse } from "next/server";

export const maxDuration = 180;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION = 2400;

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

  const designPrompt = `Build one polished, mobile-friendly UI for a ${width}x${height}px canvas.
${image ? "Use the attached sketch as the layout reference." : `Idea: ${prompt}`}
Return only a compact, complete HTML5 document with <!doctype html>, <html>, <head>, <body>, and closing tags. Put CSS in one <style> tag. No JavaScript, external assets, markdown, or explanations. Keep the design focused and the code under about 2,000 tokens.`;

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const isGeminiConfigured = Boolean(
    geminiApiKey &&
    geminiApiKey !== "your_actual_api_key_here" &&
    geminiApiKey.length > 10,
  );
  const explicitProvider = process.env.AI_PROVIDER?.toLowerCase().trim();
  const useGemini =
    explicitProvider === "gemini" ||
    (explicitProvider !== "ollama" && isGeminiConfigured);

  // 1. Google Gemini API flow
  if (useGemini && geminiApiKey) {
    const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

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
            temperature: 0.25,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorDetail = await response.json().catch(() => null);
        const apiError = errorDetail?.error?.message;
        console.error("Gemini API error:", response.status, errorDetail || apiError);

        if (response.status === 400 && apiError?.includes("API_KEY_INVALID")) {
          return NextResponse.json(
            { error: "Your GEMINI_API_KEY is invalid. Check Google AI Studio and update your key." },
            { status: 401 },
          );
        }

        if (response.status === 429) {
          return NextResponse.json(
            { error: "Gemini API rate limit reached. Please wait a moment and try again." },
            { status: 429 },
          );
        }

        return NextResponse.json(
          { error: apiError || "Gemini generation failed. Check your API key and try again." },
          { status: 502 },
        );
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

      const html = rawContent
        .trim()
        .replace(/^```(?:html)?\s*/i, "")
        .replace(/\s*```$/, "");

      if (!html.toLowerCase().includes("<html") || !html.toLowerCase().includes("</html>")) {
        return NextResponse.json(
          {
            error:
              candidate?.finishReason === "MAX_TOKENS"
                ? "Gemini reached its output limit before finishing the page. Try a shorter description."
                : "Gemini did not return a complete HTML page. Try a shorter description.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({ code: html });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return NextResponse.json(
          { error: "Gemini did not respond within 45 seconds. Try a shorter prompt or retry." },
          { status: 504 },
        );
      }

      console.error("Gemini API connection error:", error);
      return NextResponse.json(
        { error: "Could not reach the Gemini API. Check your internet connection and try again." },
        { status: 503 },
      );
    }
  }

  // 2. Ollama / Gemma flow (default local inference)
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
      signal: AbortSignal.timeout(170_000),
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
          { error: `Gemma model "${model}" is not installed. Run: ollama pull ${model}` },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Local Gemma generation failed. Check that Ollama is running and try again." },
        { status: 502 },
      );
    }

    const result: {
      message?: { content?: string };
      error?: string;
    } = await response.json();

    if (result.error) {
      console.error("Ollama generation error:", result.error);
      return NextResponse.json(
        { error: "Local Gemma generation failed. Check that Ollama is running and try again." },
        { status: 502 },
      );
    }

    const html = (result.message?.content || "")
      .trim()
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/\s*```$/, "");

    if (!html.toLowerCase().includes("<html") || !html.toLowerCase().includes("</html>")) {
      return NextResponse.json(
        { error: "The model returned incomplete HTML. Try generating again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ code: html });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Local Gemma took too long. Try again or use a smaller Gemma model." },
        { status: 504 },
      );
    }

    console.error("Could not connect to the local Ollama server:", error);
    return NextResponse.json(
      {
        error:
          "Could not reach Ollama at 127.0.0.1:11434. Start Ollama (`ollama run gemma3n:e2b`) or configure GEMINI_API_KEY in .env.local.",
      },
      { status: 503 },
    );
  }
}
