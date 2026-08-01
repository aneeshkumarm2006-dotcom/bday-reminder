"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { TextAreaRow, TextRow } from "@/components/seoteam/admin/fields";
import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import { MediaPickerField } from "@/components/seoteam/admin/media-picker";
import {
  SaveBar,
  useSaveShortcut,
  useUnsavedGuard,
} from "@/components/seoteam/admin/save-bar";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveStructuredData } from "@/lib/content/admin-api";
import { buildSiteJsonLd, structuredDataWarnings } from "@/lib/content/site-json-ld";
import type { SiteSettings } from "@/lib/content/types";
import { siteConfig } from "@/lib/site";

/**
 * Form-driven Organization / WebSite / SoftwareApplication JSON-LD.
 *
 * Form-driven rather than a JSON textarea on purpose: sitewide structured data
 * is emitted on every page, and a malformed blob there is an invisible,
 * site-wide SEO regression. (Per-page custom JSON-LD *is* a textarea — it's
 * scoped to one route and parsed + type-allowlisted before it's stored.)
 */
export function StructuredDataForm({ initial }: { initial: SiteSettings }) {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial.structuredData);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings.structuredData),
    [draft, settings],
  );
  useUnsavedGuard(dirty);

  const previewSettings = React.useMemo(
    () => ({ ...settings, structuredData: draft }),
    [settings, draft],
  );
  const warnings = structuredDataWarnings(previewSettings);
  const preview = JSON.stringify(buildSiteJsonLd(previewSettings), null, 2);

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveStructuredData(draft);
      setSettings(next);
      setDraft(next.structuredData);
      toast({ message: "Structured data saved.", tone: "success" });
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

  const org = draft.organization;
  const web = draft.website;
  const app = draft.softwareApplication;

  return (
    <>
      {warnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-warn-fg/30 bg-warn-bg p-4 text-sm text-warn-fg">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} aria-hidden="true" />
            Google may not use this markup
          </p>
          <ul className="mt-2 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <AdminSection
        title="Organization"
        description="The entity behind the site. Also used as the publisher on every blog post."
      >
        <ToggleRow
          label="Emit Organization markup"
          checked={org.enabled}
          onCheckedChange={(enabled) =>
            setDraft({ ...draft, organization: { ...org, enabled } })
          }
        />
        <FieldGrid>
          <TextRow
            label="Name"
            value={org.name}
            defaultHint={settings.identity.name}
            onChange={(name) => setDraft({ ...draft, organization: { ...org, name } })}
          />
          <TextRow
            label="Legal name (optional)"
            value={org.legalName}
            onChange={(legalName) =>
              setDraft({ ...draft, organization: { ...org, legalName } })
            }
          />
        </FieldGrid>
        <MediaPickerField
          label="Logo"
          value={org.logoUrl}
          onChange={(logoUrl) => setDraft({ ...draft, organization: { ...org, logoUrl } })}
          helper="Google wants a square logo of at least 112×112. The generated /icons/512 route works."
        />
        <TextAreaRow
          label="Description"
          value={org.description}
          rows={3}
          onChange={(description) =>
            setDraft({ ...draft, organization: { ...org, description } })
          }
        />
        <TextRow
          label="Contact email"
          value={org.email}
          defaultHint={settings.identity.contactEmail}
          onChange={(email) => setDraft({ ...draft, organization: { ...org, email } })}
        />
        <p className="text-xs text-ink-muted">
          <code>sameAs</code> is generated from the social profiles in{" "}
          <Link href="/seoteam/site" className="text-biro underline underline-offset-2">
            Site settings
          </Link>{" "}
          — {settings.socials.length} currently set.
        </p>
      </AdminSection>

      <AdminSection title="WebSite" description="The site itself, published by the organization.">
        <ToggleRow
          label="Emit WebSite markup"
          checked={web.enabled}
          onCheckedChange={(enabled) => setDraft({ ...draft, website: { ...web, enabled } })}
        />
        <FieldGrid>
          <TextRow
            label="Name"
            value={web.name}
            defaultHint={settings.identity.name}
            onChange={(name) => setDraft({ ...draft, website: { ...web, name } })}
          />
          <TextRow
            label="Language"
            value={web.inLanguage}
            placeholder="en-US"
            onChange={(inLanguage) => setDraft({ ...draft, website: { ...web, inLanguage } })}
          />
        </FieldGrid>
        <TextAreaRow
          label="Description"
          value={web.description}
          rows={3}
          onChange={(description) => setDraft({ ...draft, website: { ...web, description } })}
        />
      </AdminSection>

      {/*
        The product node is a schema.org Service, not a SoftwareApplication —
        Google's Software App rich result requires an aggregateRating or review,
        and we will not invent one, so we stop claiming that result instead. See
        the why-comment in lib/content/site-json-ld.ts. The stored settings key
        is still `softwareApplication` and still carries inert
        `applicationCategory` / `operatingSystem` members: renaming them would
        orphan the persisted Mongo doc. They are no longer emitted, so they are
        no longer editable here.
      */}
      <AdminSection
        title="Product"
        description="The product as a free Service, including its price."
      >
        <ToggleRow
          label="Emit Service markup"
          checked={app.enabled}
          onCheckedChange={(enabled) =>
            setDraft({ ...draft, softwareApplication: { ...app, enabled } })
          }
        />
        <FieldGrid>
          <TextRow
            label="Name"
            value={app.name}
            defaultHint={settings.identity.name}
            onChange={(name) => setDraft({ ...draft, softwareApplication: { ...app, name } })}
          />
          <FieldGrid>
            <TextRow
              label="Price"
              value={app.price}
              placeholder="0"
              onChange={(price) =>
                setDraft({ ...draft, softwareApplication: { ...app, price } })
              }
            />
            <TextRow
              label="Currency"
              value={app.priceCurrency}
              placeholder="USD"
              onChange={(priceCurrency) =>
                setDraft({ ...draft, softwareApplication: { ...app, priceCurrency } })
              }
            />
          </FieldGrid>
        </FieldGrid>
        <TextAreaRow
          label="Description"
          value={app.description}
          rows={3}
          onChange={(description) =>
            setDraft({ ...draft, softwareApplication: { ...app, description } })
          }
        />
      </AdminSection>

      <AdminSection
        title="Preview"
        description="Exactly what the homepage will emit, escaped for safe embedding."
      >
        <pre className="max-h-96 overflow-auto rounded-md border border-border-subtle bg-surface-sunken p-3 font-mono text-xs text-ink-secondary">
          {preview}
        </pre>
        <a
          href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(siteConfig.url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-sm text-biro underline underline-offset-2"
        >
          <ExternalLink size={15} aria-hidden="true" />
          Test the live homepage in Google&apos;s Rich Results Test
        </a>
      </AdminSection>

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={() => void save()}
        onReset={() => {
          setDraft(settings.structuredData);
          setError(null);
        }}
      />
    </>
  );
}
