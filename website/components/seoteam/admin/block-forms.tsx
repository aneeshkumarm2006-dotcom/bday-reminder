"use client";

import * as React from "react";

import { TextAreaRow, TextRow } from "@/components/seoteam/admin/fields";
import { IconPicker } from "@/components/seoteam/admin/icon-picker";
import { FieldGrid } from "@/components/seoteam/admin/layout";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import { MediaPickerField } from "@/components/seoteam/admin/media-picker";
import { TiptapEditor } from "@/components/seoteam/editor/tiptap-editor";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  fileToDataUri,
  importImageUrlRequest,
  uploadImageRequest,
} from "@/lib/blog/dashboard-api";
import type { CtaLink, PageBlock } from "@/lib/content/types";

/**
 * Per-block forms for the page builder. One component per block type, dispatched
 * on `block.type`, each editing a plain object the renderer in
 * `components/marketing/page-blocks.tsx` knows how to draw.
 */
export function BlockForm({
  block,
  patch,
  onError,
}: {
  block: PageBlock;
  patch: (changes: Record<string, unknown>) => void;
  onError: (message: string) => void;
}) {
  switch (block.type) {
    case "hero":
      return (
        <>
          <TextRow
            label="Eyebrow"
            value={block.eyebrow}
            onChange={(eyebrow) => patch({ eyebrow })}
          />
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextAreaRow label="Body" value={block.body} onChange={(body) => patch({ body })} />
          <CtaFields
            legend="Primary button"
            value={block.primaryCta}
            onChange={(primaryCta) => patch({ primaryCta })}
          />
          <CtaFields
            legend="Secondary button"
            value={block.secondaryCta}
            onChange={(secondaryCta) => patch({ secondaryCta })}
          />
        </>
      );

    case "richText":
      return (
        <div>
          <Label>Content</Label>
          {/* Same editor and the same sanitizer policy as blog posts: no
              iframes, no scripts, no inline styles (cleaned server-side on save). */}
          <TiptapEditor
            initialContent={block.html}
            onChange={(html) => patch({ html })}
            onUploadImage={async (file) => uploadImageRequest(await fileToDataUri(file))}
            onImportImageUrl={importImageUrlRequest}
            onError={onError}
          />
        </div>
      );

    case "featureGrid":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextAreaRow
            label="Sub-heading"
            value={block.sub}
            rows={2}
            onChange={(sub) => patch({ sub })}
          />
          <div>
            <Label>Cards</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.title}
              max={24}
              addLabel="Add card"
              emptyLabel="No cards yet."
              onCreate={() => ({ id: newId("card"), icon: "Sparkles", title: "", body: "" })}
              renderItem={(item, _i, patchItem) => (
                <>
                  <IconPicker value={item.icon} onChange={(icon) => patchItem({ icon })} />
                  <TextRow
                    label="Title"
                    value={item.title}
                    onChange={(title) => patchItem({ title })}
                  />
                  <TextAreaRow
                    label="Body"
                    value={item.body}
                    rows={3}
                    onChange={(body) => patchItem({ body })}
                  />
                </>
              )}
            />
          </div>
        </>
      );

    case "imageText":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextAreaRow label="Body" value={block.body} onChange={(body) => patch({ body })} />
          <MediaPickerField
            value={block.imageUrl}
            onChange={(imageUrl) => patch({ imageUrl })}
          />
          <TextRow
            label="Image alt text"
            value={block.imageAlt}
            onChange={(imageAlt) => patch({ imageAlt })}
            helper="Describe the image for screen readers and search engines."
          />
          <div>
            <Label>Image side</Label>
            <Select
              value={block.imageSide}
              onChange={(e) => patch({ imageSide: e.target.value as "left" | "right" })}
            >
              <option value="left">Image on the left</option>
              <option value="right">Image on the right</option>
            </Select>
          </div>
          <CtaFields legend="Button" value={block.cta} onChange={(cta) => patch({ cta })} />
        </>
      );

    case "stats":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <div>
            <Label>Stats</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => `${item.value} ${item.label}`.trim()}
              max={12}
              defaultOpen
              addLabel="Add stat"
              emptyLabel="No stats yet."
              onCreate={() => ({ id: newId("stat"), value: "", label: "" })}
              renderItem={(item, _i, patchItem) => (
                <FieldGrid>
                  <TextRow
                    label="Value"
                    value={item.value}
                    placeholder="12,000"
                    onChange={(value) => patchItem({ value })}
                  />
                  <TextRow
                    label="Label"
                    value={item.label}
                    placeholder="birthdays remembered"
                    onChange={(label) => patchItem({ label })}
                  />
                </FieldGrid>
              )}
            />
          </div>
        </>
      );

    case "testimonials":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <div>
            <Label>Quotes</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.author || item.quote}
              max={12}
              addLabel="Add quote"
              emptyLabel="No quotes yet."
              onCreate={() => ({ id: newId("quote"), quote: "", author: "", role: "" })}
              renderItem={(item, _i, patchItem) => (
                <>
                  <TextAreaRow
                    label="Quote"
                    value={item.quote}
                    rows={3}
                    onChange={(quote) => patchItem({ quote })}
                  />
                  <FieldGrid>
                    <TextRow
                      label="Author"
                      value={item.author}
                      onChange={(author) => patchItem({ author })}
                    />
                    <TextRow
                      label="Role"
                      value={item.role}
                      onChange={(role) => patchItem({ role })}
                    />
                  </FieldGrid>
                </>
              )}
            />
          </div>
        </>
      );

    case "comparisonTable":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <ColumnsEditor
            columns={block.columns}
            onChange={(columns) =>
              patch({
                columns,
                // Keep every row the same width as the header, or the table
                // renders ragged.
                rows: block.rows.map((row) => ({
                  ...row,
                  cells: columns.map((_, i) => row.cells[i] ?? ""),
                })),
              })
            }
          />
          <div>
            <Label>Rows</Label>
            <ListEditor
              items={block.rows}
              onChange={(rows) => patch({ rows })}
              keyFor={(row) => row.id}
              titleFor={(row) => row.cells[0] || "Row"}
              max={30}
              addLabel="Add row"
              emptyLabel="No rows yet."
              onCreate={() => ({
                id: newId("row"),
                cells: block.columns.map(() => ""),
              })}
              renderItem={(row, _i, patchRow) => (
                <>
                  {(block.columns.length > 0 ? block.columns : ["Cell"]).map((column, i) => (
                    <TextRow
                      key={`${row.id}-${i}`}
                      label={column || `Column ${i + 1}`}
                      value={row.cells[i] ?? ""}
                      onChange={(next) => {
                        const cells = [...row.cells];
                        cells[i] = next;
                        patchRow({ cells });
                      }}
                    />
                  ))}
                </>
              )}
            />
          </div>
        </>
      );

    case "faq":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextAreaRow
            label="Sub-heading"
            value={block.sub}
            rows={2}
            onChange={(sub) => patch({ sub })}
          />
          <div>
            <Label>Questions</Label>
            <p className="mb-2 text-xs text-ink-muted">
              Also emitted as FAQPage structured data, from this same list.
            </p>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.q}
              max={50}
              addLabel="Add question"
              emptyLabel="No questions yet."
              onCreate={() => ({ id: newId("faq"), q: "", a: "" })}
              renderItem={(item, _i, patchItem) => (
                <>
                  <TextRow label="Question" value={item.q} onChange={(q) => patchItem({ q })} />
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

    case "cta":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextAreaRow label="Body" value={block.body} onChange={(body) => patch({ body })} />
          <CtaFields legend="Button" value={block.cta} onChange={(cta) => patch({ cta })} />
          <TextRow
            label="Footnote"
            value={block.footnote}
            onChange={(footnote) => patch({ footnote })}
          />
        </>
      );

    case "divider":
      return (
        <TextRow
          label="Label"
          value={block.label}
          onChange={(label) => patch({ label })}
          helper="Optional text shown in the middle of the rule."
        />
      );

    default:
      return null;
  }
}

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
          onChange={(href) => onChange({ ...value, href })}
        />
      </FieldGrid>
    </fieldset>
  );
}

function ColumnsEditor({
  columns,
  onChange,
}: {
  columns: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <Label>Columns</Label>
      <div className="flex flex-col gap-2">
        {columns.map((column, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={column}
              onChange={(e) => {
                const next = [...columns];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-ink focus:border-biro"
            />
            <button
              type="button"
              onClick={() => onChange(columns.filter((_, idx) => idx !== i))}
              className="shrink-0 rounded-md px-3 text-sm text-ink-muted hover:text-danger-fg"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={columns.length >= 6}
          onClick={() => onChange([...columns, ""])}
          className="inline-flex h-9 items-center justify-center rounded-md border border-dashed border-border-strong text-sm text-ink-secondary transition-colors hover:border-biro hover:text-ink disabled:opacity-50"
        >
          Add column
        </button>
      </div>
    </div>
  );
}
