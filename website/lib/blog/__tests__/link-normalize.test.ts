import { describe, expect, it } from "vitest";

import { linkifyKeywords } from "@/lib/blog/keyword-links";
import {
  isInternalHref,
  normalizeHref,
  normalizePostLinks,
} from "@/lib/blog/link-normalize";

/**
 * These are the three Semrush findings on the blog, in test form: a link to the
 * dead `circlethedate.app`, links to our own site over plain http, and links to
 * the apex that burn a 308 on the way to the canonical host. Everything else on
 * the page has to come out untouched, which is most of what's checked here.
 */
describe("normalizeHref", () => {
  it("drops our own origin, whatever scheme or host spelling it used", () => {
    expect(normalizeHref("http://birthdayreminders.us/")).toBe("/");
    expect(normalizeHref("https://birthdayreminders.us/")).toBe("/");
    expect(normalizeHref("http://www.birthdayreminders.us/")).toBe("/");
    expect(normalizeHref("https://www.birthdayreminders.us/free")).toBe("/free");
    expect(normalizeHref("http://BirthdayReminders.US/blog")).toBe("/blog");
  });

  it("strips a trailing slash, which would redirect on its own", () => {
    expect(normalizeHref("http://birthdayreminders.us/privacy/")).toBe("/privacy");
    expect(normalizeHref("https://birthdayreminders.us/blog/a-post/")).toBe(
      "/blog/a-post",
    );
  });

  it("keeps the query and the hash exactly", () => {
    expect(normalizeHref("http://birthdayreminders.us/blog/x?a=1&b=2#top")).toBe(
      "/blog/x?a=1&b=2#top",
    );
    expect(normalizeHref("https://birthdayreminders.us/#features")).toBe("/#features");
    expect(normalizeHref("http://www.birthdayreminders.us/?utm_source=post")).toBe(
      "/?utm_source=post",
    );
  });

  it("carries retired-brand links over to the same path when it still exists", () => {
    expect(normalizeHref("https://circlethedate.app/privacy")).toBe("/privacy");
    expect(normalizeHref("http://www.circlethedate.app/terms")).toBe("/terms");
    expect(normalizeHref("https://circlethedate.app/birthday-calendar")).toBe(
      "/birthday-calendar",
    );
    expect(normalizeHref("http://circlethedate.app/blog/some-old-post")).toBe(
      "/blog/some-old-post",
    );
    expect(normalizeHref("http://www.circlethedate.app/#download")).toBe("/#download");
  });

  it("sends the retired brand's origin and its unknown paths to the homepage", () => {
    expect(normalizeHref("https://circlethedate.app")).toBe("/");
    expect(normalizeHref("https://circlethedate.app/")).toBe("/");
    expect(normalizeHref("https://circlethedate.app/pricing")).toBe("/");
    expect(normalizeHref("https://circlethedate.app/blog/deep/nested")).toBe("/");
  });

  it("upgrades our other subdomains rather than making them relative", () => {
    expect(normalizeHref("http://app.birthdayreminders.us/login")).toBe(
      "https://app.birthdayreminders.us/login",
    );
    expect(normalizeHref("https://app.birthdayreminders.us/login")).toBe(
      "https://app.birthdayreminders.us/login",
    );
  });

  it("leaves somebody else's site alone", () => {
    expect(normalizeHref("https://example.com/x?y=1#z")).toBe(
      "https://example.com/x?y=1#z",
    );
    expect(normalizeHref("http://example.com/x")).toBe("http://example.com/x");
    expect(normalizeHref("https://notbirthdayreminders.us/x")).toBe(
      "https://notbirthdayreminders.us/x",
    );
    expect(normalizeHref("https://circlethedate.app.evil.com/x")).toBe(
      "https://circlethedate.app.evil.com/x",
    );
  });

  it("leaves anything that isn't an absolute http(s) URL alone", () => {
    expect(normalizeHref("/blog/x")).toBe("/blog/x");
    expect(normalizeHref("../x")).toBe("../x");
    expect(normalizeHref("#top")).toBe("#top");
    expect(normalizeHref("mailto:hello@birthdayreminders.us")).toBe(
      "mailto:hello@birthdayreminders.us",
    );
    expect(normalizeHref("tel:+15555550123")).toBe("tel:+15555550123");
    expect(normalizeHref("not a url at all")).toBe("not a url at all");
    expect(normalizeHref("")).toBe("");
  });

  it("is idempotent", () => {
    const inputs = [
      "http://birthdayreminders.us/blog/x?a=1#b",
      "https://circlethedate.app/pricing",
      "http://www.circlethedate.app/privacy/",
      "http://app.birthdayreminders.us/login",
      "https://example.com/x",
      "mailto:hello@birthdayreminders.us",
      "/free",
    ];
    for (const input of inputs) {
      const once = normalizeHref(input);
      expect(normalizeHref(once)).toBe(once);
    }
  });
});

describe("normalizePostLinks", () => {
  it("rewrites the href and nothing else about the anchor", () => {
    expect(
      normalizePostLinks(
        '<p>Try <a href="http://birthdayreminders.us/" title="Home">the app</a>.</p>',
      ),
    ).toBe('<p>Try <a href="/" title="Home">the app</a>.</p>');
  });

  it("handles single-quoted and unquoted hrefs", () => {
    expect(normalizePostLinks("<a href='https://circlethedate.app'>old</a>")).toBe(
      '<a href="/">old</a>',
    );
    expect(normalizePostLinks("<a href=http://birthdayreminders.us/free>free</a>")).toBe(
      '<a href="/free">free</a>',
    );
  });

  it("round-trips an escaped query string", () => {
    expect(
      normalizePostLinks(
        '<a href="http://birthdayreminders.us/blog/x?a=1&amp;b=2#top">x</a>',
      ),
    ).toBe('<a href="/blog/x?a=1&amp;b=2#top">x</a>');
  });

  it("leaves external anchors, their rel, and the rest of the body untouched", () => {
    const html =
      '<p>See <a href="https://example.com/a" target="_blank" rel="noopener noreferrer">this</a> and <a href="/free">that</a>.</p>' +
      '<img src="data:image/png;base64,AAA" alt="x"><p>a &amp; b</p>';
    expect(normalizePostLinks(html)).toBe(html);
  });

  it("ignores attributes that merely end in href", () => {
    const html = '<a data-href="http://birthdayreminders.us/" name="x">no href</a>';
    expect(normalizePostLinks(html)).toBe(html);
  });

  it("rewrites every anchor in the body", () => {
    expect(
      normalizePostLinks(
        '<a href="http://birthdayreminders.us/">a</a><a href="https://circlethedate.app/terms">b</a><a href="https://example.com">c</a>',
      ),
    ).toBe(
      '<a href="/">a</a><a href="/terms">b</a><a href="https://example.com">c</a>',
    );
  });

  it("is idempotent", () => {
    const html =
      '<p><a href="http://birthdayreminders.us/blog/x?a=1&amp;b=2">one</a> ' +
      '<a href="https://circlethedate.app/pricing">two</a></p>';
    const once = normalizePostLinks(html);
    expect(normalizePostLinks(once)).toBe(once);
  });

  it("passes an empty body straight through", () => {
    expect(normalizePostLinks("")).toBe("");
  });
});

describe("keyword backlinks", () => {
  it("normalizes the admin-entered destination and keeps our own links in-tab", () => {
    expect(
      linkifyKeywords("<p>a birthday calendar helps</p>", [
        {
          keyword: "birthday calendar",
          url: "http://birthdayreminders.us/birthday-calendar",
          rel: "dofollow",
        },
      ]),
    ).toBe('<p>a <a href="/birthday-calendar">birthday calendar</a> helps</p>');
  });

  it("still opens somebody else's site in a new tab", () => {
    expect(
      linkifyKeywords("<p>see the docs</p>", [
        { keyword: "docs", url: "https://example.com/docs", rel: "nofollow" },
      ]),
    ).toBe(
      '<p>see the <a href="https://example.com/docs" target="_blank" rel="noopener nofollow">docs</a></p>',
    );
  });
});

describe("isInternalHref", () => {
  it("recognises the root-relative hrefs the normalizer emits", () => {
    expect(isInternalHref("/free")).toBe(true);
    expect(isInternalHref("/")).toBe(true);
    expect(isInternalHref("https://example.com")).toBe(false);
    expect(isInternalHref("//example.com/x")).toBe(false);
  });
});
