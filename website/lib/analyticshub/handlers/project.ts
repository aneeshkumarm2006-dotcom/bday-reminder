/**
 * Project identity (name + brand colors). `setup` is the first-run wizard's save
 * (auth already covers the owner via the shared /seoteam session, so there is no
 * password step). Saving marks setup complete.
 */
import { z } from "zod";

import { getProject, setProject } from "../config";
import { json, readBody } from "./respond";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(80),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a #RRGGBB hex."),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a #RRGGBB hex."),
});

export async function handleProjectGet(): Promise<Response> {
  return json({ project: await getProject() });
}

export async function handleProjectSave(req: Request): Promise<Response> {
  const parsed = projectSchema.safeParse(await readBody(req));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid project details." }, 400);
  }
  await setProject(parsed.data);
  return json({ ok: true, project: parsed.data });
}
