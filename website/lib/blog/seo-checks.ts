import { parse } from "node-html-parser";

import { siteConfig } from "@/lib/site";

import type { Keyword, SeoAnalysis, SeoCheck, SeoCheckStatus } from "./types";

export interface SeoCheckInput {
  /** The effective meta title (falls back to the post title). */
  metaTitle: string;
  /** The excerpt, which doubles as the meta description. */
  excerpt: string;
  /** Post body HTML. */
  body: string;
  keywords: Keyword[];
  coverImage: string;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function wordBoundaryRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

/**
 * On-page SEO analysis with no external APIs. Isomorphic — the editor runs it
 * live as the team types, and the dashboard runs the same logic so a post's
 * "SEO-ready" verdict is identical in both places.
 */
export function analyzeSeo(input: SeoCheckInput): SeoAnalysis {
  const checks: SeoCheck[] = [];

  // --- Parse the body once ---
  let text = "";
  let links: string[] = [];
  let imagesMissingAlt = 0;
  let imageCount = 0;
  try {
    const root = parse(input.body || "");
    text = root.text || "";
    links = root
      .querySelectorAll("a")
      .map((a) => a.getAttribute("href") || "")
      .filter(Boolean);
    const imgs = root.querySelectorAll("img");
    imageCount = imgs.length;
    imagesMissingAlt = imgs.filter(
      (img) => !(img.getAttribute("alt") || "").trim(),
    ).length;
  } catch {
    text = input.body || "";
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // --- Meta title length (ideal 50–60) ---
  const titleLen = input.metaTitle.trim().length;
  checks.push({
    id: "meta-title-length",
    label: "Meta title length",
    status: titleLen >= 50 && titleLen <= 60
      ? "pass"
      : titleLen >= 40 && titleLen <= 65
        ? "warn"
        : "fail",
    detail:
      titleLen === 0
        ? "Add a meta title (aim for 50–60 characters)."
        : `${titleLen} characters (aim for 50–60).`,
  });

  // --- Meta description / excerpt length (ideal 150–160) ---
  const descLen = input.excerpt.trim().length;
  checks.push({
    id: "meta-description-length",
    label: "Meta description length",
    status: descLen >= 150 && descLen <= 160
      ? "pass"
      : descLen >= 120 && descLen <= 170
        ? "warn"
        : "fail",
    detail:
      descLen === 0
        ? "Add a meta description / excerpt (aim for 150–160 characters)."
        : `${descLen} characters (aim for 150–160).`,
  });

  // --- Word count (thin content warning) ---
  checks.push({
    id: "word-count",
    label: "Content length",
    status: wordCount >= 600 ? "pass" : wordCount >= 300 ? "warn" : "fail",
    detail:
      wordCount >= 600
        ? `${wordCount} words.`
        : `${wordCount} words — thin content. Aim for 600+ words.`,
  });

  // --- Each keyword appears in the body ---
  const realKeywords = input.keywords.filter((k) => k.keyword.trim());
  if (realKeywords.length === 0) {
    checks.push({
      id: "keywords-present",
      label: "Keyword backlinks",
      status: "warn",
      detail: "No keyword backlinks added yet.",
    });
  } else {
    const missing = realKeywords.filter(
      (k) => !wordBoundaryRegex(k.keyword.trim()).test(text),
    );
    checks.push({
      id: "keywords-present",
      label: "Keywords appear in body",
      status: missing.length === 0 ? "pass" : "fail",
      detail:
        missing.length === 0
          ? `All ${realKeywords.length} keyword(s) appear in the body.`
          : `Not found in body: ${missing.map((m) => `“${m.keyword.trim()}”`).join(", ")}.`,
    });
  }

  // --- Internal vs external links ---
  const siteHost = hostOf(siteConfig.url);
  let internal = 0;
  let external = 0;
  for (const href of links) {
    if (/^(mailto:|tel:)/i.test(href)) continue;
    if (href.startsWith("/") || href.startsWith("#")) {
      internal++;
      continue;
    }
    const h = hostOf(href);
    if (h && siteHost && h === siteHost) internal++;
    else if (h) external++;
    else internal++; // relative/anchor-ish
  }
  checks.push({
    id: "links",
    label: "Links",
    status: internal + external === 0 ? "warn" : "pass",
    detail:
      internal + external === 0
        ? "No links yet — add internal and external links."
        : `${internal} internal, ${external} external.`,
  });

  // --- Images missing alt text ---
  checks.push({
    id: "image-alt",
    label: "Image alt text",
    status: imageCount === 0 ? "pass" : imagesMissingAlt === 0 ? "pass" : "warn",
    detail:
      imageCount === 0
        ? "No inline images."
        : imagesMissingAlt === 0
          ? `All ${imageCount} image(s) have alt text.`
          : `${imagesMissingAlt} of ${imageCount} image(s) missing alt text.`,
  });

  // --- Cover image set ---
  checks.push({
    id: "cover-image",
    label: "Cover image",
    status: input.coverImage.trim() ? "pass" : "warn",
    detail: input.coverImage.trim() ? "Cover image set." : "No cover image set.",
  });

  const counts = checks.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<SeoCheckStatus, number>,
  );

  return { checks, counts, ready: counts.fail === 0 };
}
