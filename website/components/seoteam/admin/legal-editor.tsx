"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { TextAreaRow, TextRow } from "@/components/seoteam/admin/fields";
import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import {
  SaveBar,
  useSaveShortcut,
  useUnsavedGuard,
} from "@/components/seoteam/admin/save-bar";
import { TiptapEditor } from "@/components/seoteam/editor/tiptap-editor";
import { Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  fileToDataUri,
  importImageUrlRequest,
  uploadImageRequest,
} from "@/lib/blog/dashboard-api";
import { saveLegalDoc } from "@/lib/content/admin-api";
import type { LegalDoc, LegalDocKey } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const TABS: { key: LegalDocKey; label: string; path: string }[] = [
  { key: "privacy", label: "Privacy policy", path: "/privacy" },
  { key: "terms", label: "Terms of service", path: "/terms" },
  { key: "contact", label: "Contact", path: "/contact" },
];

/**
 * Editor for the three prose pages. Body copy is Tiptap HTML, sanitized on save
 * with the blog's policy, and rendered through the existing `LegalPage` shell —
 * so an edited privacy policy still looks like the rest of the site.
 */
export function LegalEditor({ docs }: { docs: Record<LegalDocKey, LegalDoc> }) {
  const { toast } = useToast();
  const [active, setActive] = React.useState<LegalDocKey>("privacy");
  const [saved, setSaved] = React.useState(docs);
  const [draft, setDraft] = React.useState(docs);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const current = draft[active];
  const dirty = React.useMemo(
    () => JSON.stringify(draft[active]) !== JSON.stringify(saved[active]),
    [draft, saved, active],
  );
  useUnsavedGuard(dirty);

  const patch = (changes: Partial<LegalDoc>) =>
    setDraft((prev) => ({ ...prev, [active]: { ...prev[active], ...changes } }));

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveLegalDoc(draft[active]);
      setSaved((prev) => ({ ...prev, [active]: next }));
      setDraft((prev) => ({ ...prev, [active]: next }));
      toast({ message: "Saved — the page is live.", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      setError(message);
      toast({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, active, toast]);

  useSaveShortcut(() => {
    if (dirty && !saving) void save();
  });

  const activeTab = TABS.find((t) => t.key === active)!;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border-subtle">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active === tab.key
                ? "border-biro text-ink"
                : "border-transparent text-ink-secondary hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AdminSection
        title={activeTab.label}
        description={`Renders at ${activeTab.path}. Its title and meta description live in Page SEO.`}
      >
        <FieldGrid>
          <TextRow
            label="Page heading"
            value={current.title}
            onChange={(title) => patch({ title })}
          />
          <TextRow
            label="Last updated"
            value={current.updated}
            placeholder="June 2026"
            onChange={(updated) => patch({ updated })}
            helper="Free text, shown under the heading. Blank hides the line."
          />
        </FieldGrid>
        <TextAreaRow
          label="Intro"
          value={current.intro}
          rows={3}
          onChange={(intro) => patch({ intro })}
        />
        <div>
          <Label>Body</Label>
          {/* Remounted per document so switching tabs reseeds the editor. */}
          <TiptapEditor
            key={active}
            initialContent={current.html}
            onChange={(html) => patch({ html })}
            onUploadImage={async (file) => uploadImageRequest(await fileToDataUri(file))}
            onImportImageUrl={importImageUrlRequest}
            onError={(message) => toast({ message, tone: "error" })}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Headings, lists, links, and bold are kept; scripts and embeds are stripped on
            save.
          </p>
        </div>
      </AdminSection>

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={() => void save()}
        onReset={() => {
          setDraft((prev) => ({ ...prev, [active]: saved[active] }));
          setError(null);
        }}
      >
        <Link
          href={activeTab.path}
          target="_blank"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
        >
          <ExternalLink size={16} aria-hidden="true" />
          View page
        </Link>
      </SaveBar>
    </>
  );
}
