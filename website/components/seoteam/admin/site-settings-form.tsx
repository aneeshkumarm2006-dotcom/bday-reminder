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
import { SaveBar, useSaveShortcut, useUnsavedGuard } from "@/components/seoteam/admin/save-bar";
import { TypedConfirmDialog } from "@/components/seoteam/admin/typed-confirm";
import { Input, Label } from "@/components/ui/input";
import { Switch, ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveSiteSettings } from "@/lib/content/admin-api";
import { DEFAULT_SETTINGS } from "@/lib/content/defaults";
import type { SiteSettings } from "@/lib/content/types";

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
        <FieldGrid>
          <TextRow
            label="Default OG image URL"
            value={draft.seo.ogImage}
            helper="Leave blank to keep the generated Open Graph image."
            onChange={(ogImage) => patch("seo", { ...draft.seo, ogImage })}
          />
          <TextRow
            label="Twitter handle"
            value={draft.seo.twitterHandle}
            placeholder="@birthdayreminders"
            onChange={(twitterHandle) => patch("seo", { ...draft.seo, twitterHandle })}
          />
        </FieldGrid>
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
