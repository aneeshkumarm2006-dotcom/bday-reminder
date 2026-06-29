/**
 * Pure slug helper (no DB). Uniqueness is enforced separately in lib/blog/posts.ts
 * because that needs a database lookup.
 */
export function slugify(input: string): string {
  const slug = (input || "")
    .toLowerCase()
    .trim()
    .normalize("NFKD") // decompose accents so the next step drops the marks
    .replace(/[^a-z0-9\s-]/g, "") // drop anything not alphanumeric/space/hyphen
    .replace(/[\s_]+/g, "-") // spaces/underscores → hyphen
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-+|-+$/g, "") // trim hyphens
    .slice(0, 80)
    .replace(/-+$/g, ""); // re-trim after slice
  return slug || "post";
}
