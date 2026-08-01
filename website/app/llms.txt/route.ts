import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedPosts } from "@/lib/blog/posts";
import { buildPostDescription } from "@/lib/blog/seo-meta";
import { getPublishedSitePages, getSiteSettings } from "@/lib/content/get";
import { STATIC_ROUTES } from "@/lib/content/routes";
import { siteConfig } from "@/lib/site";

// Regenerated per request so newly published pages/posts show up immediately.
export const dynamic = "force-dynamic";

/**
 * `/llms.txt` — a plain-text site summary for AI crawlers, in the emerging
 * llmstxt.org shape (an H1 for the name, a blockquote summary, then linked
 * sections). On by default and switchable from Site settings → Discovery; when
 * it's off, and when the site is set to noindex, the route 404s rather than
 * serving a summary of pages that aren't meant to be found.
 */
export async function GET(): Promise<Response> {
  const settings = await getSiteSettings();
  if (!settings.llmsTxtEnabled || !settings.seo.indexingEnabled) {
    return new Response("Not found", { status: 404 });
  }

  // llmstxt.org's shape, in order: the H1, one blockquote summary, free prose
  // with no headings in it, then H2 sections that hold nothing but link lists.
  const lines: string[] = [
    `# ${settings.identity.name}`,
    "",
    `> ${settings.identity.description}`,
  ];
  if (settings.identity.tagline.trim()) {
    lines.push("", settings.identity.tagline.trim());
  }
  lines.push("", "## Key pages", "");

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
          // The same derived summary the post's own meta description uses, so
          // the ~20 posts that never got an excerpt still describe themselves
          // here. It comes back collapsed to one line, which the list needs.
          const summary = buildPostDescription(post);
          lines.push(
            `- [${post.title}](${siteConfig.url}/blog/${post.slug})${summary ? `: ${summary}` : ""}`,
          );
        }
      }
    } catch {
      // The blog is a nice-to-have here — a DB hiccup shouldn't 500 the file.
    }
  }

  if (settings.identity.contactEmail) {
    // Every item in an llms.txt section has to be a link, so the address goes in
    // as a mailto: rather than as bare text.
    lines.push(
      "",
      "## Contact",
      "",
      `- [${settings.identity.contactEmail}](mailto:${settings.identity.contactEmail})`,
    );
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
