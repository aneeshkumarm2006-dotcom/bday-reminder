import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedPosts } from "@/lib/blog/posts";
import { getPublishedSitePages, getSiteSettings } from "@/lib/content/get";
import { STATIC_ROUTES } from "@/lib/content/routes";
import { siteConfig } from "@/lib/site";

// Regenerated per request so newly published pages/posts show up immediately.
export const dynamic = "force-dynamic";

/**
 * `/llms.txt` — a plain-text site summary for AI crawlers, in the emerging
 * llmstxt.org shape (an H1 for the name, a blockquote summary, then linked
 * sections). Opt-in from Site settings → Discovery; when it's off, and when the
 * site is set to noindex, the route 404s rather than serving a stale summary.
 */
export async function GET(): Promise<Response> {
  const settings = await getSiteSettings();
  if (!settings.llmsTxtEnabled || !settings.seo.indexingEnabled) {
    return new Response("Not found", { status: 404 });
  }

  const lines: string[] = [
    `# ${settings.identity.name}`,
    "",
    `> ${settings.identity.description}`,
    "",
    `${settings.identity.tagline}`,
    "",
    "## Key pages",
    "",
  ];

  for (const route of STATIC_ROUTES) {
    lines.push(
      `- [${route.label}](${siteConfig.url}${route.path === "/" ? "" : route.path})`,
    );
  }

  if (isDbConfigured()) {
    const pages = await getPublishedSitePages();
    if (pages.length > 0) {
      lines.push("", "## Pages", "");
      for (const page of pages) {
        lines.push(`- [${page.slug}](${siteConfig.url}/${page.slug})`);
      }
    }

    try {
      const { posts } = await getPublishedPosts(1, 30);
      if (posts.length > 0) {
        lines.push("", "## Recent articles", "");
        for (const post of posts) {
          const summary = post.excerpt ? `: ${post.excerpt}` : "";
          lines.push(`- [${post.title}](${siteConfig.url}/blog/${post.slug})${summary}`);
        }
      }
    } catch {
      // The blog is a nice-to-have here — a DB hiccup shouldn't 500 the file.
    }
  }

  if (settings.identity.contactEmail) {
    lines.push("", "## Contact", "", `- ${settings.identity.contactEmail}`);
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
