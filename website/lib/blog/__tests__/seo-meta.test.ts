import { describe, expect, it } from "vitest";

import {
  DEFAULT_TITLE_TEMPLATE,
  TITLE_BUDGET,
  buildPostTitle,
  htmlToPlainText,
  postDescription,
  rotateRelated,
} from "../seo-meta";

/**
 * These guard a live Semrush finding: every /blog/<slug> page shipped a ~100
 * character title and, for the posts with an empty excerpt, no meta description
 * at all. The invariants below are the ones the audit actually measures — length,
 * presence, and that what we emit still reads like something a person wrote.
 */

/** The rendered `<title>`, i.e. with the sitewide template applied when it applies. */
function rendered(value: string | { absolute: string }): string {
  return typeof value === "string"
    ? DEFAULT_TITLE_TEMPLATE.replace("%s", value)
    : value.absolute;
}

describe("buildPostTitle", () => {
  it("keeps the brand suffix when the whole thing fits", () => {
    const value = buildPostTitle({ title: "How to Never Forget a Birthday Again" });
    expect(value).toBe("How to Never Forget a Birthday Again");
    expect(rendered(value)).toBe(
      "How to Never Forget a Birthday Again · Birthday Reminders",
    );
    expect(rendered(value).length).toBeLessThanOrEqual(TITLE_BUDGET);
  });

  it("prefers an author's metaTitle over the post title", () => {
    expect(buildPostTitle({ title: "Some post", metaTitle: "Hand-written title" })).toBe(
      "Hand-written title",
    );
  });

  it("cuts at the colon when the full headline blows the budget", () => {
    const value = buildPostTitle({
      title:
        "50th Birthday Party Ideas: Creative Ways to Celebrate a Milestone Birthday",
    });
    expect(value).toBe("50th Birthday Party Ideas");
    expect(rendered(value)).toBe("50th Birthday Party Ideas · Birthday Reminders");
  });

  it("cuts at an em dash clause too", () => {
    const value = buildPostTitle({
      title:
        "Anniversary Gift Ideas by Year — Everything From Paper to Diamond and Back",
    });
    expect(value).toBe("Anniversary Gift Ideas by Year");
  });

  it("drops the brand rather than the headline when only the bare title fits", () => {
    const title = "Birthday Gift Ideas for the Person Who Has Everything";
    expect(title.length).toBeGreaterThan(TITLE_BUDGET - " · Birthday Reminders".length);
    expect(buildPostTitle({ title })).toEqual({ absolute: title });
  });

  it("truncates at a word boundary when there is no clause to cut at", () => {
    const value = buildPostTitle({
      title:
        "The Complete Guide To Remembering Every Single Birthday In Your Extended Family",
    });
    const text = rendered(value);
    expect(text.length).toBeLessThanOrEqual(TITLE_BUDGET);
    expect(text.endsWith("…")).toBe(true);
    // Never mid-word and never a dangling separator before the ellipsis.
    expect(text).toBe("The Complete Guide To Remembering Every Single Birthday In…");
  });

  it("ignores a clause boundary that would leave a fragment", () => {
    const value = buildPostTitle({
      title: "Ideas: Fifty Ways To Mark A Milestone Birthday Without Spending Much",
    });
    expect(rendered(value)).toBe("Ideas: Fifty Ways To Mark A Milestone Birthday Without…");
  });

  it("honours an admin-changed title template", () => {
    const titleTemplate = "%s | A Very Long Site Name Indeed";
    const value = buildPostTitle({ title: "How to Never Forget a Birthday Again" }, {
      titleTemplate,
    });
    expect(value).toEqual({ absolute: "How to Never Forget a Birthday Again" });
  });

  it("goes absolute when the template has no %s placeholder", () => {
    expect(buildPostTitle({ title: "Short one" }, { titleTemplate: "Fixed" })).toEqual({
      absolute: "Short one",
    });
  });

  it("never emits an empty title", () => {
    expect(buildPostTitle({ title: "" })).toEqual({ absolute: "Birthday Reminders" });
  });
});

describe("postDescription", () => {
  it("uses the excerpt when there is one", () => {
    expect(
      postDescription({ excerpt: "  A hand-written  summary. ", body: "<p>x</p>" }),
    ).toBe("A hand-written summary.");
  });

  it("falls back to the body when the excerpt is empty", () => {
    const description = postDescription({
      excerpt: "",
      title: "50th Anniversary Color Ideas",
      body: "<p>Gold is the traditional colour for a fiftieth. It photographs beautifully against almost anything.</p>",
    });
    expect(description).toBe(
      "Gold is the traditional colour for a fiftieth. It photographs beautifully against almost anything.",
    );
  });

  it("skips a leading heading that just repeats the title", () => {
    const description = postDescription({
      excerpt: "",
      title: "50th Anniversary Color Ideas",
      body: "<h1>50th Anniversary Color Ideas</h1><p>Gold is the obvious one, and it earns it.</p>",
    });
    expect(description).toBe("Gold is the obvious one, and it earns it.");
  });

  it("decodes HTML entities and collapses whitespace", () => {
    expect(
      postDescription({
        excerpt: "",
        body: "<p>Mum &amp; Dad&#x27;s&nbsp;anniversary\n  is in May.</p>",
      }),
    ).toBe("Mum & Dad's anniversary is in May.");
  });

  it("stops on a sentence boundary inside the budget, with no ellipsis", () => {
    const body =
      "<p>Write the date down the moment you hear it. Waiting until later is how birthdays get lost, because later never arrives and the calendar stays empty until the day itself.</p>";
    const description = postDescription({ excerpt: "", body });
    expect(description).toBe("Write the date down the moment you hear it.");
  });

  it("cuts a runaway first sentence at a word boundary", () => {
    const body = `<p>${"birthday ".repeat(40)}party</p>`;
    const description = postDescription({ excerpt: "", body });
    expect(description.length).toBeLessThanOrEqual(155);
    expect(description.endsWith("…")).toBe(true);
    expect(description.endsWith("birthday…")).toBe(true);
  });

  it("returns an empty string when there is nothing usable", () => {
    expect(postDescription({ excerpt: "", body: "" })).toBe("");
    expect(postDescription({})).toBe("");
    expect(
      postDescription({ excerpt: "", title: "Only a title", body: "<h1>Only a title</h1>" }),
    ).toBe("");
  });
});

describe("htmlToPlainText", () => {
  it("separates blocks but not inline runs", () => {
    expect(
      htmlToPlainText("<h2>Cakes</h2><p>The <strong>best</strong> one wins.</p>"),
    ).toBe("Cakes The best one wins.");
  });
});

describe("rotateRelated", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("takes the next N and wraps around the end", () => {
    expect(rotateRelated(items, 0, 3)).toEqual(["b", "c", "d"]);
    expect(rotateRelated(items, 4, 3)).toEqual(["a", "b", "c"]);
    expect(rotateRelated(items, 3, 3)).toEqual(["e", "a", "b"]);
  });

  it("gives every item the same number of incoming links", () => {
    const incoming = new Map(items.map((item) => [item, 0]));
    items.forEach((_, index) => {
      for (const target of rotateRelated(items, index, 3)) {
        incoming.set(target, (incoming.get(target) ?? 0) + 1);
      }
    });
    expect([...incoming.values()]).toEqual([3, 3, 3, 3, 3]);
  });

  it("never includes the current item", () => {
    items.forEach((item, index) => {
      expect(rotateRelated(items, index, 4)).not.toContain(item);
    });
  });

  it("degrades safely on tiny lists and a missing index", () => {
    expect(rotateRelated(["a"], 0, 3)).toEqual([]);
    expect(rotateRelated(items, -1, 3)).toEqual([]);
    expect(rotateRelated(items, 0, 0)).toEqual([]);
    expect(rotateRelated(["a", "b"], 0, 3)).toEqual(["b"]);
  });
});
