export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Napkin";

export const SITE_TAGLINE = "From napkin to real";

export const SITE_DESCRIPTION =
  "Turn a hand-drawn sketch into a responsive interface you can actually build. Napkin turns your wireframe into live HTML you can edit, preview, save, and share.";

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
