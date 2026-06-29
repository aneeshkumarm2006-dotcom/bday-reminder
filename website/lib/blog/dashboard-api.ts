import type { CreatePostBody, UpdatePostBody } from "./validation";
import type { Post } from "./types";

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

/** Read a File as a base64 data URI for upload. */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
