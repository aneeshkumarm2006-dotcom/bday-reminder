/**
 * Pure route table for the hub API: (method, path segments, request) → Response.
 * Kept free of Next server wiring so tests can drive it with a fabricated Request
 * and a stubbed store — the same parsing production uses. Auth is enforced here
 * for every route (defense in depth on top of the proxy); there is no public
 * endpoint because login lives at the shared /seoteam screen.
 */
import { isAuthed } from "./auth";
import { handleData } from "./handlers/data";
import * as gads from "./handlers/gads";
import * as google from "./handlers/google";
import * as meta from "./handlers/meta";
import { handleProjectGet, handleProjectSave } from "./handlers/project";
import { json } from "./handlers/respond";
import { handleStatus } from "./handlers/status";

/** Parse the hub sub-path from a full request URL (same logic route.ts uses). */
export function parseSubpath(url: string): string[] {
  const { pathname } = new URL(url);
  const rest = pathname.replace(/^\/analyticshub\/api\/?/, "").replace(/\/+$/, "");
  return rest ? rest.split("/") : [];
}

export async function dispatch(
  method: string,
  segments: string[],
  req: Request,
): Promise<Response> {
  if (!(await isAuthed())) return json({ error: "Unauthorized" }, 401);

  const [a, b, c] = segments;

  if (method === "GET") {
    if (a === "status") return handleStatus();
    if (a === "project") return handleProjectGet();
    if (a === "data" && b) return handleData(b, req);
    if (a === "google" && b === "options") return google.handleGoogleOptions();
    if (a === "oauth" && b === "google" && c === "start") return google.handleGoogleStart(req);
    if (a === "oauth" && b === "google" && c === "callback") return google.handleGoogleCallback(req);
  }

  if (method === "POST") {
    if (a === "setup" || a === "project") return handleProjectSave(req);
    if (a === "google" && b === "select") return google.handleGoogleSelect(req);
    if (a === "google" && b === "service-account") return google.handleGoogleServiceAccount(req);
    if (a === "google" && b === "disconnect") return google.handleGoogleDisconnect();
    if (a === "meta" && b === "validate") return meta.handleMetaValidate(req);
    if (a === "meta" && b === "select") return meta.handleMetaSelect(req);
    if (a === "meta" && b === "disconnect") return meta.handleMetaDisconnect();
    if (a === "gads" && b === "validate") return gads.handleGadsValidate(req);
    if (a === "gads" && b === "save") return gads.handleGadsSave(req);
    if (a === "gads" && b === "disconnect") return gads.handleGadsDisconnect();
  }

  return json({ error: `Not found: ${method} /${segments.join("/")}` }, 404);
}
