import { describe, expect, it } from "vitest";

import { blockedEmbedHosts, sanitizeEmbedHtml } from "../sanitize-embed";
import { resolveVideo } from "../embed";

/**
 * The HTML block is the one place an admin writes markup by hand, so its
 * sanitizer is the site's only real XSS boundary. These tests are the contract:
 * layout markup survives, anything executable does not.
 */
describe("sanitizeEmbedHtml", () => {
  it("keeps layout markup, tables, classes and inline styles", () => {
    const html = sanitizeEmbedHtml(
      '<div class="grid" style="display:flex;gap:12px"><table><tr><td>A</td></tr></table></div>',
    );
    expect(html).toContain('class="grid"');
    expect(html).toContain("display:flex");
    expect(html).toContain("<td>A</td>");
  });

  it("drops script tags and their contents", () => {
    const html = sanitizeEmbedHtml('<p>Hi</p><script>alert("x")</script>');
    expect(html).toContain("<p>Hi</p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
  });

  it("drops event handler attributes", () => {
    const html = sanitizeEmbedHtml('<button onclick="steal()">Go</button>');
    expect(html).not.toContain("onclick");
  });

  it("drops javascript: hrefs", () => {
    const html = sanitizeEmbedHtml('<a href="javascript:alert(1)">x</a>');
    expect(html).not.toContain("javascript:");
  });

  it("drops a style value that tries to smuggle a script", () => {
    const html = sanitizeEmbedHtml(
      "<div style=\"background:url(javascript:alert(1))\">x</div>",
    );
    expect(html).not.toContain("javascript:");
  });

  it("keeps an iframe from an allowed host and adds lazy loading", () => {
    const html = sanitizeEmbedHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>',
    );
    expect(html).toContain("youtube-nocookie.com/embed/abc123");
    expect(html).toContain('loading="lazy"');
  });

  it("drops an iframe from any other host", () => {
    const html = sanitizeEmbedHtml('<iframe src="https://evil.example/embed"></iframe>');
    expect(html).not.toContain("evil.example");
  });

  it("names the hosts an editor's iframes will be stripped for", () => {
    expect(
      blockedEmbedHosts('<iframe src="https://evil.example/x"></iframe>'),
    ).toEqual(["evil.example"]);
    expect(
      blockedEmbedHosts('<iframe src="https://player.vimeo.com/video/1"></iframe>'),
    ).toEqual([]);
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeEmbedHtml("")).toBe("");
  });
});

describe("resolveVideo", () => {
  it("resolves a YouTube watch URL to a no-cookie embed", () => {
    expect(resolveVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      title: "YouTube video player",
    });
  });

  it("resolves a youtu.be short link, keeping a start time", () => {
    const video = resolveVideo("https://youtu.be/dQw4w9WgXcQ?t=42");
    expect(video).toEqual({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42",
      title: "YouTube video player",
    });
  });

  it("resolves a Shorts URL", () => {
    expect(resolveVideo("https://www.youtube.com/shorts/abc12345")).toMatchObject({
      src: "https://www.youtube-nocookie.com/embed/abc12345",
    });
  });

  it("resolves a Vimeo page URL to its player", () => {
    expect(resolveVideo("https://vimeo.com/123456789")).toEqual({
      kind: "iframe",
      src: "https://player.vimeo.com/video/123456789",
      title: "Vimeo video player",
    });
  });

  it("treats a media file as a file, not an embed", () => {
    expect(resolveVideo("/media/demo.mp4")).toEqual({ kind: "file", src: "/media/demo.mp4" });
  });

  it("refuses anything it doesn't recognise", () => {
    expect(resolveVideo("https://evil.example/watch?v=1")).toBeNull();
    expect(resolveVideo("javascript:alert(1)")).toBeNull();
    expect(resolveVideo("")).toBeNull();
  });
});
