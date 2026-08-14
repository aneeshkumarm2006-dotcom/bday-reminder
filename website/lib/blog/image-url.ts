/**
 * Pure, isomorphic image-URL helpers — no Node or DB imports, so they're safe to
 * import from client components (unlike cloudinary.ts, which uses node:crypto).
 * Cloudinary uploads here apply no transformations, so a stored delivery URL is
 * `…/image/upload/[vNNN/]folder/name.ext`.
 */

/**
 * Pull the `folder/name` public id out of a Cloudinary delivery URL, or return
 * null for anything that isn't one (the data-URI fallback, a foreign host).
 */
export function cloudinaryPublicId(url: string): string | null {
  if (!/^https?:\/\/res\.cloudinary\.com\//.test(url)) return null;
  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url
    .slice(idx + marker.length)
    .replace(/^v\d+\//, "") // drop the version segment
    .replace(/\.[a-zA-Z0-9]+$/, ""); // drop the file extension
  return rest || null;
}

/**
 * Build a CDN-optimized URL cropped to exact pixel dimensions by injecting a
 * transform after `/image/upload/`. Returns the input unchanged for
 * non-Cloudinary URLs (data URIs, foreign hosts), so `<img src>` always has
 * something valid.
 *
 * The exactness matters beyond layout: because `c_fill` guarantees the delivered
 * image *is* `w`×`h`, structured data can state those dimensions as fact rather
 * than guessing at whatever was uploaded.
 */
export function cloudinaryFill(url: string, width: number, height: number): string {
  if (!/^https?:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const head = url.slice(0, idx + marker.length);
  const tail = url.slice(idx + marker.length);
  return `${head}c_fill,g_auto,w_${width},h_${height},f_auto,q_auto/${tail}`;
}

/**
 * Build a small, CDN-optimized square thumbnail URL. Returns the input
 * unchanged for non-Cloudinary URLs.
 */
export function cloudinaryThumb(url: string, size = 96): string {
  return cloudinaryFill(url, size, size);
}

/** The last path segment of a public_id — the human-facing filename. */
export function filenameFromPublicId(publicId: string): string {
  const parts = publicId.split("/");
  return parts[parts.length - 1] || publicId;
}

/** Markdown image snippet: `![alt](url)`. */
export function imageMarkdown(alt: string, url: string): string {
  return `![${alt}](${url})`;
}

/** HTML `<img>` snippet with alt. */
export function imageTag(alt: string, url: string): string {
  return `<img src="${url}" alt="${alt}" />`;
}
