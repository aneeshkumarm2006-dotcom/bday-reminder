"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import * as React from "react";

import {
  BulletListEditor,
  NumberRow,
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
import { TypedConfirmDialog } from "@/components/seoteam/admin/typed-confirm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { resetSeoPage, saveSeoPage } from "@/lib/content/admin-api";
import type {
  SeoContrast,
  SeoCta,
  SeoDownload,
  SeoFaq,
  SeoFeatures,
  SeoHero,
  SeoHowItWorks,
  SeoLandingPageDef,
  SeoVisual,
} from "@/lib/content/seo-pages/types";
import { cn } from "@/lib/utils";

/**
 * The keyword landing-page editor — same shape as `LandingEditor`, one page at a
 * time: a rail of sections on the left, the selected section's form on the right.
 *
 * The rail is **fixed**. A keyword page is an argument told in order (hook →
 * why the obvious alternative fails → proof → mechanics → objections → ask), and
 * the FAQ block is also the page's FAQPage structured data. Letting the team
 * reorder or hide sections here would let them ship a page that reads worse than
 * no page at all, so only the words are editable — exactly the trade the
 * homepage editor makes with its markup.
 *
 * Draft and published are separate: Save writes the draft (Preview renders it),
 * Publish copies draft → published and revalidates the live path.
 */

type SectionKey =
  | "meta"
  | "hero"
  | "download"
  | "contrast"
  | "features"
  | "howItWorks"
  | "faq"
  | "cta";

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: "meta", label: "Page & SEO", hint: "Name, blurb, title, description" },
  { key: "hero", label: "Hero", hint: "The fold: badge, headline, CTA" },
  { key: "download", label: "Download", hint: "The free file this page gives away" },
  { key: "contrast", label: "Contrast", hint: "Why the obvious alternative fails" },
  { key: "features", label: "Features", hint: "Three rows plus supporting cards" },
  { key: "howItWorks", label: "How it works", hint: "The steps on the ring" },
  { key: "faq", label: "FAQ", hint: "Accordion + FAQPage structured data" },
  { key: "cta", label: "Closing CTA", hint: "The ask at the bottom" },
];

const VISUAL_OPTIONS: { value: SeoVisual; label: string }[] = [
  { value: "app", label: "App screen" },
  { value: "reminder", label: "Reminder card" },
  { value: "widget", label: "Home-screen widget" },
];

/** Narrow a `<Select>` string back to the union without an assertion. */
function toVisual(value: string): SeoVisual {
  return value === "reminder" || value === "widget" ? value : "app";
}

export function SeoPageEditor({ initial }: { initial: SeoLandingPageDef }) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initial);
  const [page, setPage] = React.useState(initial);
  const [selectedKey, setSelectedKey] = React.useState<SectionKey>("meta");
  const [busy, setBusy] = React.useState<"draft" | "publish" | "reset" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  // Set once the reset has landed: it suppresses the unsaved-changes prompt so
  // the reload that follows isn't fought by the guard we just made moot.
  const [reloading, setReloading] = React.useState(false);

  const slug = initial.slug;
  const dirty = React.useMemo(
    () => JSON.stringify(page) !== JSON.stringify(saved),
    [page, saved],
  );
  useUnsavedGuard(dirty && !reloading);

  React.useEffect(() => {
    if (reloading) window.location.reload();
  }, [reloading]);

  const patch = React.useCallback((changes: Partial<SeoLandingPageDef>) => {
    setPage((prev) => ({ ...prev, ...changes }));
  }, []);

  const persist = React.useCallback(
    async (mode: "draft" | "publish") => {
      setBusy(mode);
      setError(null);
      try {
        // Adopt what came back rather than what was sent. A blanked field isn't
        // stored as empty — it falls back to the copy that ships in
        // `lib/content/seo-pages/`, so the server's merged page is the only
        // honest picture of what the route now renders. Keeping the local value
        // would leave the field looking empty while the live page shows text.
        const { page: stored } = await saveSeoPage(slug, page, mode);
        setPage(stored);
        setSaved(stored);
        toast({
          message:
            mode === "publish"
              ? `Published — /${slug} is live with these changes.`
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
    [page, slug, toast],
  );

  const reset = React.useCallback(async () => {
    setBusy("reset");
    setError(null);
    try {
      await resetSeoPage(slug);
      toast({ message: "Reset — the page is back to its built-in copy.", tone: "success" });
      // Reload rather than patch state back: the override is gone server-side,
      // and re-reading is the only way this screen and its badges agree with it.
      setReloading(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reset.";
      setError(message);
      toast({ message, tone: "error" });
      setBusy(null);
    }
  }, [slug, toast]);

  useSaveShortcut(() => {
    if (dirty && !busy) void persist("draft");
  });

  // The Download rail item only exists for a page that ships a file. Whether it
  // has one is a decision made in the repo, alongside the asset in `public/` —
  // the admin edits the words around the download, it doesn't invent one.
  const sections = React.useMemo(
    () => SECTIONS.filter((s) => s.key !== "download" || Boolean(page.download)),
    [page.download],
  );
  const selected = sections.find((s) => s.key === selectedKey) ?? sections[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* ---------------------------- section rail ---------------------------- */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Sections
        </p>
        <ul className="flex flex-col gap-1">
          {sections.map((section) => (
            <li key={section.key}>
              <button
                type="button"
                onClick={() => setSelectedKey(section.key)}
                aria-current={selected.key === section.key ? "true" : undefined}
                className={cn(
                  "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                  selected.key === section.key
                    ? "border-biro bg-biro-tint"
                    : "border-transparent hover:bg-surface-sunken",
                )}
              >
                <span className="block truncate text-sm text-ink">{section.label}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {section.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          The order is fixed — this page&apos;s argument depends on it, and its FAQ
          doubles as structured data.
        </p>
      </aside>

      {/* ------------------------------ section form -------------------------- */}
      <div className="min-w-0">
        <AdminSection title={selected.label}>
          <SectionForm section={selected.key} page={page} patch={patch} />
        </AdminSection>

        <AdminSection
          tone="danger"
          title="Reset to built-in copy"
          description="Drops the whole override — draft and published — so the page renders from lib/content/seo-pages/ again. There's no undo from here."
        >
          <div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={() => setConfirmReset(true)}
            >
              {busy === "reset" ? "Resetting…" : "Reset this page"}
            </Button>
          </div>
        </AdminSection>

        <SaveBar
          dirty={dirty}
          saving={busy !== null}
          error={error}
          saveLabel="Save draft"
          onSave={() => void persist("draft")}
          onReset={() => {
            setPage(saved);
            setError(null);
          }}
        >
          <a
            href={`/seoteam/preview/seo-page/${slug}`}
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

      <TypedConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset this page to its built-in copy?"
        message={`Every edit to /${slug} is discarded, published and draft alike, and the page goes back to the copy in the repo. A revision snapshot is kept in Activity.`}
        phrase={slug}
        confirmLabel="Reset the page"
        onConfirm={() => void reset()}
      />
    </div>
  );
}

/* ------------------------------- section forms ---------------------------- */

function SectionForm({
  section,
  page,
  patch,
}: {
  section: SectionKey;
  page: SeoLandingPageDef;
  patch: (changes: Partial<SeoLandingPageDef>) => void;
}) {
  switch (section) {
    case "meta":
      return <MetaForm page={page} patch={patch} />;
    case "hero":
      return <HeroForm hero={page.hero} patch={(hero) => patch({ hero })} />;
    case "download":
      return page.download ? (
        <DownloadForm download={page.download} patch={(download) => patch({ download })} />
      ) : null;
    case "contrast":
      return (
        <ContrastForm contrast={page.contrast} patch={(contrast) => patch({ contrast })} />
      );
    case "features":
      return (
        <FeaturesForm features={page.features} patch={(features) => patch({ features })} />
      );
    case "howItWorks":
      return (
        <HowItWorksForm
          howItWorks={page.howItWorks}
          patch={(howItWorks) => patch({ howItWorks })}
        />
      );
    case "faq":
      return <FaqForm faq={page.faq} patch={(faq) => patch({ faq })} />;
    case "cta":
      return <CtaForm cta={page.cta} patch={(cta) => patch({ cta })} />;
    default:
      return null;
  }
}

function MetaForm({
  page,
  patch,
}: {
  page: SeoLandingPageDef;
  patch: (changes: Partial<SeoLandingPageDef>) => void;
}) {
  return (
    <>
      <p className="rounded-md border border-border-subtle bg-surface-sunken/50 p-3 text-xs text-ink-muted">
        The path is <code className="text-ink">/{page.slug}</code> and can&apos;t be
        changed here — it&apos;s the route file&apos;s name and every link into the
        cluster points at it.
      </p>
      <FieldGrid>
        <TextRow
          label="Short name"
          value={page.label}
          max={40}
          onChange={(label) => patch({ label })}
          helper="Used in the footer, the breadcrumb, and the sibling cards on the other pages."
        />
        <TextRow
          label="Blurb"
          value={page.blurb}
          max={110}
          onChange={(blurb) => patch({ blurb })}
          helper="The one line under the name on those sibling cards."
        />
      </FieldGrid>
      <TextRow
        label="Title tag"
        value={page.title}
        min={30}
        max={60}
        onChange={(title) => patch({ title })}
        helper="Used verbatim — these pages opt out of the “· Birthday Reminders” template, so include the brand yourself."
      />
      <TextAreaRow
        label="Meta description"
        value={page.description}
        min={120}
        max={160}
        rows={3}
        onChange={(description) => patch({ description })}
      />
      <KeywordsRow values={page.keywords} onChange={(keywords) => patch({ keywords })} />
      <p className="text-xs text-ink-muted">
        Title, description and keywords here are this route&apos;s <em>defaults</em>.
        Anything set for <code>/{page.slug}</code> on the Page SEO screen
        (<code>/seoteam/meta</code>) wins over them, so check there first if an edit
        doesn&apos;t show up in the SERP preview.
      </p>
    </>
  );
}

function HeroForm({
  hero,
  patch,
}: {
  hero: SeoHero;
  patch: (next: SeoHero) => void;
}) {
  const lead = hero.visuals[0] ?? "app";
  const second = hero.visuals[1];

  return (
    <>
      <TextRow
        label="Badge"
        value={hero.badge}
        max={45}
        onChange={(badge) => patch({ ...hero, badge })}
        helper="The small pill above the ring. Leave blank to hide it."
      />
      <TextRow
        label="Heading"
        value={hero.heading}
        max={70}
        onChange={(heading) => patch({ ...hero, heading })}
        helper="The page's only H1 — lead with the keyword it targets."
      />
      <TextAreaRow
        label="Sub-heading"
        value={hero.subheading}
        rows={3}
        onChange={(subheading) => patch({ ...hero, subheading })}
      />
      <fieldset className="rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Primary button
        </legend>
        <FieldGrid>
          <TextRow
            label="Label"
            value={hero.primaryCta.label}
            onChange={(label) => patch({ ...hero, primaryCta: { ...hero.primaryCta, label } })}
            helper="Leave blank to hide this button."
          />
          <TextRow
            label="Link"
            value={hero.primaryCta.href}
            placeholder="/signup"
            onChange={(href) => patch({ ...hero, primaryCta: { ...hero.primaryCta, href } })}
          />
        </FieldGrid>
        <p className="mt-2 text-xs text-ink-muted">
          The second hero button is always “See how it works”, jumping to the steps —
          it isn&apos;t editable.
        </p>
      </fieldset>
      <TextRow
        label="Footnote"
        value={hero.footnote}
        onChange={(footnote) => patch({ ...hero, footnote })}
        helper="The reassurance line under the buttons, e.g. “Free on web, iOS, and Android.”"
      />
      <FieldGrid>
        <div>
          <Label>First product shot</Label>
          <Select
            value={lead}
            aria-label="First product shot"
            onChange={(e) =>
              patch({
                ...hero,
                visuals: second ? [toVisual(e.target.value), second] : [toVisual(e.target.value)],
              })
            }
          >
            {VISUAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-ink-muted">Always visible, phone included.</p>
        </div>
        <div>
          <Label>Second product shot</Label>
          <Select
            value={second ?? "none"}
            aria-label="Second product shot"
            onChange={(e) =>
              patch({
                ...hero,
                visuals:
                  e.target.value === "none" ? [lead] : [lead, toVisual(e.target.value)],
              })
            }
          >
            <option value="none">None</option>
            {VISUAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-ink-muted">
            Hidden on small screens, so the fold stays copy-first on a phone.
          </p>
        </div>
      </FieldGrid>
    </>
  );
}

function DownloadForm({
  download,
  patch,
}: {
  download: SeoDownload;
  patch: (next: SeoDownload) => void;
}) {
  return (
    <>
      <p className="rounded-md border border-border-subtle bg-surface-sunken/50 p-3 text-xs text-ink-muted">
        The band under the hero. The <strong className="text-ink">file itself</strong> lives
        in the repo at <code className="text-ink">website/public/</code> — changing the link
        here to a file that isn&apos;t there gives visitors a 404 where the page promises a
        download, so only change it alongside a deploy that ships the new file.
      </p>
      <TextRow
        label="Heading"
        value={download.heading}
        max={70}
        onChange={(heading) => patch({ ...download, heading })}
      />
      <TextAreaRow
        label="Body"
        value={download.body}
        rows={3}
        onChange={(body) => patch({ ...download, body })}
      />
      <fieldset className="rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          The file
        </legend>
        <FieldGrid>
          <TextRow
            label="Button label"
            value={download.ctaLabel}
            onChange={(ctaLabel) => patch({ ...download, ctaLabel })}
          />
          <TextRow
            label="File path"
            value={download.href}
            placeholder="/birthday-tracker-printable.pdf"
            onChange={(href) => patch({ ...download, href })}
            helper="Served straight from public/ — no route sits in between."
          />
        </FieldGrid>
        <FieldGrid>
          <TextRow
            label="Save-as name"
            value={download.fileName}
            placeholder="birthday-tracker-printable.pdf"
            onChange={(fileName) => patch({ ...download, fileName })}
            helper="What the browser calls the file once saved."
          />
          <TextRow
            label="File details"
            value={download.meta}
            placeholder="PDF · 1 page · US Letter and A4"
            onChange={(meta) => patch({ ...download, meta })}
            helper="The small print under the button. Keep it true to the file."
          />
        </FieldGrid>
      </fieldset>
      <div>
        <BulletListEditor
          values={download.points}
          onChange={(points) => patch({ ...download, points })}
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          What&apos;s actually in the file — these are the claims a visitor checks the
          moment it opens, so they have to match it.
        </p>
      </div>
      <fieldset className="rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Secondary link
        </legend>
        <FieldGrid>
          <TextRow
            label="Label"
            value={download.secondaryCta.label}
            onChange={(label) =>
              patch({ ...download, secondaryCta: { ...download.secondaryCta, label } })
            }
            helper="Leave blank to hide it — the “or do it digitally instead” escape hatch."
          />
          <TextRow
            label="Link"
            value={download.secondaryCta.href}
            placeholder="/signup"
            onChange={(href) =>
              patch({ ...download, secondaryCta: { ...download.secondaryCta, href } })
            }
          />
        </FieldGrid>
      </fieldset>
    </>
  );
}

function ContrastForm({
  contrast,
  patch,
}: {
  contrast: SeoContrast;
  patch: (next: SeoContrast) => void;
}) {
  const parts = contrast.headingParts;
  const set = (key: keyof SeoContrast["headingParts"], value: string) =>
    patch({ ...contrast, headingParts: { ...parts, [key]: value } });

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
          helper="Rendered in the muted ink colour — usually the thing this page argues against."
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
        value={contrast.body}
        onChange={(body) => patch({ ...contrast, body })}
      />
    </>
  );
}

function FeaturesForm({
  features,
  patch,
}: {
  features: SeoFeatures;
  patch: (next: SeoFeatures) => void;
}) {
  // Each of the three shots earns its place on the page: the app screen, the
  // reminder, the widget. Covering the same one twice reads as padding, so the
  // mismatch is surfaced — but never blocks a save, because a half-written page
  // has to be storable.
  const previews = features.rows.map((row) => row.preview);
  const missing = VISUAL_OPTIONS.map((o) => o.value).filter((v) => !previews.includes(v));
  const coverageOff = features.rows.length !== 3 || missing.length > 0;

  return (
    <>
      <TextRow
        label="Heading"
        value={features.heading}
        onChange={(heading) => patch({ ...features, heading })}
      />
      <TextAreaRow
        label="Sub-heading"
        value={features.sub}
        rows={3}
        onChange={(sub) => patch({ ...features, sub })}
      />

      <div>
        <Label>Feature rows</Label>
        {coverageOff && (
          <p className="mb-2 flex items-start gap-1.5 rounded-md border border-warn-fg/30 bg-warn-bg px-3 py-2 text-xs text-warn-fg">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              These pages are built around three rows, one per product shot.
              {features.rows.length !== 3 &&
                ` There ${features.rows.length === 1 ? "is" : "are"} ${features.rows.length}.`}
              {missing.length > 0 &&
                ` Nothing shows the ${missing.join(" or the ")} shot.`}{" "}
              It will still save and render.
            </span>
          </p>
        )}
        <ListEditor
          items={features.rows}
          onChange={(rows) => patch({ ...features, rows })}
          keyFor={(row) => row.id}
          titleFor={(row) => row.title || row.eyebrow}
          subtitleFor={(row) =>
            VISUAL_OPTIONS.find((o) => o.value === row.preview)?.label
          }
          max={6}
          addLabel="Add feature row"
          emptyLabel="No feature rows."
          onCreate={() => ({
            id: newId("row"),
            icon: "Sparkles",
            eyebrow: "",
            title: "",
            body: "",
            points: [],
            preview: missing[0] ?? "app",
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
              <div>
                <Label>Product shot</Label>
                <Select
                  value={row.preview}
                  aria-label="Product shot"
                  onChange={(e) => patchRow({ preview: toVisual(e.target.value) })}
                >
                  {VISUAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-ink-muted">
                  Rows alternate sides automatically — the first sits image-right.
                </p>
              </div>
            </>
          )}
        />
      </div>

      <div>
        <Label>Feature cards</Label>
        <p className="mb-2 text-xs text-ink-muted">
          The supporting grid under the rows. Unlike the homepage&apos;s cards, these
          keep their bullet points.
        </p>
        <ListEditor
          items={features.cards}
          onChange={(cards) => patch({ ...features, cards })}
          keyFor={(card) => card.id}
          titleFor={(card) => card.title}
          subtitleFor={(card) =>
            card.points.length > 0 ? `${card.points.length} points` : undefined
          }
          max={24}
          addLabel="Add feature card"
          emptyLabel="No feature cards."
          onCreate={() => ({
            id: newId("card"),
            icon: "Sparkles",
            title: "",
            body: "",
            points: [],
          })}
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
              <BulletListEditor
                values={card.points}
                onChange={(points) => patchCard({ points })}
              />
            </>
          )}
        />
      </div>
    </>
  );
}

function HowItWorksForm({
  howItWorks,
  patch,
}: {
  howItWorks: SeoHowItWorks;
  patch: (next: SeoHowItWorks) => void;
}) {
  return (
    <>
      <TextRow
        label="Heading"
        value={howItWorks.heading}
        onChange={(heading) => patch({ ...howItWorks, heading })}
      />
      <div>
        <Label>Steps</Label>
        <ListEditor
          items={howItWorks.steps}
          onChange={(steps) => patch({ ...howItWorks, steps })}
          keyFor={(step) => step.id}
          titleFor={(step) => step.title}
          subtitleFor={(step) =>
            step.offset === 0
              ? "today"
              : `${Math.abs(step.offset)} days ${step.offset < 0 ? "before" : "after"}`
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

function FaqForm({ faq, patch }: { faq: SeoFaq; patch: (next: SeoFaq) => void }) {
  return (
    <>
      <TextRow
        label="Heading"
        value={faq.heading}
        onChange={(heading) => patch({ ...faq, heading })}
      />
      <TextAreaRow
        label="Sub-heading"
        value={faq.sub}
        rows={3}
        onChange={(sub) => patch({ ...faq, sub })}
      />
      <div>
        <Label>Questions</Label>
        <p className="mb-2 text-xs text-ink-muted">
          This list is the single source for both the visible accordion and the FAQPage
          structured data, so the two can never drift apart.
        </p>
        <ListEditor
          items={faq.items}
          onChange={(items) => patch({ ...faq, items })}
          keyFor={(item) => item.id}
          titleFor={(item) => item.q}
          max={50}
          addLabel="Add question"
          emptyLabel="No questions yet."
          onCreate={() => ({ id: newId("faq"), q: "", a: "" })}
          renderItem={(item, _index, patchItem) => (
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
}

function CtaForm({ cta, patch }: { cta: SeoCta; patch: (next: SeoCta) => void }) {
  return (
    <>
      <TextRow
        label="Heading"
        value={cta.heading}
        onChange={(heading) => patch({ ...cta, heading })}
      />
      <TextAreaRow
        label="Body"
        value={cta.body}
        onChange={(body) => patch({ ...cta, body })}
      />
      <FieldGrid>
        <TextRow
          label="Button label"
          value={cta.ctaLabel}
          onChange={(ctaLabel) => patch({ ...cta, ctaLabel })}
        />
        <TextRow
          label="Button link"
          value={cta.ctaHref}
          placeholder="/signup"
          onChange={(ctaHref) => patch({ ...cta, ctaHref })}
        />
      </FieldGrid>
      <TextRow
        label="Footnote"
        value={cta.footnote}
        onChange={(footnote) => patch({ ...cta, footnote })}
        helper="Sits under the app store badges, which this section always shows."
      />
    </>
  );
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Keywords are a `string[]` in the model but a comma-separated line in the UI.
 *
 * The typed text is kept alongside, because parsing on every keystroke would eat
 * the comma the moment it's typed. Which of the two renders is *derived*, not
 * synced: the draft wins only while it still parses to the array in the model,
 * so a Discard (which replaces that array) drops back to the model's text with
 * no effect and no stale state.
 */
function KeywordsRow({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const text =
    draft !== null && sameList(parseKeywords(draft), values)
      ? draft
      : values.join(", ");

  return (
    <TextRow
      label="Keywords"
      value={text}
      onChange={(next) => {
        setDraft(next);
        onChange(parseKeywords(next));
      }}
      placeholder="birthday calendar, birthday calendar app"
      helper="Comma-separated. Stored as a list; the meta keywords tag is long dead, but these drive the page's default keyword set."
    />
  );
}

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
