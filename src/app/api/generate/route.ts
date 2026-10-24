import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION = 2400;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Add GEMINI_API_KEY to your environment to generate a design." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");
  const prompt = formData.get("prompt");
  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Upload a sketch image first." }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_BYTES) {
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

  if (typeof prompt !== "string" || prompt.length > 1200) {
    return NextResponse.json(
      { error: "Add a short design prompt of 1,200 characters or fewer." },
      { status: 400 },
    );
  }

  const imageBytes = Buffer.from(await image.arrayBuffer());
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    generationConfig: { temperature: 0.25 },
  });

  try {
    const result = await model.generateContent([
      `Turn this hand-drawn UI sketch into one polished, responsive, self-contained HTML document.
Canvas target: ${width}x${height}px. ${prompt ? `Design direction: ${prompt}` : ""}
Return only HTML, with all CSS in a style tag and any small interactions in inline JavaScript.
Do not load remote scripts, stylesheets, fonts, or images. Do not include markdown fences.
Make the design visually complete, accessible, mobile responsive, and faithful to the sketch.`,
      {
        inlineData: {
          mimeType: image.type,
          data: imageBytes.toString("base64"),
        },
      },
    ]);
    const html = result.response.text().trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");

    if (!html.toLowerCase().includes("<html") || !html.toLowerCase().includes("</html>")) {
      return NextResponse.json(
        { error: "The model returned incomplete HTML. Try generating again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ code: html });
  } catch (error) {
    console.error("Gemini generation failed:", error);
    return NextResponse.json(
      { error: "Generation failed. Check your Gemini API key and try again." },
      { status: 502 },
    );
  }
}
