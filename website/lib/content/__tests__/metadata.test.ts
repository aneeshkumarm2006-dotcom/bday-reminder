import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_META, DEFAULT_SETTINGS } from "../defaults";
import { buildPageMetadata, paginatedPageMeta } from "../metadata";

const blog = DEFAULT_PAGE_META["/blog"];

describe("paginatedPageMeta", () => {
  it("leaves page 1 exactly as the admin wrote it", () => {
    expect(paginatedPageMeta(blog, 1)).toBe(blog);
    expect(paginatedPageMeta(blog, 0)).toBe(blog);
  });

  it("self-canonicalises pages 2 and up instead of pointing at page 1", () => {
    expect(paginatedPageMeta(blog, 2, 3).canonical).toBe("/blog?page=2");
    expect(paginatedPageMeta(blog, 3, 3).canonical).toBe("/blog?page=3");

    const built = buildPageMetadata(paginatedPageMeta(blog, 2, 3), DEFAULT_SETTINGS);
    expect(built.alternates?.canonical).toBe("/blog?page=2");
  });

  it("gives every page a distinct title and description", () => {
    const titles = [1, 2, 3].map((n) => paginatedPageMeta(blog, n, 3).title);
    const descriptions = [1, 2, 3].map((n) => paginatedPageMeta(blog, n, 3).description);
    expect(new Set(titles).size).toBe(3);
    expect(new Set(descriptions).size).toBe(3);
    expect(titles[1]).toBe("Blog · Page 2 of 3");
    expect(descriptions[1].startsWith("Page 2 of 3. ")).toBe(true);
  });

  it("drops the total when the caller doesn't know it", () => {
    expect(paginatedPageMeta(blog, 2).title).toBe("Blog · Page 2");
  });

  it("still names the page when the route has no title or description", () => {
    const bare = { ...blog, title: "", description: "" };
    expect(paginatedPageMeta(bare, 2, 4).title).toBe("Page 2 of 4");
    expect(paginatedPageMeta(bare, 2, 4).description).toBe("Page 2 of 4");
  });

  it("points the OG url at the page being viewed", () => {
    const meta = buildPageMetadata(paginatedPageMeta(blog, 2, 3), DEFAULT_SETTINGS);
    expect(meta.openGraph?.url).toBe("/blog?page=2");
    expect(meta.openGraph?.title).toBe("Blog · Page 2 of 3");
  });

  it("keeps an OG title the admin typed by hand", () => {
    const tuned = { ...blog, ogTitle: "The Birthday Reminders blog" };
    const meta = buildPageMetadata(paginatedPageMeta(tuned, 2, 3), DEFAULT_SETTINGS);
    expect(meta.openGraph?.title).toBe("The Birthday Reminders blog");
  });
});
