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
    return NextResponse.json({ error: "The sketch upload is invalid. Choose an image and try again." }, { status: 400 });
  }

  const image = imageValue instanceof File ? imageValue : null;
  if (image && (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES)) {
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

  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434")
    .trim()
    .replace(/\/+$/, "");
  const model = process.env.GEMMA_MODEL || "gemma4:e4b";
  const designPrompt = `${image ? "Turn this hand-drawn UI sketch" : "Create a UI from this description"} into one polished, responsive, self-contained HTML document.
Canvas target: ${width}x${height}px. ${prompt ? `Design direction: ${prompt}` : ""}
Return only HTML, with all CSS in a style tag and any small interactions in inline JavaScript.
Do not load remote scripts, stylesheets, fonts, or images. Do not include markdown fences.
Make the design visually complete, accessible, mobile responsive, and faithful to the sketch.`;

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
          "Could not reach Ollama. Install it, run `ollama run gemma4:e4b`, and retry.",
      },
      { status: 503 },
    );
  }
}
