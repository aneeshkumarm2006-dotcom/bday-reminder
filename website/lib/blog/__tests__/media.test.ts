import { describe, expect, it } from "vitest";

import { formatBytes } from "@/lib/blog/format";
import {
  cloudinaryPublicId,
  cloudinaryThumb,
  filenameFromPublicId,
  imageMarkdown,
  imageTag,
} from "@/lib/blog/image-url";
import { buildUsageMap } from "@/lib/blog/images";
import {
  displayAlt,
  distinctPosts,
  filterRows,
  sortRows,
} from "@/components/seoteam/media/lib";
import type { BlogImage, ImageUsage, MediaRow, Post } from "@/lib/blog/types";

const CAT = "https://res.cloudinary.com/demo/image/upload/v1/circlethedate-blog/cat.jpg";
const DOG = "https://res.cloudinary.com/demo/image/upload/circlethedate-blog/dog.png";

function makePost(p: Partial<Post>): Post {
  return {
    id: "p",
    title: "Post",
    slug: "post",
    template: "generic",
    body: "",
    excerpt: "",
    metaTitle: "",
    coverImage: "",
    coverImageAlt: "",
    keywords: [],
    linkOccurrences: "first",
    status: "published",
    author: "",
    views: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: null,
    ...p,
  };
}

function makeImage(p: Partial<BlogImage>): BlogImage {
  return {
    id: "i",
    publicId: "circlethedate-blog/x",
    secureUrl: CAT,
    format: "jpg",
    width: 100,
    height: 100,
    bytes: 1000,
    tags: [],
    cloudinaryCreatedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

function makeRow(image: Partial<BlogImage>, usedInPosts: ImageUsage[] = []): MediaRow {
  return {
    image: makeImage(image),
    usedInPosts,
    missingAlt: usedInPosts.length > 0 && usedInPosts.some((u) => u.alt === ""),
    unused: usedInPosts.length === 0,
  };
}

describe("cloudinaryPublicId", () => {
  it("extracts folder/name, stripping version + extension", () => {
    expect(cloudinaryPublicId(CAT)).toBe("circlethedate-blog/cat");
    expect(cloudinaryPublicId(DOG)).toBe("circlethedate-blog/dog");
  });

  it("returns null for non-Cloudinary URLs and data URIs", () => {
    expect(cloudinaryPublicId("data:image/png;base64,abc")).toBeNull();
    expect(cloudinaryPublicId("https://example.com/a.jpg")).toBeNull();
    expect(cloudinaryPublicId("")).toBeNull();
  });
});

describe("cloudinaryThumb", () => {
  it("injects a fill transform after /image/upload/", () => {
    expect(cloudinaryThumb(CAT, 96)).toContain("/image/upload/c_fill,g_auto,w_96,h_96,f_auto,q_auto/");
  });

  it("passes non-Cloudinary URLs through unchanged", () => {
    expect(cloudinaryThumb("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });
});

describe("filename + snippets", () => {
  it("derives the filename from a public id", () => {
    expect(filenameFromPublicId("circlethedate-blog/cat")).toBe("cat");
  });
  it("builds markdown and img snippets", () => {
    expect(imageMarkdown("A cat", CAT)).toBe(`![A cat](${CAT})`);
    expect(imageTag("A cat", CAT)).toBe(`<img src="${CAT}" alt="A cat" />`);
  });
});

describe("formatBytes", () => {
  it("formats sizes and shows — for 0/unknown", () => {
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });
});

describe("buildUsageMap", () => {
  const posts = [
    makePost({ id: "a", slug: "a", title: "A", coverImage: CAT, coverImageAlt: "A cat" }),
    makePost({ id: "b", slug: "b", title: "B", body: `<p>x</p><img src="${CAT}" alt="">` }),
    makePost({ id: "c", slug: "c", title: "C", body: `<img src="${DOG}" alt="A dog">` }),
  ];
  const map = buildUsageMap(posts);

  it("maps a cover image usage with its alt", () => {
    const cat = map.get("circlethedate-blog/cat")!;
    expect(cat).toHaveLength(2); // cover in A + inline in B
    const cover = cat.find((u) => u.field === "cover")!;
    expect(cover.postId).toBe("a");
    expect(cover.alt).toBe("A cat");
  });

  it("captures an inline image missing its alt (the SEO gap)", () => {
    const cat = map.get("circlethedate-blog/cat")!;
    const inline = cat.find((u) => u.field === "body")!;
    expect(inline.postId).toBe("b");
    expect(inline.alt).toBe(""); // flagged as missing downstream
  });

  it("maps a second image used once", () => {
    expect(map.get("circlethedate-blog/dog")).toHaveLength(1);
    expect(map.get("circlethedate-blog/dog")![0].alt).toBe("A dog");
  });
});

describe("filterRows", () => {
  const unused = makeRow({ id: "u", publicId: "circlethedate-blog/unused" }, []);
  const ok = makeRow({ id: "o", publicId: "circlethedate-blog/ok", tags: ["hero"] }, [
    { postId: "a", slug: "a", title: "Alpha", field: "cover", alt: "ok alt" },
  ]);
  const missing = makeRow({ id: "m", publicId: "circlethedate-blog/missing" }, [
    { postId: "b", slug: "b", title: "Beta", field: "body", alt: "" },
  ]);
  const rows = [unused, ok, missing];

  it("filters by usage status", () => {
    expect(filterRows(rows, "", "unused").map((r) => r.image.id)).toEqual(["u"]);
    expect(filterRows(rows, "", "used").map((r) => r.image.id)).toEqual(["o", "m"]);
    expect(filterRows(rows, "", "missing-alt").map((r) => r.image.id)).toEqual(["m"]);
    expect(filterRows(rows, "", "all")).toHaveLength(3);
  });

  it("searches filename, tags, and post titles", () => {
    expect(filterRows(rows, "hero", "all").map((r) => r.image.id)).toEqual(["o"]);
    expect(filterRows(rows, "alpha", "all").map((r) => r.image.id)).toEqual(["o"]);
    expect(filterRows(rows, "unused", "all").map((r) => r.image.id)).toEqual(["u"]);
  });
});

describe("sortRows", () => {
  const small = makeRow({ id: "s", publicId: "circlethedate-blog/b_small", bytes: 100 });
  const big = makeRow({ id: "g", publicId: "circlethedate-blog/a_big", bytes: 9000 });
  const rows = [small, big];

  it("sorts by size ascending and descending", () => {
    expect(sortRows(rows, "size", "asc").map((r) => r.image.id)).toEqual(["s", "g"]);
    expect(sortRows(rows, "size", "desc").map((r) => r.image.id)).toEqual(["g", "s"]);
  });

  it("sorts by filename", () => {
    expect(sortRows(rows, "filename", "asc").map((r) => r.image.id)).toEqual(["g", "s"]);
  });

  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.image.id);
    sortRows(rows, "size", "desc");
    expect(rows.map((r) => r.image.id)).toEqual(before);
  });
});

describe("displayAlt + distinctPosts", () => {
  const row = makeRow({ id: "d" }, [
    { postId: "a", slug: "a", title: "A", field: "cover", alt: "" },
    { postId: "a", slug: "a", title: "A", field: "body", alt: "real alt" },
    { postId: "b", slug: "b", title: "B", field: "body", alt: "real alt" },
  ]);

  it("returns the first non-empty alt", () => {
    expect(displayAlt(row)).toBe("real alt");
  });

  it("collapses multiple usages of the same post", () => {
    expect(distinctPosts(row).map((p) => p.postId)).toEqual(["a", "b"]);
  });
});
