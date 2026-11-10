import { describe, expect, it } from "vitest";

import { readingTimeMinutes } from "@/lib/blog/reading-time";
import { htmlToPlainText } from "@/lib/blog/seo-meta";
import {
  preferredSourceDeeplink,
  splitOnPreferredSource,
  stripPreferredSourceShortcode,
} from "@/lib/preferred-source";

describe("preferred source", () => {
  it("builds Google's deeplink for a host", () => {
    expect(preferredSourceDeeplink("www.birthdayreminders.us")).toBe(
      "https://www.google.com/preferences/source?q=www.birthdayreminders.us",
    );
  });

  it("leaves a body without the shortcode in one piece", () => {
    expect(splitOnPreferredSource("<p>Hello</p><p>World</p>")).toEqual([
      "<p>Hello</p><p>World</p>",
    ]);
  });

  it("splits on a shortcode paragraph, dropping the paragraph", () => {
    expect(
      splitOnPreferredSource("<p>One</p><p>[preferred-source]</p><p>Two</p>"),
    ).toEqual(["<p>One</p>", "<p>Two</p>"]);
  });

  it("tolerates case, attributes, nbsp padding and a bare token", () => {
    expect(
      splitOnPreferredSource('<p class="x">&nbsp;[Preferred-Source] </p><p>a [preferred-source] b</p>'),
    ).toHaveLength(3);
  });

  it("keeps the shortcode out of descriptions and word counts", () => {
    const body = "<p>Birthday ideas.</p><p>[preferred-source]</p>";
    expect(htmlToPlainText(body)).toBe("Birthday ideas.");
    expect(stripPreferredSourceShortcode("a [preferred-source] b")).not.toContain("[");
    expect(readingTimeMinutes(body)).toBe(1);
  });
});
