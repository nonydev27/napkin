import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private, per-user pages shouldn't be indexed
        disallow: ["/api/", "/auth/", "/projects", "/share/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
