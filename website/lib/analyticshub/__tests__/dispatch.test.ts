import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory store + auth flag (hoisted so the vi.mock factories can see them).
const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));
const auth = vi.hoisted(() => ({ authed: true }));

vi.mock("@/lib/analyticshub/store", () => ({
  getRaw: async (k: string) => mem.get(k) ?? null,
  getManyRaw: async (keys: string[]) => {
    const out = new Map<string, string>();
    for (const k of keys) if (mem.has(k)) out.set(k, mem.get(k) as string);
    return out;
  },
  setRaw: async (k: string, v: string) => {
    mem.set(k, v);
  },
  del: async (k: string) => {
    mem.delete(k);
  },
  delByPrefix: async (p: string) => {
    for (const k of [...mem.keys()]) if (k.startsWith(p)) mem.delete(k);
  },
}));

vi.mock("@/lib/analyticshub/auth", () => ({ isAuthed: async () => auth.authed }));
vi.mock("@/lib/blog/db", () => ({ isDbConfigured: () => false, connectDb: async () => ({}) }));

process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");

import { dispatch, parseSubpath } from "@/lib/analyticshub/dispatch";
import type { StatusPayload } from "@/lib/analyticshub/types";

async function call(method: string, path: string, body?: unknown) {
  const r = new Request(`http://localhost/analyticshub/api/${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await dispatch(method, parseSubpath(r.url), r);
  return { status: res.status, body: (await res.json()) as unknown };
}

describe("hub dispatch — first-run flow (URL-based, stubbed store)", () => {
  beforeEach(() => {
    mem.clear();
    auth.authed = true;
  });

  it("parses the sub-path from the URL", () => {
    expect(parseSubpath("http://x/analyticshub/api/data/all?from=a&to=b")).toEqual(["data", "all"]);
    expect(parseSubpath("http://x/analyticshub/api/status")).toEqual(["status"]);
    expect(parseSubpath("http://x/analyticshub/api/")).toEqual([]);
  });

  it("401s when not authenticated", async () => {
    auth.authed = false;
    expect((await call("GET", "status")).status).toBe(401);
  });

  it("starts unconfigured with independent source states", async () => {
    const { status, body } = await call("GET", "status");
    expect(status).toBe(200);
    const payload = body as StatusPayload;
    expect(payload.setupComplete).toBe(false);
    expect(payload.sources.find((s) => s.key === "users")?.status).toBe("error"); // no DB
    expect(payload.sources.find((s) => s.key === "ga4")?.status).toBe("not_connected");
  });

  it("saves project identity on setup and flips setupComplete", async () => {
    const res = await call("POST", "setup", {
      name: "Acme",
      primaryColor: "#2c4bd8",
      accentColor: "#2e8b82",
    });
    expect(res.status).toBe(200);
    const status = (await call("GET", "status")).body as StatusPayload;
    expect(status.setupComplete).toBe(true);
    expect(status.project.name).toBe("Acme");
  });

  it("rejects invalid project details", async () => {
    const { status } = await call("POST", "setup", {
      name: "",
      primaryColor: "nope",
      accentColor: "nope",
    });
    expect(status).toBe(400);
  });

  it("returns an empty /all envelope for every source without external calls", async () => {
    const { status, body } = await call("GET", "data/all");
    expect(status).toBe(200);
    const sources = (body as { sources: Record<string, { status: string }> }).sources;
    expect(Object.keys(sources)).toHaveLength(5);
    expect(sources.ga4.status).toBe("not_connected");
    expect(sources.users.status).toBe("error");
  });

  it("404s an unknown route", async () => {
    expect((await call("GET", "nope")).status).toBe(404);
  });
});
