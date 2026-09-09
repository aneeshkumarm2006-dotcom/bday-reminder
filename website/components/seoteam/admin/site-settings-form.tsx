"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import {
  StringListEditor,
  TextAreaRow,
  TextRow,
} from "@/components/seoteam/admin/fields";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import { MediaPickerField } from "@/components/seoteam/admin/media-picker";
import { SaveBar, useSaveShortcut, useUnsavedGuard } from "@/components/seoteam/admin/save-bar";
import { TypedConfirmDialog } from "@/components/seoteam/admin/typed-confirm";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch, ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveSiteSettings } from "@/lib/content/admin-api";
import { DEFAULT_SETTINGS } from "@/lib/content/defaults";
import type {
  AppearanceConfig,
  ProductDemoConfig,
  SiteSettings,
  StoreBadgeConfig,
} from "@/lib/content/types";

/**
 * The sitewide settings editor. Every field here is an *override*: leaving one
 * blank falls back to `lib/content/defaults.ts` at render time, which is why
 * the inputs show the built-in value as their placeholder and the Reset button
 * simply clears them.
 */
export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState<SiteSettings>(initial);
  const [draft, setDraft] = React.useState<SiteSettings>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmNoindex, setConfirmNoindex] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );
  useUnsavedGuard(dirty);

  const patch = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const patchAppearance = (changes: Partial<AppearanceConfig>) =>
    setDraft((prev) => ({ ...prev, appearance: { ...prev.appearance, ...changes } }));

  const patchDemo = (changes: Partial<ProductDemoConfig>) =>
    setDraft((prev) => ({ ...prev, productDemo: { ...prev.productDemo, ...changes } }));

  const patchDemoReminder = (changes: Partial<ProductDemoConfig["reminder"]>) =>
    setDraft((prev) => ({
      ...prev,
      productDemo: {
        ...prev.productDemo,
        reminder: { ...prev.productDemo.reminder, ...changes },
      },
    }));

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveSiteSettings(draft);
      setSaved(next);
      setDraft(next);
      toast({ message: "Site settings saved.", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      setError(message);
      toast({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, toast]);

  useSaveShortcut(() => {
    if (dirty && !saving) void save();
  });

  return (
    <>
      <AdminSection
        title="Identity"
        description="The product's name and one-line pitch. Used in the title template, JSON-LD, the manifest, and the footer."
      >
        <FieldGrid>
          <TextRow
            label="Site name"
            value={draft.identity.name}
            defaultHint={DEFAULT_SETTINGS.identity.name}
            onChange={(name) => patch("identity", { ...draft.identity, name })}
          />
          <TextRow
            label="Tagline"
            value={draft.identity.tagline}
            defaultHint={DEFAULT_SETTINGS.identity.tagline}
            onChange={(tagline) => patch("identity", { ...draft.identity, tagline })}
          />
        </FieldGrid>
        <TextAreaRow
          label="Description"
          value={draft.identity.description}
          min={120}
          max={300}
          onChange={(description) => patch("identity", { ...draft.identity, description })}
          helper="The fallback meta description and the description in structured data."
        />
        <TextRow
          label="Contact email"
          type="email"
          value={draft.identity.contactEmail}
          defaultHint={DEFAULT_SETTINGS.identity.contactEmail}
          onChange={(contactEmail) => patch("identity", { ...draft.identity, contactEmail })}
        />
      </AdminSection>

      <AdminSection
        title="Brand"
        description="The wordmark in the header and footer. With no logo it stays the drawn ring plus the site name."
      >
        <MediaPickerField
          label="Logo"
          value={draft.brand.logoUrl}
          onChange={(logoUrl) => patch("brand", { ...draft.brand, logoUrl })}
          helper="Replaces the ring. SVG or a transparent PNG works best."
        />
        <MediaPickerField
          label="Logo for dark mode"
          value={draft.brand.logoDarkUrl}
          onChange={(logoDarkUrl) => patch("brand", { ...draft.brand, logoDarkUrl })}
          helper="Optional. Swapped in by CSS, so it can't flash the wrong one."
        />
        <FieldGrid>
          <TextRow
            label="Logo alt text"
            value={draft.brand.logoAlt}
            onChange={(logoAlt) => patch("brand", { ...draft.brand, logoAlt })}
            helper="Falls back to the site name."
          />
          <div>
            <Label htmlFor="logo-height">Logo height (px)</Label>
            <Input
              id="logo-height"
              type="number"
              min={16}
              max={120}
              value={String(draft.brand.logoHeight)}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                patch("brand", {
                  ...draft.brand,
                  logoHeight: Number.isFinite(parsed) ? parsed : 28,
                });
              }}
            />
            <p className="mt-1.5 text-xs text-ink-muted">Width follows the image.</p>
          </div>
        </FieldGrid>
        <TextRow
          label="Wordmark"
          value={draft.brand.wordmark}
          onChange={(wordmark) => patch("brand", { ...draft.brand, wordmark })}
          helper="Overrides the site name in the header and footer only."
          defaultHint={DEFAULT_SETTINGS.identity.name}
        />
        <ToggleRow
          label="Show the ring"
          description="The date-ring mark beside the name. Ignored when a logo is set."
          checked={draft.brand.showRing}
          onCheckedChange={(showRing) => patch("brand", { ...draft.brand, showRing })}
        />
        <ToggleRow
          label="Show the name"
          description="Turn off for a logo-only lockup."
          checked={draft.brand.showWordmark}
          onCheckedChange={(showWordmark) => patch("brand", { ...draft.brand, showWordmark })}
        />
        <MediaPickerField
          label="Favicon"
          value={draft.brand.faviconUrl}
          onChange={(faviconUrl) => patch("brand", { ...draft.brand, faviconUrl })}
          helper="The browser-tab icon. Blank keeps the drawn ring, which circles today's date."
        />
      </AdminSection>

      <AdminSection
        title="Appearance"
        description="Colour and shape for the public site. The admin panel and the signed-in app keep the built-in palette."
      >
        <FieldGrid>
          <ColorRow
            label="Accent colour"
            value={draft.appearance.accent}
            onChange={(accent) => patchAppearance({ accent })}
            helper="Buttons, links and highlights. Blank keeps the built-in blue."
          />
          <ColorRow
            label="Accent in dark mode"
            value={draft.appearance.accentDark}
            onChange={(accentDark) => patchAppearance({ accentDark })}
            helper="Blank reuses the light-mode accent."
          />
        </FieldGrid>
        <FieldGrid>
          <div>
            <Label htmlFor="radius">Corner radius (px)</Label>
            <Input
              id="radius"
              type="number"
              min={0}
              max={32}
              value={String(draft.appearance.radius)}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                patchAppearance({ radius: Number.isFinite(parsed) ? parsed : 0 });
              }}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              0 keeps the built-in scale. The rest of the scale follows this value.
            </p>
          </div>
          <div>
            <Label htmlFor="default-theme">Theme for new visitors</Label>
            <Select
              id="default-theme"
              value={draft.appearance.defaultTheme}
              onChange={(e) =>
                patchAppearance({
                  defaultTheme: e.target.value as AppearanceConfig["defaultTheme"],
                })
              }
            >
              <option value="system">Match their device</option>
              <option value="light">Always light</option>
              <option value="dark">Always dark</option>
            </Select>
            <p className="mt-1.5 text-xs text-ink-muted">
              A returning visitor&apos;s own choice still wins.
            </p>
          </div>
        </FieldGrid>
        <ToggleRow
          label="Show the theme toggle"
          description="The light/dark switch in the public header."
          checked={draft.appearance.showThemeToggle}
          onCheckedChange={(showThemeToggle) => patchAppearance({ showThemeToggle })}
        />
        <ToggleRow
          label="Entrance animations"
          description="The quiet fade-and-rise as sections come in."
          checked={draft.appearance.animations}
          onCheckedChange={(animations) => patchAppearance({ animations })}
        />
      </AdminSection>

      <AdminSection
        title="App stores"
        description="The two badges under “Get the app”. Each stays a “coming soon” chip until you give it a link."
      >
        <StoreBadgeFields
          legend="App Store"
          value={draft.appStores.appStore}
          onChange={(appStore) => patch("appStores", { ...draft.appStores, appStore })}
        />
        <StoreBadgeFields
          legend="Google Play"
          value={draft.appStores.googlePlay}
          onChange={(googlePlay) => patch("appStores", { ...draft.appStores, googlePlay })}
        />
      </AdminSection>

      <AdminSection
        title="Product demo"
        description="The interactive “screenshots” on the homepage and every keyword page. They're drawn from the real design system, so this is their sample data, not an image."
      >
        <FieldGrid>
          <TextRow
            label="Feed title"
            value={draft.productDemo.feedTitle}
            defaultHint={DEFAULT_SETTINGS.productDemo.feedTitle}
            onChange={(feedTitle) => patchDemo({ feedTitle })}
          />
          <TextRow
            label="Widget title"
            value={draft.productDemo.widgetTitle}
            defaultHint={DEFAULT_SETTINGS.productDemo.widgetTitle}
            onChange={(widgetTitle) => patchDemo({ widgetTitle })}
          />
        </FieldGrid>
        <FieldGrid>
          <TextRow
            label="“This week” label"
            value={draft.productDemo.thisWeekLabel}
            defaultHint={DEFAULT_SETTINGS.productDemo.thisWeekLabel}
            onChange={(thisWeekLabel) => patchDemo({ thisWeekLabel })}
          />
          <TextRow
            label="“This month” label"
            value={draft.productDemo.thisMonthLabel}
            defaultHint={DEFAULT_SETTINGS.productDemo.thisMonthLabel}
            onChange={(thisMonthLabel) => patchDemo({ thisMonthLabel })}
          />
        </FieldGrid>
        <FieldGrid>
          <TextRow
            label="Count on the day"
            value={draft.productDemo.todayLabel}
            defaultHint={DEFAULT_SETTINGS.productDemo.todayLabel}
            onChange={(todayLabel) => patchDemo({ todayLabel })}
          />
          <TextRow
            label="Count before the day"
            value={draft.productDemo.inDaysLabel}
            defaultHint={DEFAULT_SETTINGS.productDemo.inDaysLabel}
            onChange={(inDaysLabel) => patchDemo({ inDaysLabel })}
            helper="{n} is the number of days."
          />
        </FieldGrid>

        <div>
          <Label>People in the demo</Label>
          <p className="mb-2 text-xs text-ink-muted">
            The dates are relative to whoever is looking, so the demo is never stale.
            The widget shows the first three.
          </p>
          <ListEditor
            items={draft.productDemo.rows}
            onChange={(rows) => patchDemo({ rows })}
            keyFor={(row) => row.id}
            titleFor={(row) => row.name || "Person"}
            subtitleFor={(row) => (row.offset === 0 ? "today" : `+${row.offset} days`)}
            max={6}
            addLabel="Add a person"
            emptyLabel="No one yet — the demo falls back to its built-in cast."
            onCreate={() => ({
              id: newId("demo"),
              name: "",
              sub: "",
              offset: 1,
              pet: false,
            })}
            renderItem={(row, _i, patchRow) => (
              <>
                <FieldGrid>
                  <TextRow
                    label="Name"
                    value={row.name}
                    onChange={(name) => patchRow({ name })}
                  />
                  <TextRow
                    label="Second line"
                    value={row.sub}
                    placeholder="Brother · turns 29"
                    onChange={(sub) => patchRow({ sub })}
                  />
                </FieldGrid>
                <div>
                  <Label htmlFor={`demo-offset-${row.id}`}>Days from today</Label>
                  <Input
                    id={`demo-offset-${row.id}`}
                    type="number"
                    min={0}
                    max={365}
                    value={String(row.offset)}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      patchRow({ offset: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 });
                    }}
                  />
                  <p className="mt-1.5 text-xs text-ink-muted">
                    0 is today — that row gets the filled ring. Seven or fewer groups
                    under “this week”.
                  </p>
                </div>
                <ToggleRow
                  label="This one's a pet"
                  checked={row.pet}
                  onCheckedChange={(pet) => patchRow({ pet })}
                />
              </>
            )}
          />
        </div>

        <fieldset className="rounded-md border border-border-subtle p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Reminder card
          </legend>
          <TextRow
            label="Headline"
            value={draft.productDemo.reminder.headline}
            defaultHint={DEFAULT_SETTINGS.productDemo.reminder.headline}
            onChange={(headline) => patchDemoReminder({ headline })}
          />
          <FieldGrid>
            <TextRow
              label="Relationship"
              value={draft.productDemo.reminder.relation}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.relation}
              onChange={(relation) => patchDemoReminder({ relation })}
            />
            <TextRow
              label="Greeting"
              value={draft.productDemo.reminder.greeting}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.greeting}
              onChange={(greeting) => patchDemoReminder({ greeting })}
            />
          </FieldGrid>
          <FieldGrid>
            <TextRow
              label="Send button"
              value={draft.productDemo.reminder.sendLabel}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.sendLabel}
              onChange={(sendLabel) => patchDemoReminder({ sendLabel })}
            />
            <TextRow
              label="Done button"
              value={draft.productDemo.reminder.doneLabel}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.doneLabel}
              onChange={(doneLabel) => patchDemoReminder({ doneLabel })}
            />
          </FieldGrid>
          <FieldGrid>
            <TextRow
              label="Undo label"
              value={draft.productDemo.reminder.undoLabel}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.undoLabel}
              onChange={(undoLabel) => patchDemoReminder({ undoLabel })}
            />
            <TextRow
              label="Cancel label"
              value={draft.productDemo.reminder.cancelLabel}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.cancelLabel}
              onChange={(cancelLabel) => patchDemoReminder({ cancelLabel })}
            />
          </FieldGrid>
          <FieldGrid>
            <TextRow
              label="Delivered label"
              value={draft.productDemo.reminder.deliveredLabel}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.deliveredLabel}
              onChange={(deliveredLabel) => patchDemoReminder({ deliveredLabel })}
            />
            <TextRow
              label="“Send another” label"
              value={draft.productDemo.reminder.againLabel}
              defaultHint={DEFAULT_SETTINGS.productDemo.reminder.againLabel}
              onChange={(againLabel) => patchDemoReminder({ againLabel })}
            />
          </FieldGrid>
        </fieldset>
      </AdminSection>

      <AdminSection
        title="SEO defaults"
        description="What every page inherits unless it has its own override in Meta."
      >
        <FieldGrid>
          <TextRow
            label="Title template"
            value={draft.seo.titleTemplate}
            defaultHint={DEFAULT_SETTINGS.seo.titleTemplate}
            helper="Must contain %s — the page's own title is substituted in."
            onChange={(titleTemplate) => patch("seo", { ...draft.seo, titleTemplate })}
          />
          <TextRow
            label="Default title"
            value={draft.seo.defaultTitle}
            min={50}
            max={60}
            defaultHint={DEFAULT_SETTINGS.seo.defaultTitle}
            onChange={(defaultTitle) => patch("seo", { ...draft.seo, defaultTitle })}
          />
        </FieldGrid>
        <TextAreaRow
          label="Default description"
          value={draft.seo.defaultDescription}
          min={150}
          max={160}
          onChange={(defaultDescription) =>
            patch("seo", { ...draft.seo, defaultDescription })
          }
        />
        <StringListEditor
          label="Default keywords"
          values={draft.seo.keywords}
          onChange={(keywords) => patch("seo", { ...draft.seo, keywords })}
          helper="Applied sitewide. Per-page keywords replace these in the Meta editor."
        />
        <MediaPickerField
          label="Default social image"
          value={draft.seo.ogImage}
          onChange={(ogImage) => patch("seo", { ...draft.seo, ogImage })}
          helper="Shown when a page is shared. Blank uses the generated card below."
        />
        <fieldset className="rounded-md border border-border-subtle p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Generated card
          </legend>
          <p className="mb-3 text-xs text-ink-muted">
            The card drawn at <code>/opengraph-image</code> — a ring on today&apos;s
            date, the site name, and these two lines. Only used while no image is set
            above.
          </p>
          <TextRow
            label="Headline"
            value={draft.seo.ogHeadline}
            defaultHint={DEFAULT_SETTINGS.seo.ogHeadline}
            onChange={(ogHeadline) => patch("seo", { ...draft.seo, ogHeadline })}
          />
          <TextRow
            label="Sub-line"
            value={draft.seo.ogSubline}
            defaultHint={DEFAULT_SETTINGS.seo.ogSubline}
            onChange={(ogSubline) => patch("seo", { ...draft.seo, ogSubline })}
          />
        </fieldset>
        <TextRow
          label="Twitter handle"
          value={draft.seo.twitterHandle}
          placeholder="@birthdayreminders"
          onChange={(twitterHandle) => patch("seo", { ...draft.seo, twitterHandle })}
        />
        <FieldGrid>
          <TextRow
            label="Google verification"
            value={draft.seo.verification.google}
            defaultHint={DEFAULT_SETTINGS.seo.verification.google}
            onChange={(google) =>
              patch("seo", {
                ...draft.seo,
                verification: { ...draft.seo.verification, google },
              })
            }
          />
          <TextRow
            label="Bing verification"
            value={draft.seo.verification.bing}
            onChange={(bing) =>
              patch("seo", {
                ...draft.seo,
                verification: { ...draft.seo.verification, bing },
              })
            }
          />
        </FieldGrid>
        <TextRow
          label="Pinterest verification"
          value={draft.seo.verification.pinterest}
          onChange={(pinterest) =>
            patch("seo", {
              ...draft.seo,
              verification: { ...draft.seo.verification, pinterest },
            })
          }
        />
      </AdminSection>

      <AdminSection
        title="Analytics"
        description="IDs only. They're interpolated into fixed script templates — there is deliberately no raw-script field."
      >
        <FieldGrid>
          <TextRow
            label="GA4 measurement ID"
            value={draft.analytics.ga4MeasurementId}
            placeholder="G-XXXXXXXXXX"
            defaultHint={DEFAULT_SETTINGS.analytics.ga4MeasurementId}
            onChange={(ga4MeasurementId) =>
              patch("analytics", { ...draft.analytics, ga4MeasurementId })
            }
          />
          <TextRow
            label="Google Tag Manager container"
            value={draft.analytics.gtmContainerId}
            placeholder="GTM-XXXXXXX"
            helper="Optional. Loads GTM instead of / alongside gtag."
            onChange={(gtmContainerId) =>
              patch("analytics", { ...draft.analytics, gtmContainerId })
            }
          />
        </FieldGrid>
        <TextRow
          label="Meta Pixel ID"
          value={draft.analytics.metaPixelId}
          placeholder="123456789012345"
          helper="Optional. Digits only."
          onChange={(metaPixelId) => patch("analytics", { ...draft.analytics, metaPixelId })}
        />
      </AdminSection>

      <AdminSection
        title="Social profiles"
        description="Shown in the footer and emitted as sameAs links in the Organization structured data."
      >
        <ListEditor
          items={draft.socials}
          onChange={(socials) => patch("socials", socials)}
          keyFor={(s) => s.id}
          titleFor={(s) => s.platform || "New profile"}
          subtitleFor={(s) => s.url}
          defaultOpen
          max={20}
          addLabel="Add social profile"
          emptyLabel="No social profiles yet."
          onCreate={() => ({
            id: newId("social"),
            platform: "",
            url: "",
            order: draft.socials.length,
          })}
          renderItem={(item, index, patchItem) => (
            <FieldGrid>
              <TextRow
                label="Platform"
                value={item.platform}
                placeholder="Instagram"
                onChange={(platform) => patchItem({ platform })}
              />
              <TextRow
                label="Profile URL"
                value={item.url}
                placeholder="https://instagram.com/…"
                onChange={(url) => patchItem({ url, order: index })}
              />
            </FieldGrid>
          )}
        />
      </AdminSection>

      <AdminSection
        title="Announcement bar"
        description="A single strip above the site header. The schedule is checked at request time — no cron, so it appears and disappears on the minute."
      >
        <ToggleRow
          label="Show the announcement bar"
          checked={draft.announcement.enabled}
          onCheckedChange={(enabled) =>
            patch("announcement", { ...draft.announcement, enabled })
          }
        />
        <TextRow
          label="Message"
          value={draft.announcement.text}
          max={140}
          onChange={(text) => patch("announcement", { ...draft.announcement, text })}
        />
        <FieldGrid>
          <TextRow
            label="Link label"
            value={draft.announcement.linkLabel}
            placeholder="Read more"
            onChange={(linkLabel) =>
              patch("announcement", { ...draft.announcement, linkLabel })
            }
          />
          <TextRow
            label="Link URL"
            value={draft.announcement.linkHref}
            placeholder="/blog/announcement"
            onChange={(linkHref) =>
              patch("announcement", { ...draft.announcement, linkHref })
            }
          />
        </FieldGrid>
        <FieldGrid>
          <DateTimeRow
            label="Starts (optional)"
            value={draft.announcement.startAt}
            onChange={(startAt) => patch("announcement", { ...draft.announcement, startAt })}
          />
          <DateTimeRow
            label="Ends (optional)"
            value={draft.announcement.endAt}
            onChange={(endAt) => patch("announcement", { ...draft.announcement, endAt })}
          />
        </FieldGrid>
        <ToggleRow
          label="Visitors can dismiss it"
          description="Remembered in their browser, per message."
          checked={draft.announcement.dismissible}
          onCheckedChange={(dismissible) =>
            patch("announcement", { ...draft.announcement, dismissible })
          }
        />
      </AdminSection>

      <AdminSection
        title="Discovery"
        description="Extra crawler rules layered on top of the built-in robots.txt."
      >
        <StringListEditor
          label="Additional Disallow paths"
          values={draft.robotsExtraDisallows}
          onChange={(robotsExtraDisallows) =>
            patch("robotsExtraDisallows", robotsExtraDisallows)
          }
          placeholder="/some-path"
          helper="Each entry is normalized to a leading slash."
        />
        <ToggleRow
          label="Publish /llms.txt"
          description="A plain-text site summary for AI crawlers (name, description, key pages, blog index)."
          checked={draft.llmsTxtEnabled}
          onCheckedChange={(llmsTxtEnabled) => patch("llmsTxtEnabled", llmsTxtEnabled)}
        />
      </AdminSection>

      <AdminSection
        title="Danger zone"
        tone="danger"
        description="One switch that can remove the entire site from search results."
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
              <AlertTriangle size={16} className="text-danger-fg" aria-hidden="true" />
              Allow search engines to index this site
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Turning this off adds <code>noindex, nofollow</code> to every page and makes
              robots.txt disallow everything. Recovery takes weeks of re-crawling.
            </p>
          </div>
          <Switch
            checked={draft.seo.indexingEnabled}
            aria-label="Allow search engines to index this site"
            onCheckedChange={(next) => {
              if (next) {
                patch("seo", { ...draft.seo, indexingEnabled: true });
              } else {
                setConfirmNoindex(true);
              }
            }}
          />
        </div>
        {!draft.seo.indexingEnabled && (
          <p className="rounded-md border border-danger-fg/40 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
            This site is currently set to <strong>noindex</strong>. Save to apply, or turn
            the switch back on.
          </p>
        )}
      </AdminSection>

      <TypedConfirmDialog
        open={confirmNoindex}
        onClose={() => setConfirmNoindex(false)}
        title="Remove the site from search?"
        message="Every page will be served with noindex, nofollow and robots.txt will disallow all crawling. Rankings take weeks to recover."
        phrase={saved.identity.name || DEFAULT_SETTINGS.identity.name}
        confirmLabel="Set the site to noindex"
        onConfirm={() => patch("seo", { ...draft.seo, indexingEnabled: false })}
      />

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={() => void save()}
        onReset={() => {
          setDraft(saved);
          setError(null);
        }}
      />
    </>
  );
}

/**
 * `datetime-local` speaks "YYYY-MM-DDTHH:mm" in the *browser's* zone while we
 * store ISO UTC, so both directions convert explicitly rather than slicing the
 * string (which silently shifts the time by the viewer's offset).
 */
function DateTimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const id = React.useId();
  const local = React.useMemo(() => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }, [value]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={local}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) return onChange(null);
          const date = new Date(raw);
          onChange(Number.isNaN(date.getTime()) ? null : date.toISOString());
        }}
      />
      <p className="mt-1.5 text-xs text-ink-muted">
        {value ? "Your local time." : "No bound — leave blank to run indefinitely."}
      </p>
    </div>
  );
}

/**
 * A colour field with a swatch and a native picker beside the text input.
 *
 * The text box stays authoritative because the stored value can be any CSS
 * colour — `oklch()`, a keyword, `rgb()` — while `<input type="color">` only
 * speaks hex. The picker writes hex into the same field; typing something the
 * picker can't show simply leaves the swatch as-is rather than rewriting what
 * was typed.
 */
function ColorRow({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  helper?: string;
}) {
  const id = React.useId();
  const hex = /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "#2c4bd8";

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder="#2c4bd8"
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="color"
          aria-label={`${label} picker`}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
        />
      </div>
      {helper && <p className="mt-1.5 text-xs text-ink-muted">{helper}</p>}
    </div>
  );
}

/** One store badge: whether it's live, where it goes, and what it says. */
function StoreBadgeFields({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: StoreBadgeConfig;
  onChange: (next: StoreBadgeConfig) => void;
}) {
  return (
    <fieldset className="rounded-md border border-border-subtle p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {legend}
      </legend>
      <ToggleRow
        label="Listing is live"
        description="Off shows the “coming soon” chip, whatever the link says."
        checked={value.enabled}
        onCheckedChange={(enabled) => onChange({ ...value, enabled })}
      />
      <TextRow
        label="Store link"
        value={value.url}
        onChange={(url) => onChange({ ...value, url })}
        helper="The public listing URL."
      />
      <FieldGrid>
        <TextRow
          label="Eyebrow"
          value={value.eyebrow}
          onChange={(eyebrow) => onChange({ ...value, eyebrow })}
          helper="The small line above the name."
        />
        <TextRow
          label="Store name"
          value={value.label}
          defaultHint={legend}
          onChange={(label) => onChange({ ...value, label })}
        />
      </FieldGrid>
    </fieldset>
  );
}
