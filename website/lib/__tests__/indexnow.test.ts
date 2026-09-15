import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IndexNow submits URLs on our behalf, so the things worth pinning are the ones
 * that would be embarrassing rather than merely wrong: a preview deploy
 * announcing itself as production, an authenticated `/settings` URL handed to
 * Bing, or a save that 500s because a search engine was unreachable.
 *
 * Everything below drives `submitIndexNow` — the awaitable core — because
 * `pingIndexNow` is that function plus `after()`, and `after()` is Next's.
 */

const settings = { seo: { indexingEnabled: true } };
let dbConfigured = false;
let pageMetaDocs: { path: string; noindex?: boolean; sitemap?: { exclude?: boolean } }[] = [];

vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

vi.mock("@/lib/blog/db", () => ({
  isDbConfigured: () => dbConfigured,
  connectDb: async () => undefined,
}));

vi.mock("@/lib/content/get", () => ({
  readSiteSettings: async () => settings,
}));

vi.mock("@/lib/content/models", () => ({
  PageMetaModel: {
    find: () => ({ select: () => ({ lean: async () => pageMetaDocs }) }),
  },
}));

const { submitIndexNow, __internal } = await import("../indexnow");

const ORIGIN = "https://birthdayreminders.us";

/** The JSON body of the nth (default: only) submission. */
function payload(fetchMock: ReturnType<typeof vi.fn>, n = 0) {
  return JSON.parse(fetchMock.mock.calls[n][1].body as string);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.INDEXNOW_KEY = "abc123key";
  process.env.VERCEL_ENV = "production";
  settings.seo.indexingEnabled = true;
  dbConfigured = false;
  pageMetaDocs = [];
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  delete process.env.INDEXNOW_KEY;
  delete process.env.VERCEL_ENV;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the guards", () => {
  it("does nothing without a key", async () => {
    delete process.env.INDEXNOW_KEY;
    const result = await submitIndexNow("/blog/hello");
    expect(result).toEqual({ submitted: 0, ok: false, skipped: "no-key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing from dev or a preview deploy", async () => {
    for (const env of [undefined, "development", "preview"]) {
      if (env === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = env;
      const result = await submitIndexNow("/blog/hello");
      expect(result.skipped).toBe("not-production");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits from outside production only when explicitly allowed", async () => {
    delete process.env.VERCEL_ENV;
    const result = await submitIndexNow("/blog/hello", { allowNonProduction: true });
    expect(result.submitted).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("submits nothing while the site is marked unindexable, even with force", async () => {
    settings.seo.indexingEnabled = false;
    const result = await submitIndexNow("/blog/hello", { force: true });
    expect(result.skipped).toBe("indexing-disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the payload", () => {
  it("sends host, key, keyLocation and absolute URLs", async () => {
    await submitIndexNow(["/blog/hello", "/birthday-calendar"]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.indexnow.org/indexnow");
    expect(payload(fetchMock)).toEqual({
      host: "birthdayreminders.us",
      key: "abc123key",
      keyLocation: `${ORIGIN}/abc123key.txt`,
      urlList: [`${ORIGIN}/blog/hello`, `${ORIGIN}/birthday-calendar`],
    });
  });

  it("emits the homepage exactly as the sitemap does — no trailing slash", async () => {
    await submitIndexNow("/");
    expect(payload(fetchMock).urlList).toEqual([ORIGIN]);
  });

  it("accepts absolute URLs and paths interchangeably, and dedupes them", async () => {
    await submitIndexNow(["/blog/hello", `${ORIGIN}/blog/hello`, "/blog/hello/"]);
    expect(payload(fetchMock).urlList).toEqual([`${ORIGIN}/blog/hello`]);
  });

  it("chunks at the protocol's 10,000-URL ceiling", async () => {
    const urls = Array.from({ length: 10_001 }, (_, i) => `/blog/post-${i}`);
    const result = await submitIndexNow(urls);

    expect(result.submitted).toBe(10_001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload(fetchMock, 0).urlList).toHaveLength(__internal.MAX_URLS_PER_REQUEST);
    expect(payload(fetchMock, 1).urlList).toHaveLength(1);
  });
});

describe("what never gets submitted", () => {
  it("drops the authenticated app routes", async () => {
    const result = await submitIndexNow([
      "/settings",
      "/people/123",
      "/dashboard",
      "/lists/abc/catch-up",
      "/seoteam/posts",
      "/analyticshub",
      "/api/anything",
      "/login",
    ]);
    expect(result.skipped).toBe("no-urls");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops generated files and another site's URLs", async () => {
    const result = await submitIndexNow([
      "/sitemap.xml",
      "/robots.txt",
      "/llms.txt",
      "https://evil.example/blog/hello",
      "not a url at all",
      "",
    ]);
    expect(result.skipped).toBe("no-urls");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a page the sitemap excludes, unless forced", async () => {
    dbConfigured = true;
    pageMetaDocs = [
      { path: "/hidden", noindex: true },
      { path: "/internal", sitemap: { exclude: true } },
    ];

    await submitIndexNow(["/hidden", "/internal", "/blog/hello"]);
    expect(payload(fetchMock).urlList).toEqual([`${ORIGIN}/blog/hello`]);

    // …but a page that *just became* noindex still needs re-reading, which is
    // the whole reason `force` exists.
    fetchMock.mockClear();
    await submitIndexNow(["/hidden"], { force: true });
    expect(payload(fetchMock).urlList).toEqual([`${ORIGIN}/hidden`]);
  });
});

describe("failure is never the caller's problem", () => {
  it("resolves when the network throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(submitIndexNow("/blog/hello")).resolves.toEqual({
      submitted: 0,
      ok: false,
    });
  });

  it("reports a rejected key rather than throwing", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const result = await submitIndexNow("/blog/hello");
    expect(result.ok).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("treats 202 as success — the key is pending validation, not wrong", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    await expect(submitIndexNow("/blog/hello")).resolves.toMatchObject({ ok: true });
  });

  it("submits anyway when the exclusion lookup fails", async () => {
    dbConfigured = true;
    pageMetaDocs = [];
    vi.doMock("@/lib/content/models", () => ({
      PageMetaModel: {
        find: () => {
          throw new Error("no primary");
        },
      },
    }));
    await submitIndexNow("/blog/hello");
    expect(payload(fetchMock).urlList).toEqual([`${ORIGIN}/blog/hello`]);
  });
});

describe("toAbsoluteUrl", () => {
  it("normalizes the shapes callers actually pass", () => {
    const { toAbsoluteUrl } = __internal;
    expect(toAbsoluteUrl("blog/hello")).toBe(`${ORIGIN}/blog/hello`);
    expect(toAbsoluteUrl("  /blog/hello  ")).toBe(`${ORIGIN}/blog/hello`);
    expect(toAbsoluteUrl("/blog/hello?utm=x#top")).toBe(`${ORIGIN}/blog/hello`);
    expect(toAbsoluteUrl("/")).toBe(ORIGIN);
    expect(toAbsoluteUrl("ftp://birthdayreminders.us/x")).toBeNull();
  });
});
