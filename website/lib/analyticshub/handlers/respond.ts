/** Tiny response helpers shared by the hub's route handlers. */
import { NextResponse } from "next/server";

export function json(data: unknown, status = 200): Response {
  return NextResponse.json(data, { status });
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function origin(req: Request): string {
  return new URL(req.url).origin;
}
