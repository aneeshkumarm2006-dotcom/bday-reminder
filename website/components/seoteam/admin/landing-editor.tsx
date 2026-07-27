"use client";

import { Eye, EyeOff, ExternalLink, GripVertical } from "lucide-react";
import * as React from "react";

import {
  TextAreaRow,
  TextRow,
} from "@/components/seoteam/admin/fields";
import { IconPicker } from "@/components/seoteam/admin/icon-picker";
import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import {
  SaveBar,
  useSaveShortcut,
  useUnsavedGuard,
} from "@/components/seoteam/admin/save-bar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveLanding } from "@/lib/content/admin-api";
import type {
  CtaLink,
  FaqSection,
  FeaturePreview,
  FeaturesSection,
  GetTheAppSection,
  HeroSection,
  HowItWorksSection,
  LandingSection,
  LatestPostsSection,
  ValuePropSection,
} from "@/lib/content/types";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<LandingSection["type"], string> = {
  hero: "Hero",
  valueProp: "Value proposition",
  features: "Features",
  howItWorks: "How it works",
  latestPosts: "Latest posts",
  faq: "FAQ",
  getTheApp: "Get the app",
};

/**
 * The landing page editor: a section list on the left, the selected section's
 * form on the right.
 *
 * Deliberately section-based rather than a free-form page builder. The team can
 * reorder, hide, and rewrite everything, but the markup stays in
 * `landing-sections.tsx`, so the homepage can never come out looking off-brand.
 *
 * Draft and published are separate: Save writes the draft (preview renders it),
 * Publish copies draft → published and revalidates `/`.
 */
export function LandingEditor({ initial }: { initial: LandingSection[] }) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initial);
  const [sections, setSections] = React.useState(initial);
  const [selectedId, setSelectedId] = React.useState(initial[0]?.id ?? "");
  const [busy, setBusy] = React.useState<"draft" | "publish" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const dirty = React.useMemo(
    () => JSON.stringify(sections) !== JSON.stringify(saved),
    [sections, saved],
  );
  useUnsavedGuard(dirty);

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0] ?? null;

  const patchSelected = (changes: Partial<LandingSection>) => {
    if (!selected) return;
    setSections((prev) =>
      prev.map((s) => (s.id === selected.id ? ({ ...s, ...changes } as LandingSection) : s)),
    );
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(next);
  };

  const persist = React.useCallback(
    async (mode: "draft" | "publish") => {
      setBusy(mode);
      setError(null);
      try {
        await saveLanding(sections, mode);
        setSaved(sections);
        toast({
          message:
            mode === "publish"
              ? "Published — the homepage is live with these changes."
              : "Draft saved. Use Preview to see it.",
          tone: "success",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save.";
        setError(message);
        toast({ message, tone: "error" });
      } finally {
        setBusy(null);
      }
    },
    [sections, toast],
  );

  useSaveShortcut(() => {
    if (dirty && !busy) void persist("draft");
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* ---------------------------- section rail ---------------------------- */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Sections
        </p>
        <ul className="flex flex-col gap-1">
          {sections.map((section, index) => (
            <li
              key={section.id}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                move(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                "flex items-center gap-1 rounded-md border px-1.5 py-1 transition-colors",
                selected?.id === section.id
                  ? "border-biro bg-biro-tint"
                  : "border-transparent hover:bg-surface-sunken",
                dragIndex === index && "opacity-50",
              )}
            >
              <span
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                title="Drag to reorder"
                aria-hidden="true"
                className="cursor-grab p-1 text-ink-muted active:cursor-grabbing"
              >
                <GripVertical size={14} />
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(section.id)}
                aria-current={selected?.id === section.id ? "true" : undefined}
                className={cn(
                  "min-w-0 flex-1 truncate px-1 py-1 text-left text-sm",
                  section.visible ? "text-ink" : "text-ink-muted line-through",
                )}
              >
                {SECTION_LABELS[section.type]}
              </button>
              <button
                type="button"
                aria-label={section.visible ? "Hide section" : "Show section"}
                title={section.visible ? "Hide section" : "Show section"}
                onClick={() =>
                  setSections((prev) =>
                    prev.map((s) =>
                      s.id === section.id ? { ...s, visible: !s.visible } : s,
                    ),
                  )
                }
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
              >
                {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Drag to reorder. Hidden sections stay saved — they just don&apos;t render.
        </p>
      </aside>

      {/* ------------------------------ section form -------------------------- */}
      <div className="min-w-0">
        {selected ? (
          <AdminSection
            title={SECTION_LABELS[selected.type]}
            description={
              selected.visible
                ? "Visible on the homepage."
                : "Currently hidden from the homepage."
            }
          >
            <SectionForm section={selected} patch={patchSelected} />
          </AdminSection>
        ) : (
          <p className="text-sm text-ink-muted">No sections.</p>
        )}

        <SaveBar
          dirty={dirty}
          saving={busy !== null}
          error={error}
          saveLabel="Save draft"
          onSave={() => void persist("draft")}
          onReset={() => {
            setSections(saved);
            setError(null);
          }}
        >
          <a
            href="/seoteam/preview/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Preview
          </a>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => void persist("publish")}
          >
            {busy === "publish" ? "Publishing…" : "Publish"}
          </Button>
        </SaveBar>
      </div>
    </div>
  );
}

/* ------------------------------- section forms ---------------------------- */

function SectionForm({
  section,
  patch,
}: {
  section: LandingSection;
  patch: (changes: Partial<LandingSection>) => void;
}) {
  switch (section.type) {
    case "hero":
      return <HeroForm section={section} patch={patch as (c: Partial<HeroSection>) => void} />;
    case "valueProp":
      return (
        <ValuePropForm
          section={section}
          patch={patch as (c: Partial<ValuePropSection>) => void}
        />
      );
    case "features":
      return (
        <FeaturesForm section={section} patch={patch as (c: Partial<FeaturesSection>) => void} />
      );
    case "howItWorks":
      return (
        <HowItWorksForm
          section={section}
          patch={patch as (c: Partial<HowItWorksSection>) => void}
        />
      );
    case "latestPosts":
      return (
        <LatestPostsForm
          section={section}
          patch={patch as (c: Partial<LatestPostsSection>) => void}
        />
      );
    case "faq":
      return <FaqForm section={section} patch={patch as (c: Partial<FaqSection>) => void} />;
    case "getTheApp":
      return (
        <GetTheAppForm
          section={section}
          patch={patch as (c: Partial<GetTheAppSection>) => void}
        />
      );
    default:
      return null;
  }
}

/** Label + href pair for a call-to-action button. */
function CtaFields({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: CtaLink;
  onChange: (next: CtaLink) => void;
}) {
  return (
    <fieldset className="rounded-md border border-border-subtle p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {legend}
      </legend>
      <FieldGrid>
        <TextRow
          label="Label"
          value={value.label}
          onChange={(label) => onChange({ ...value, label })}
          helper="Leave blank to hide this button."
        />
        <TextRow
          label="Link"
          value={value.href}
          placeholder="/signup"
          onChange={(href) => onChange({ ...value, href })}
        />
      </FieldGrid>
    </fieldset>
  );
}

function AnchorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextRow
      label="Anchor id"
      value={value}
      onChange={onChange}
      helper="Used by in-page links, e.g. /#features. Changing it breaks existing links."
    />
  );
}

function HeroForm({
  section,
  patch,
}: {
  section: HeroSection;
  patch: (changes: Partial<HeroSection>) => void;
}) {
  return (
    <>
      <TextRow
        label="Badge"
        value={section.badge}
        max={60}
        onChange={(badge) => patch({ badge })}
        helper="The small pill above the ring. Leave blank to hide it."
      />
      <TextRow
        label="Heading"
        value={section.heading}
        max={60}
        onChange={(heading) => patch({ heading })}
      />
      <TextAreaRow
        label="Sub-heading"
        value={section.subheading}
        onChange={(subheading) => patch({ subheading })}
      />
      <CtaFields
        legend="Primary button"
        value={section.primaryCta}
        onChange={(primaryCta) => patch({ primaryCta })}
      />
      <CtaFields
        legend="Secondary button"
        value={section.secondaryCta}
        onChange={(secondaryCta) => patch({ secondaryCta })}
      />
      <TextRow
        label="Footnote"
        value={section.footnote}
        onChange={(footnote) => patch({ footnote })}
      />
    </>
  );
}

function ValuePropForm({
  section,
  patch,
}: {
  section: ValuePropSection;
  patch: (changes: Partial<ValuePropSection>) => void;
}) {
  const parts = section.headingParts;
  const set = (key: keyof typeof parts, value: string) =>
    patch({ headingParts: { ...parts, [key]: value } });

  return (
    <>
      <div className="rounded-md border border-border-subtle bg-surface-sunken/50 p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Heading preview
        </p>
        <p className="mt-1.5 font-display text-base text-ink">
          {parts.lead} <span className="text-ink-muted">{parts.muted}</span>
          {parts.mid} <span className="text-biro">{parts.accent}</span> {parts.tail}
        </p>
      </div>
      <FieldGrid>
        <TextRow label="Lead" value={parts.lead} onChange={(v) => set("lead", v)} />
        <TextRow
          label="Muted phrase"
          value={parts.muted}
          onChange={(v) => set("muted", v)}
          helper="Rendered in the muted ink colour."
        />
      </FieldGrid>
      <FieldGrid>
        <TextRow label="Middle" value={parts.mid} onChange={(v) => set("mid", v)} />
        <TextRow
          label="Accent phrase"
          value={parts.accent}
          onChange={(v) => set("accent", v)}
          helper="Rendered in the biro accent."
        />
      </FieldGrid>
      <TextRow label="Tail" value={parts.tail} onChange={(v) => set("tail", v)} />
      <TextAreaRow
        label="Body"
        value={section.body}
        onChange={(body) => patch({ body })}
      />
    </>
  );
}

const PREVIEW_OPTIONS: { value: FeaturePreview; label: string }[] = [
  { value: "app", label: "App screen" },
  { value: "reminder", label: "Reminder card" },
  { value: "widget", label: "Home-screen widget" },
  { value: "none", label: "No image" },
];

function FeaturesForm({
  section,
  patch,
}: {
  section: FeaturesSection;
  patch: (changes: Partial<FeaturesSection>) => void;
}) {
  return (
    <>
      <AnchorField value={section.anchor} onChange={(anchor) => patch({ anchor })} />
      <TextRow
        label="Heading"
        value={section.heading}
        onChange={(heading) => patch({ heading })}
      />
      <TextAreaRow label="Sub-heading" value={section.sub} onChange={(sub) => patch({ sub })} />

      <div>
        <Label>Feature rows</Label>
        <ListEditor
          items={section.rows}
          onChange={(rows) => patch({ rows })}
          keyFor={(row) => row.id}
          titleFor={(row) => row.title || row.eyebrow}
          subtitleFor={(row) => (row.reverse ? "image left" : "image right")}
          max={12}
          addLabel="Add feature row"
          emptyLabel="No feature rows."
          onCreate={() => ({
            id: newId("row"),
            icon: "Sparkles",
            eyebrow: "",
            title: "",
            body: "",
            points: [],
            preview: "none" as FeaturePreview,
            reverse: section.rows.length % 2 === 1,
          })}
          renderItem={(row, _index, patchRow) => (
            <>
              <IconPicker value={row.icon} onChange={(icon) => patchRow({ icon })} />
              <FieldGrid>
                <TextRow
                  label="Eyebrow"
                  value={row.eyebrow}
                  onChange={(eyebrow) => patchRow({ eyebrow })}
                />
                <TextRow
                  label="Title"
                  value={row.title}
                  onChange={(title) => patchRow({ title })}
                />
              </FieldGrid>
              <TextAreaRow
                label="Body"
                value={row.body}
                onChange={(body) => patchRow({ body })}
              />
              <BulletListEditor
                values={row.points}
                onChange={(points) => patchRow({ points })}
              />
              <FieldGrid>
                <div>
                  <Label>Product shot</Label>
                  <Select
                    value={row.preview}
                    onChange={(e) =>
                      patchRow({ preview: e.target.value as FeaturePreview })
                    }
                  >
                    {PREVIEW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end pb-1">
                  <ToggleRow
                    label="Image on the left"
                    checked={row.reverse}
                    onCheckedChange={(reverse) => patchRow({ reverse })}
                  />
                </div>
              </FieldGrid>
            </>
          )}
        />
      </div>

      <div>
        <Label>Feature cards</Label>
        <ListEditor
          items={section.cards}
          onChange={(cards) => patch({ cards })}
          keyFor={(card) => card.id}
          titleFor={(card) => card.title}
          max={24}
          addLabel="Add feature card"
          emptyLabel="No feature cards."
          onCreate={() => ({ id: newId("card"), icon: "Sparkles", title: "", body: "" })}
          renderItem={(card, _index, patchCard) => (
            <>
              <IconPicker value={card.icon} onChange={(icon) => patchCard({ icon })} />
              <TextRow
                label="Title"
                value={card.title}
                onChange={(title) => patchCard({ title })}
              />
              <TextAreaRow
                label="Body"
                value={card.body}
                rows={3}
                onChange={(body) => patchCard({ body })}
              />
            </>
          )}
        />
      </div>
    </>
  );
}

function HowItWorksForm({
  section,
  patch,
}: {
  section: HowItWorksSection;
  patch: (changes: Partial<HowItWorksSection>) => void;
}) {
  return (
    <>
      <AnchorField value={section.anchor} onChange={(anchor) => patch({ anchor })} />
      <TextRow
        label="Heading"
        value={section.heading}
        onChange={(heading) => patch({ heading })}
      />
      <div>
        <Label>Steps</Label>
        <ListEditor
          items={section.steps}
          onChange={(steps) => patch({ steps })}
          keyFor={(step) => step.id}
          titleFor={(step) => step.title}
          subtitleFor={(step) =>
            step.offset === 0 ? "today" : `${Math.abs(step.offset)} days ${step.offset < 0 ? "before" : "after"}`
          }
          max={8}
          addLabel="Add step"
          emptyLabel="No steps."
          onCreate={() => ({ id: newId("step"), offset: 0, title: "", body: "" })}
          renderItem={(step, _index, patchStep) => (
            <>
              <TextRow
                label="Title"
                value={step.title}
                onChange={(title) => patchStep({ title })}
              />
              <TextAreaRow
                label="Body"
                value={step.body}
                rows={3}
                onChange={(body) => patchStep({ body })}
              />
              <NumberRow
                label="Ring day offset"
                value={step.offset}
                onChange={(offset) => patchStep({ offset })}
                helper="Days from the viewer's today. 0 renders as the highlighted “today” ring."
              />
            </>
          )}
        />
      </div>
    </>
  );
}

function LatestPostsForm({
  section,
  patch,
}: {
  section: LatestPostsSection;
  patch: (changes: Partial<LatestPostsSection>) => void;
}) {
  return (
    <>
      <AnchorField value={section.anchor} onChange={(anchor) => patch({ anchor })} />
      <TextRow
        label="Heading"
        value={section.heading}
        onChange={(heading) => patch({ heading })}
      />
      <TextAreaRow label="Sub-heading" value={section.sub} onChange={(sub) => patch({ sub })} />
      <TextRow
        label="Button label"
        value={section.ctaLabel}
        onChange={(ctaLabel) => patch({ ctaLabel })}
        helper="Links to /blog. Leave blank to hide the button."
      />
      <p className="text-xs text-ink-muted">
        The three newest published posts are pulled in automatically. This section hides
        itself when there are none.
      </p>
    </>
  );
}

function FaqForm({
  section,
  patch,
}: {
  section: FaqSection;
  patch: (changes: Partial<FaqSection>) => void;
}) {
  return (
    <>
      <AnchorField value={section.anchor} onChange={(anchor) => patch({ anchor })} />
      <TextRow
        label="Heading"
        value={section.heading}
        onChange={(heading) => patch({ heading })}
      />
      <TextAreaRow label="Sub-heading" value={section.sub} onChange={(sub) => patch({ sub })} />
      <div>
        <Label>Questions</Label>
        <p className="mb-2 text-xs text-ink-muted">
          This list is the single source for both the visible accordion and the FAQPage
          structured data, so the two can never drift apart.
        </p>
        <ListEditor
          items={section.items}
          onChange={(items) => patch({ items })}
          keyFor={(item) => item.id}
          titleFor={(item) => item.q}
          max={50}
          addLabel="Add question"
          emptyLabel="No questions yet."
          onCreate={() => ({ id: newId("faq"), q: "", a: "" })}
          renderItem={(item, _index, patchItem) => (
            <>
              <TextRow
                label="Question"
                value={item.q}
                onChange={(q) => patchItem({ q })}
              />
              <TextAreaRow
                label="Answer"
                value={item.a}
                rows={4}
                onChange={(a) => patchItem({ a })}
              />
            </>
          )}
        />
      </div>
    </>
  );
}

function GetTheAppForm({
  section,
  patch,
}: {
  section: GetTheAppSection;
  patch: (changes: Partial<GetTheAppSection>) => void;
}) {
  return (
    <>
      <AnchorField value={section.anchor} onChange={(anchor) => patch({ anchor })} />
      <TextRow
        label="Heading"
        value={section.heading}
        onChange={(heading) => patch({ heading })}
      />
      <TextAreaRow label="Body" value={section.body} onChange={(body) => patch({ body })} />
      <FieldGrid>
        <TextRow
          label="Button label"
          value={section.ctaLabel}
          onChange={(ctaLabel) => patch({ ctaLabel })}
        />
        <TextRow
          label="Button link"
          value={section.ctaHref}
          onChange={(ctaHref) => patch({ ctaHref })}
        />
      </FieldGrid>
      <ToggleRow
        label="Show app store badges"
        description="The “coming soon” App Store and Google Play placeholders."
        checked={section.storeBadges}
        onCheckedChange={(storeBadges) => patch({ storeBadges })}
      />
      <TextRow
        label="Footnote"
        value={section.footnote}
        onChange={(footnote) => patch({ footnote })}
      />
    </>
  );
}

/* --------------------------------- helpers -------------------------------- */

/** Multi-line bullet editor — one bullet per line, which beats a chip list for prose. */
function BulletListEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id}>Bullet points</Label>
      <textarea
        id={id}
        rows={Math.max(3, values.length + 1)}
        value={values.join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((line) => line.replace(/^[-•]\s*/, ""))
              .filter((line, i, all) => line.trim() !== "" || i === all.length - 1),
          )
        }
        className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink transition-colors focus:border-biro"
      />
      <p className="mt-1.5 text-xs text-ink-muted">One bullet per line.</p>
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  helper?: string;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={String(value)}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
      {helper && <p className="mt-1.5 text-xs text-ink-muted">{helper}</p>}
    </div>
  );
}
