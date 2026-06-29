"use client";

import {
  BookOpenCheck,
  FileText,
  GitCompareArrows,
  ListOrdered,
  Newspaper,
  Star,
} from "lucide-react";

import { BLOG_TEMPLATES } from "@/lib/blog/templates";
import type { TemplateKey } from "@/lib/blog/types";

const ICONS: Record<TemplateKey, typeof FileText> = {
  "how-to": BookOpenCheck,
  listicle: ListOrdered,
  comparison: GitCompareArrows,
  review: Star,
  news: Newspaper,
  generic: FileText,
};

/** Step 1 of the new-post flow: choose a template to pre-fill the structure. */
export function TemplatePicker({
  onSelect,
}: {
  onSelect: (key: TemplateKey) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">
        Pick a template
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Choose a structure to start from. You can change everything afterwards.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BLOG_TEMPLATES.map((template) => {
          const Icon = ICONS[template.key];
          return (
            <button
              key={template.key}
              type="button"
              onClick={() => onSelect(template.key)}
              className="group rounded-lg border border-border-subtle bg-surface p-5 text-left transition-colors hover:border-biro"
            >
              <Icon size={22} className="text-biro" aria-hidden="true" />
              <h3 className="mt-3 font-display text-base font-semibold text-ink">
                {template.name}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {template.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
