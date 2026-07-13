import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://fitbeyondplus.com";

const paths = [
  "/",
  "/about",
  "/memberships",
  "/personal-training",
  "/classes",
  "/classes/schedule",
  "/combat-sports",
  "/combat-sports/kickboxing",
  "/combat-sports/bjj",
  "/facility",
  "/blog",
  "/contact",
  "/privacy",
];

async function getBlogPaths(): Promise<string[]> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.from("blog_posts").select("slug").eq("published", true);
    if (error || !data) return [];
    return data.map((p) => `/blog/${p.slug}`);
  } catch {
    // If Supabase isn't configured, still serve the static sitemap.
    return [];
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const blogPaths = await getBlogPaths();
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...[...paths, ...blogPaths].map(
            (p) => `  <url><loc>${BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`,
          ),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
