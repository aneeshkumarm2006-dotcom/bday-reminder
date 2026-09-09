"use client";

import * as React from "react";

import {
  BulletListEditor,
  TextAreaRow,
  TextRow,
} from "@/components/seoteam/admin/fields";
import { IconPicker } from "@/components/seoteam/admin/icon-picker";
import { FieldGrid } from "@/components/seoteam/admin/layout";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import { MediaPickerField } from "@/components/seoteam/admin/media-picker";
import { TiptapEditor } from "@/components/seoteam/editor/tiptap-editor";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import {
  fileToDataUri,
  importImageUrlRequest,
  uploadImageRequest,
} from "@/lib/blog/dashboard-api";
import { resolveVideo } from "@/lib/content/embed";
import { blockedEmbedHosts } from "@/lib/content/sanitize-embed";
import type {
  BlockBackground,
  BlockWidth,
  ButtonVariant,
  CtaLink,
  PageBlock,
} from "@/lib/content/types";

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

    case "image":
      return (
        <>
          <MediaPickerField
            value={block.imageUrl}
            onChange={(imageUrl) => patch({ imageUrl })}
          />
          <TextRow
            label="Alt text"
            value={block.imageAlt}
            onChange={(imageAlt) => patch({ imageAlt })}
            helper="Describe the image for screen readers and search engines."
          />
          <TextRow
            label="Caption"
            value={block.caption}
            onChange={(caption) => patch({ caption })}
            helper="Optional line under the image."
          />
          <FieldGrid>
            <WidthField value={block.width} onChange={(width) => patch({ width })} />
            <TextRow
              label="Links to"
              value={block.href}
              onChange={(href) => patch({ href })}
              helper="Optional. Leave blank for a plain image."
            />
          </FieldGrid>
          <ToggleRow
            label="Rounded corners"
            checked={block.rounded}
            onCheckedChange={(rounded) => patch({ rounded })}
          />
        </>
      );

    case "gallery":
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
            <Label>Columns</Label>
            <Select
              value={String(block.columns)}
              onChange={(e) => patch({ columns: Number(e.target.value) as 2 | 3 | 4 })}
            >
              <option value="2">Two across</option>
              <option value="3">Three across</option>
              <option value="4">Four across</option>
            </Select>
          </div>
          <div>
            <Label>Images</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.caption || item.imageAlt || "Image"}
              max={24}
              addLabel="Add image"
              emptyLabel="No images yet."
              onCreate={() => ({
                id: newId("img"),
                imageUrl: "",
                imageAlt: "",
                caption: "",
                href: "",
              })}
              renderItem={(item, _i, patchItem) => (
                <>
                  <MediaPickerField
                    value={item.imageUrl}
                    onChange={(imageUrl) => patchItem({ imageUrl })}
                  />
                  <FieldGrid>
                    <TextRow
                      label="Alt text"
                      value={item.imageAlt}
                      onChange={(imageAlt) => patchItem({ imageAlt })}
                    />
                    <TextRow
                      label="Caption"
                      value={item.caption}
                      onChange={(caption) => patchItem({ caption })}
                    />
                  </FieldGrid>
                  <TextRow
                    label="Links to"
                    value={item.href}
                    onChange={(href) => patchItem({ href })}
                  />
                </>
              )}
            />
          </div>
        </>
      );

    case "html":
      return (
        <>
          <div>
            <Label htmlFor="html-block">HTML</Label>
            <textarea
              id="html-block"
              rows={14}
              spellCheck={false}
              value={block.html}
              onChange={(e) => patch({ html: e.target.value })}
              className="w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-ink transition-colors focus:border-biro"
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Cleaned on save: scripts, event handlers and unknown embed hosts are
              removed. Tables, layout markup, classes and inline styles are kept.
            </p>
          </div>
          <EmbedHostHint html={block.html} />
          <FieldGrid>
            <WidthField value={block.width} onChange={(width) => patch({ width })} />
            <BackgroundField
              value={block.background}
              onChange={(background) => patch({ background })}
            />
          </FieldGrid>
        </>
      );

    case "video":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextRow
            label="Video link"
            value={block.url}
            onChange={(url) => patch({ url })}
            helper="A YouTube or Vimeo link, or the URL of an .mp4 file."
            error={
              block.url.trim() && !resolveVideo(block.url)
                ? "That link isn't a YouTube or Vimeo video, or a video file."
                : null
            }
          />
          <TextRow
            label="Caption"
            value={block.caption}
            onChange={(caption) => patch({ caption })}
          />
          <MediaPickerField
            label="Poster image"
            value={block.posterUrl}
            onChange={(posterUrl) => patch({ posterUrl })}
            helper="Shown before playback starts. Only used for video files."
          />
          <WidthField value={block.width} onChange={(width) => patch({ width })} />
        </>
      );

    case "buttons":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <div>
            <Label>Alignment</Label>
            <Select
              value={block.align}
              onChange={(e) => patch({ align: e.target.value as "left" | "center" })}
            >
              <option value="center">Centred</option>
              <option value="left">Left-aligned</option>
            </Select>
          </div>
          <div>
            <Label>Buttons</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.label || "Button"}
              max={6}
              defaultOpen
              addLabel="Add button"
              emptyLabel="No buttons yet."
              onCreate={() => ({
                id: newId("btn"),
                label: "",
                href: "/",
                variant: "primary" as const,
                external: false,
              })}
              renderItem={(item, _i, patchItem) => (
                <>
                  <FieldGrid>
                    <TextRow
                      label="Label"
                      value={item.label}
                      onChange={(label) => patchItem({ label })}
                    />
                    <TextRow
                      label="Link"
                      value={item.href}
                      onChange={(href) => patchItem({ href })}
                    />
                  </FieldGrid>
                  <div>
                    <Label>Style</Label>
                    <Select
                      value={item.variant}
                      onChange={(e) =>
                        patchItem({ variant: e.target.value as ButtonVariant })
                      }
                    >
                      <option value="primary">Solid</option>
                      <option value="secondary">Outlined</option>
                      <option value="ghost">Quiet</option>
                    </Select>
                  </div>
                  <ToggleRow
                    label="Opens in a new tab"
                    checked={item.external}
                    onCheckedChange={(external) => patchItem({ external })}
                  />
                </>
              )}
            />
          </div>
        </>
      );

    case "spacer":
      return (
        <>
          <div>
            <Label>Height</Label>
            <Select
              value={block.size}
              onChange={(e) =>
                patch({ size: e.target.value as "sm" | "md" | "lg" | "xl" })
              }
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra large</option>
            </Select>
          </div>
          <ToggleRow
            label="Draw a line"
            description="A hairline rule down the middle of the space."
            checked={block.rule}
            onCheckedChange={(rule) => patch({ rule })}
          />
        </>
      );

    case "logos":
      return (
        <>
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
            helper="The small line above the row, e.g. “As seen in”."
          />
          <ToggleRow
            label="Grey out until hovered"
            checked={block.grayscale}
            onCheckedChange={(grayscale) => patch({ grayscale })}
          />
          <div>
            <Label>Logos</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.imageAlt || "Logo"}
              max={20}
              addLabel="Add logo"
              emptyLabel="No logos yet."
              onCreate={() => ({ id: newId("logo"), imageUrl: "", imageAlt: "", href: "" })}
              renderItem={(item, _i, patchItem) => (
                <>
                  <MediaPickerField
                    value={item.imageUrl}
                    onChange={(imageUrl) => patchItem({ imageUrl })}
                  />
                  <FieldGrid>
                    <TextRow
                      label="Alt text"
                      value={item.imageAlt}
                      onChange={(imageAlt) => patchItem({ imageAlt })}
                    />
                    <TextRow
                      label="Links to"
                      value={item.href}
                      onChange={(href) => patchItem({ href })}
                    />
                  </FieldGrid>
                </>
              )}
            />
          </div>
        </>
      );

    case "steps":
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
          <ToggleRow
            label="Number the steps"
            description="Off shows each step's icon instead of a number."
            checked={block.numbered}
            onCheckedChange={(numbered) => patch({ numbered })}
          />
          <div>
            <Label>Steps</Label>
            <ListEditor
              items={block.items}
              onChange={(items) => patch({ items })}
              keyFor={(item) => item.id}
              titleFor={(item) => item.title || "Step"}
              max={12}
              addLabel="Add step"
              emptyLabel="No steps yet."
              onCreate={() => ({ id: newId("step"), icon: "Sparkles", title: "", body: "" })}
              renderItem={(item, _i, patchItem) => (
                <>
                  {!block.numbered && (
                    <IconPicker value={item.icon} onChange={(icon) => patchItem({ icon })} />
                  )}
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

    case "pricing":
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
            <Label>Plans</Label>
            <ListEditor
              items={block.tiers}
              onChange={(tiers) => patch({ tiers })}
              keyFor={(tier) => tier.id}
              titleFor={(tier) => tier.name || "Plan"}
              subtitleFor={(tier) => tier.price}
              max={6}
              addLabel="Add plan"
              emptyLabel="No plans yet."
              onCreate={() => ({
                id: newId("tier"),
                name: "",
                price: "",
                period: "",
                body: "",
                features: [],
                cta: { label: "", href: "/signup" },
                highlight: false,
              })}
              renderItem={(tier, _i, patchTier) => (
                <>
                  <FieldGrid>
                    <TextRow
                      label="Name"
                      value={tier.name}
                      placeholder="Free"
                      onChange={(name) => patchTier({ name })}
                    />
                    <TextRow
                      label="Price"
                      value={tier.price}
                      placeholder="$0"
                      onChange={(price) => patchTier({ price })}
                    />
                  </FieldGrid>
                  <TextRow
                    label="Period"
                    value={tier.period}
                    placeholder="/month"
                    onChange={(period) => patchTier({ period })}
                  />
                  <TextAreaRow
                    label="Body"
                    value={tier.body}
                    rows={2}
                    onChange={(body) => patchTier({ body })}
                  />
                  <BulletListEditor
                    values={tier.features}
                    onChange={(features) => patchTier({ features })}
                  />
                  <CtaFields
                    legend="Button"
                    value={tier.cta}
                    onChange={(cta) => patchTier({ cta })}
                  />
                  <ToggleRow
                    label="Highlight this plan"
                    checked={tier.highlight}
                    onCheckedChange={(highlight) => patchTier({ highlight })}
                  />
                </>
              )}
            />
          </div>
        </>
      );

    case "quote":
      return (
        <>
          <TextAreaRow
            label="Quote"
            value={block.quote}
            rows={4}
            onChange={(quote) => patch({ quote })}
            helper="Typed without quotation marks — they're added by the design."
          />
          <FieldGrid>
            <TextRow
              label="Author"
              value={block.author}
              onChange={(author) => patch({ author })}
            />
            <TextRow label="Role" value={block.role} onChange={(role) => patch({ role })} />
          </FieldGrid>
          <MediaPickerField
            label="Photo"
            value={block.imageUrl}
            onChange={(imageUrl) => patch({ imageUrl })}
            helper="Optional, shown as a circle above the quote."
          />
        </>
      );

    case "banner":
      return (
        <>
          <div>
            <Label>Tone</Label>
            <Select
              value={block.tone}
              onChange={(e) =>
                patch({ tone: e.target.value as "info" | "success" | "warning" | "danger" })
              }
            >
              <option value="info">Information</option>
              <option value="success">Positive</option>
              <option value="warning">Caution</option>
              <option value="danger">Serious</option>
            </Select>
          </div>
          <IconPicker value={block.icon} onChange={(icon) => patch({ icon })} />
          <TextRow
            label="Heading"
            value={block.heading}
            onChange={(heading) => patch({ heading })}
          />
          <TextAreaRow label="Body" value={block.body} onChange={(body) => patch({ body })} />
          <CtaFields legend="Button" value={block.cta} onChange={(cta) => patch({ cta })} />
        </>
      );

    default:
      return null;
  }
}

/** How wide a block sits in the page column. */
function WidthField({
  value,
  onChange,
}: {
  value: BlockWidth;
  onChange: (next: BlockWidth) => void;
}) {
  return (
    <div>
      <Label>Width</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value as BlockWidth)}>
        <option value="narrow">Narrow — reading width</option>
        <option value="wide">Wide &mdash; the page&rsquo;s normal column</option>
        <option value="full">Full — edge to edge</option>
      </Select>
    </div>
  );
}

/** The band a block paints behind itself. */
function BackgroundField({
  value,
  onChange,
}: {
  value: BlockBackground;
  onChange: (next: BlockBackground) => void;
}) {
  return (
    <div>
      <Label>Background</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value as BlockBackground)}>
        <option value="none">None</option>
        <option value="sunken">Sunken — a quiet band</option>
        <option value="tint">Tinted — the accent wash</option>
      </Select>
    </div>
  );
}

/**
 * Warn, while typing, about an embed that will be stripped on save.
 *
 * The sanitizer drops an iframe from an unknown host silently — correct, but
 * baffling if you pasted one and it simply vanished. This says which host, so
 * the answer is on screen before the save rather than after it.
 */
function EmbedHostHint({ html }: { html: string }) {
  const hosts = React.useMemo(() => blockedEmbedHosts(html), [html]);
  if (hosts.length === 0) return null;
  return (
    <p className="rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-fg">
      Embeds from {hosts.join(", ")} aren&rsquo;t allowed and will be removed when you
      save. YouTube, Vimeo, Google Maps, Spotify, SoundCloud, Calendly, Typeform and Loom
      are.
    </p>
  );
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
