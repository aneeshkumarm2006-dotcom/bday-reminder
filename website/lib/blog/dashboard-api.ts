import type { CreatePostBody, UpdatePostBody } from "./validation";
import type { MediaRow, Post, SyncSummary, WebpBackfillSummary } from "./types";

/**
 * Thin client-side fetch helpers for the /seoteam dashboard. The session is an
 * httpOnly cookie, so it's attached automatically on same-origin requests — no
 * Authorization header to manage (unlike the bearer-token app API in lib/api.ts).
 */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) || `Request failed (${res.status}).`);
  }
  return data as T;
}

export async function loginRequest(password: string): Promise<void> {
  await request("/seoteam/api/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logoutRequest(): Promise<void> {
  await request("/seoteam/api/logout", { method: "POST" });
}

export async function createPostRequest(body: CreatePostBody): Promise<Post> {
  const { post } = await request<{ post: Post }>("/seoteam/api/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return post;
}

export async function updatePostRequest(
  id: string,
  body: UpdatePostBody,
): Promise<Post> {
  const { post } = await request<{ post: Post }>(`/seoteam/api/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return post;
}

export async function deletePostRequest(id: string): Promise<void> {
  await request(`/seoteam/api/posts/${id}`, { method: "DELETE" });
}

export async function uploadImageRequest(dataUri: string): Promise<string> {
  const { url } = await request<{ url: string }>("/seoteam/api/upload", {
    method: "POST",
    body: JSON.stringify({ image: dataUri }),
  });
  return url;
}

/**
 * Import a remote image URL into Cloudinary as WebP and return the hosted URL.
 * Used for pasted external links so they're converted like uploaded files. If
 * Cloudinary isn't configured the server echoes the URL back unchanged.
 */
export async function importImageUrlRequest(imageUrl: string): Promise<string> {
  const { url } = await request<{ url: string }>("/seoteam/api/upload", {
    method: "POST",
    body: JSON.stringify({ url: imageUrl }),
  });
  return url;
}

/** Full media grid/table dataset (inventory joined with live post usage). */
export async function fetchMediaRows(): Promise<MediaRow[]> {
  const { rows } = await request<{ rows: MediaRow[] }>("/seoteam/api/media");
  return rows;
}

/** Refresh the inventory from Cloudinary; returns the add/update/remove counts. */
export async function syncMediaRequest(): Promise<SyncSummary> {
  return request<SyncSummary>("/seoteam/api/media/sync", { method: "POST" });
}

/** Convert legacy JPG/PNG assets to WebP and repoint posts; returns the counts. */
export async function backfillWebpRequest(): Promise<WebpBackfillSummary> {
  return request<WebpBackfillSummary>("/seoteam/api/media/backfill", {
    method: "POST",
  });
}

/** Edit one image's alt (written back into posts) and/or tags. Returns the row. */
export async function updateImageRequest(
  id: string,
  body: { alt?: string; tags?: string[] },
): Promise<MediaRow> {
  const { row } = await request<{ row: MediaRow }>(`/seoteam/api/media/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return row;
}

export async function deleteImageRequest(id: string): Promise<void> {
  await request(`/seoteam/api/media/${id}`, { method: "DELETE" });
}

/** Bulk delete / add tag / remove tag over selected image ids. */
export async function bulkMediaRequest(body: {
  action: "delete" | "addTag" | "removeTag";
  ids: string[];
  tag?: string;
}): Promise<{ affected: number }> {
  return request<{ affected: number }>("/seoteam/api/media/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Read a File as a base64 data URI for upload. */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
