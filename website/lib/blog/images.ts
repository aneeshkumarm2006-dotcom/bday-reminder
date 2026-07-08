import { isValidObjectId } from "mongoose";
import { parse } from "node-html-parser";

import {
  destroyImage,
  listResources,
  updateResourceTags,
  type CloudinaryResource,
} from "./cloudinary";
import { connectDb } from "./db";
import { cloudinaryPublicId } from "./image-url";
import { BlogImage, type BlogImageDoc } from "./models";
import { getAllPosts, updatePost } from "./posts";
import { sanitizePostHtml } from "./sanitize";
import { serializeImage } from "./serialize";
import type {
  BlogImage as BlogImageT,
  ImageUsage,
  MediaRow,
  Post,
  SyncSummary,
} from "./types";

/** Trim, drop empties/commas (commas break Cloudinary's tag list), de-dupe, cap. */
function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = (raw ?? "").replace(/,/g, " ").trim();
    if (!t || t.length > 60) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 40);
}

/** All tracked images, newest upload first (Cloudinary time, then record time). */
export async function getAllImages(): Promise<BlogImageT[]> {
  await connectDb();
  const docs = await BlogImage.find({})
    .sort({ cloudinaryCreatedAt: -1, createdAt: -1 })
    .lean();
  return (docs as unknown as BlogImageDoc[]).map(serializeImage);
}

/**
 * Refresh the local inventory from Cloudinary: upsert every asset in the upload
 * folder, and prune records whose asset no longer exists (we list the whole
 * folder). Skips pruning when the listing is empty (unconfigured / API blip) so
 * a transient failure never wipes the library.
 */
export async function syncImages(): Promise<SyncSummary> {
  await connectDb();
  const resources = await listResources();

  const seen = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const r of resources) {
    seen.add(r.publicId);
    const existing = await BlogImage.findOne({ publicId: r.publicId });
    if (existing) {
      existing.secureUrl = r.secureUrl;
      existing.format = r.format;
      existing.width = r.width;
      existing.height = r.height;
      existing.bytes = r.bytes;
      existing.tags = r.tags;
      existing.cloudinaryCreatedAt = r.createdAt ? new Date(r.createdAt) : null;
      await existing.save();
      updated++;
    } else {
      await BlogImage.create({
        publicId: r.publicId,
        secureUrl: r.secureUrl,
        format: r.format,
        width: r.width,
        height: r.height,
        bytes: r.bytes,
        tags: r.tags,
        cloudinaryCreatedAt: r.createdAt ? new Date(r.createdAt) : null,
      });
      added++;
    }
  }

  let removed = 0;
  if (resources.length > 0) {
    const res = await BlogImage.deleteMany({ publicId: { $nin: [...seen] } });
    removed = res.deletedCount ?? 0;
  }

  const total = await BlogImage.countDocuments({});
  return { added, updated, removed, total };
}

/**
 * Upsert one record from an upload response, so newly-uploaded hosted images
 * appear in the library without waiting for a manual Sync. Best-effort — the
 * upload route swallows any failure.
 */
export async function recordUploadedImage(resource: CloudinaryResource): Promise<void> {
  await connectDb();
  await BlogImage.updateOne(
    { publicId: resource.publicId },
    {
      $set: {
        secureUrl: resource.secureUrl,
        format: resource.format,
        width: resource.width,
        height: resource.height,
        bytes: resource.bytes,
        tags: resource.tags,
        cloudinaryCreatedAt: resource.createdAt ? new Date(resource.createdAt) : null,
      },
    },
    { upsert: true },
  );
}

/**
 * Map each image public_id → every place it's used across all posts. Cover
 * images and inline body `<img>`s are matched to their Cloudinary public_id, so
 * transforms/version prefixes don't defeat the match.
 */
export function buildUsageMap(posts: Post[]): Map<string, ImageUsage[]> {
  const map = new Map<string, ImageUsage[]>();
  const add = (publicId: string, usage: ImageUsage) => {
    const list = map.get(publicId);
    if (list) list.push(usage);
    else map.set(publicId, [usage]);
  };

  for (const post of posts) {
    const coverId = cloudinaryPublicId(post.coverImage);
    if (coverId) {
      add(coverId, {
        postId: post.id,
        slug: post.slug,
        title: post.title,
        field: "cover",
        alt: (post.coverImageAlt ?? "").trim(),
      });
    }

    if (post.body) {
      try {
        const root = parse(post.body);
        for (const img of root.querySelectorAll("img")) {
          const id = cloudinaryPublicId(img.getAttribute("src") || "");
          if (!id) continue;
          add(id, {
            postId: post.id,
            slug: post.slug,
            title: post.title,
            field: "body",
            alt: (img.getAttribute("alt") || "").trim(),
          });
        }
      } catch {
        // Ignore parse failures — a malformed body just contributes no usages.
      }
    }
  }

  return map;
}

function toMediaRow(image: BlogImageT, usageMap: Map<string, ImageUsage[]>): MediaRow {
  const usedInPosts = usageMap.get(image.publicId) ?? [];
  return {
    image,
    usedInPosts,
    missingAlt: usedInPosts.length > 0 && usedInPosts.some((u) => u.alt === ""),
    unused: usedInPosts.length === 0,
  };
}

/** The full media grid/table dataset: inventory joined with live post usage. */
export async function getMediaRows(): Promise<MediaRow[]> {
  const [images, posts] = await Promise.all([getAllImages(), getAllPosts()]);
  const usageMap = buildUsageMap(posts);
  return images.map((image) => toMediaRow(image, usageMap));
}

/**
 * Write `alt` into every post that uses the image — its cover alt and/or each
 * matching inline `<img alt>` — re-sanitizing and saving each touched post.
 * Returns the slugs changed (so the route can revalidate them). Unused images
 * have nowhere to write, so this is a no-op for them.
 */
export async function setImageAltAcrossPosts(
  publicId: string,
  alt: string,
  posts: Post[],
): Promise<string[]> {
  const touched: string[] = [];

  for (const post of posts) {
    const patch: { coverImageAlt?: string; body?: string } = {};

    if (cloudinaryPublicId(post.coverImage) === publicId && (post.coverImageAlt ?? "") !== alt) {
      patch.coverImageAlt = alt;
    }

    if (post.body && post.body.includes("res.cloudinary.com")) {
      try {
        const root = parse(post.body);
        let bodyChanged = false;
        for (const img of root.querySelectorAll("img")) {
          if (cloudinaryPublicId(img.getAttribute("src") || "") === publicId) {
            if ((img.getAttribute("alt") || "") !== alt) {
              img.setAttribute("alt", alt);
              bodyChanged = true;
            }
          }
        }
        if (bodyChanged) patch.body = sanitizePostHtml(root.toString());
      } catch {
        // Ignore parse failures — leave that post's body untouched.
      }
    }

    if (patch.coverImageAlt !== undefined || patch.body !== undefined) {
      await updatePost(post.id, patch);
      touched.push(post.slug);
    }
  }

  return touched;
}

/**
 * Apply an alt and/or tags edit to one image. Alt writes back into the posts
 * that use it; tags update the record (source of truth for the gallery) and,
 * best-effort, Cloudinary. Returns the recomputed row + the post slugs touched.
 */
export async function updateImage(
  id: string,
  input: { alt?: string; tags?: string[] },
): Promise<{ row: MediaRow; touchedSlugs: string[] } | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await BlogImage.findById(id);
  if (!doc) return null;

  if (input.tags !== undefined) {
    const clean = normalizeTags(input.tags);
    doc.tags = clean;
    await doc.save();
    try {
      await updateResourceTags(doc.publicId, clean);
    } catch (err) {
      console.error("Cloudinary tag sync failed (kept on the record):", err);
    }
  }

  let touchedSlugs: string[] = [];
  if (input.alt !== undefined) {
    const posts = await getAllPosts();
    touchedSlugs = await setImageAltAcrossPosts(doc.publicId, input.alt, posts);
  }

  const image = serializeImage(doc.toObject() as unknown as BlogImageDoc);
  const posts = await getAllPosts(); // fresh — reflects the alt write-back
  const row = toMediaRow(image, buildUsageMap(posts));
  return { row, touchedSlugs };
}

/** Delete one image: remove from Cloudinary then drop the record. */
export async function deleteImage(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectDb();
  const doc = await BlogImage.findById(id);
  if (!doc) return false;
  await destroyImage(doc.publicId); // throws on a real failure; no-ops when unconfigured
  await doc.deleteOne();
  return true;
}

/** Bulk delete; returns how many were removed. Per-image failures are skipped. */
export async function deleteImages(ids: string[]): Promise<number> {
  let count = 0;
  for (const id of ids) {
    try {
      if (await deleteImage(id)) count++;
    } catch (err) {
      console.error("Bulk delete failed for", id, err);
    }
  }
  return count;
}

/** Add a tag to many images; returns how many actually changed. */
export async function addTagToImages(ids: string[], tag: string): Promise<number> {
  const clean = normalizeTags([tag])[0];
  if (!clean) return 0;
  await connectDb();
  let count = 0;
  for (const id of ids) {
    if (!isValidObjectId(id)) continue;
    const doc = await BlogImage.findById(id);
    if (!doc) continue;
    if (doc.tags.some((t) => t.toLowerCase() === clean.toLowerCase())) continue;
    doc.tags = normalizeTags([...doc.tags, clean]);
    await doc.save();
    try {
      await updateResourceTags(doc.publicId, doc.tags);
    } catch (err) {
      console.error("Cloudinary tag sync failed (kept on the record):", err);
    }
    count++;
  }
  return count;
}

/** Remove a tag from many images; returns how many actually changed. */
export async function removeTagFromImages(ids: string[], tag: string): Promise<number> {
  const target = tag.trim().toLowerCase();
  if (!target) return 0;
  await connectDb();
  let count = 0;
  for (const id of ids) {
    if (!isValidObjectId(id)) continue;
    const doc = await BlogImage.findById(id);
    if (!doc) continue;
    const next = doc.tags.filter((t) => t.toLowerCase() !== target);
    if (next.length === doc.tags.length) continue;
    doc.tags = next;
    await doc.save();
    try {
      await updateResourceTags(doc.publicId, next);
    } catch (err) {
      console.error("Cloudinary tag sync failed (kept on the record):", err);
    }
    count++;
  }
  return count;
}
