"use client";

import Link from "next/link";
import * as React from "react";

import { TextRow } from "@/components/seoteam/admin/fields";
import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import {
  SaveBar,
  useSaveShortcut,
  useUnsavedGuard,
} from "@/components/seoteam/admin/save-bar";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveNavigation } from "@/lib/content/admin-api";
import type { NavLink, NavigationConfig, SitePage } from "@/lib/content/types";

/**
 * Header and footer editor.
 *
 * Link targets come from a dropdown of everything that actually exists — the
 * built-in routes, the landing page's anchors, and every published custom page
 * — with "Custom URL" as the escape hatch. Typing hrefs by hand is how a nav
 * quietly accumulates 404s.
 */
const CUSTOM = "__custom__";

interface TargetOption {
  value: string;
  label: string;
}

function buildTargets(pages: SitePage[]): TargetOption[] {
  return [
    { value: "/", label: "Home" },
    { value: "/#features", label: "Home → Features" },
    { value: "/#how", label: "Home → How it works" },
    { value: "/#faq", label: "Home → FAQ" },
    { value: "/#get-the-app", label: "Home → Get the app" },
    { value: "/blog", label: "Blog" },
    { value: "/contact", label: "Contact" },
    { value: "/privacy", label: "Privacy policy" },
    { value: "/terms", label: "Terms of service" },
    { value: "/login", label: "Log in" },
    { value: "/signup", label: "Sign up" },
    ...pages.map((page) => ({ value: `/${page.slug}`, label: `Page — ${page.title}` })),
  ];
}

export function NavigationEditor({
  initial,
  pages,
}: {
  initial: NavigationConfig;
  pages: SitePage[];
}) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const targets = React.useMemo(() => buildTargets(pages), [pages]);
  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );
  useUnsavedGuard(dirty);

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      // Persist the visual order as explicit `order` values so the public
      // renderer can sort without relying on array position surviving a merge.
      const normalized: NavigationConfig = {
        header: {
          ...draft.header,
          links: draft.header.links.map((link, i) => ({ ...link, order: i })),
        },
        footer: {
          ...draft.footer,
          groups: draft.footer.groups.map((group) => ({
            ...group,
            links: group.links.map((link, i) => ({ ...link, order: i })),
          })),
        },
      };
      const next = await saveNavigation(normalized);
      setSaved(next);
      setDraft(next);
      toast({ message: "Navigation saved.", tone: "success" });
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
        title="Header links"
        description="The primary navigation, shown on desktop and inside the mobile menu."
      >
        <ListEditor
          items={draft.header.links}
          onChange={(links) =>
            setDraft({ ...draft, header: { ...draft.header, links } })
          }
          keyFor={(link) => link.id}
          titleFor={(link) => link.label || "New link"}
          subtitleFor={(link) => (link.visible ? link.href : "hidden")}
          defaultOpen
          max={20}
          addLabel="Add header link"
          emptyLabel="No header links."
          onCreate={() => ({
            id: newId("header"),
            label: "",
            href: "/",
            order: draft.header.links.length,
            visible: true,
            external: false,
          })}
          renderItem={(link, _i, patch) => (
            <LinkFields link={link} patch={patch} targets={targets} />
          )}
        />
      </AdminSection>

      <AdminSection
        title="Header buttons"
        description="The log-in and sign-up calls to action on the right of the header."
      >
        <ToggleRow
          label="Show the header buttons"
          checked={draft.header.ctas.show}
          onCheckedChange={(show) =>
            setDraft({ ...draft, header: { ...draft.header, ctas: { ...draft.header.ctas, show } } })
          }
        />
        <FieldGrid>
          <TextRow
            label="Log-in label"
            value={draft.header.ctas.loginLabel}
            onChange={(loginLabel) =>
              setDraft({
                ...draft,
                header: { ...draft.header, ctas: { ...draft.header.ctas, loginLabel } },
              })
            }
            helper="Blank hides the log-in link. Always points at /login."
          />
          <TextRow
            label="Sign-up label"
            value={draft.header.ctas.signupLabel}
            onChange={(signupLabel) =>
              setDraft({
                ...draft,
                header: { ...draft.header, ctas: { ...draft.header.ctas, signupLabel } },
              })
            }
          />
        </FieldGrid>
        <TextRow
          label="Sign-up link"
          value={draft.header.ctas.signupHref}
          placeholder="/signup"
          onChange={(signupHref) =>
            setDraft({
              ...draft,
              header: { ...draft.header, ctas: { ...draft.header.ctas, signupHref } },
            })
          }
          helper="Leave blank to render the label as a static “coming soon” chip instead of a button."
        />
      </AdminSection>

      <AdminSection
        title="Footer"
        description="One untitled group renders as a single row of links; add a second group (or a title) and the footer becomes columns."
      >
        <TextRow
          label="Tagline"
          value={draft.footer.tagline}
          onChange={(tagline) => setDraft({ ...draft, footer: { ...draft.footer, tagline } })}
        />
        <TextRow
          label="Legal line"
          value={draft.footer.legalLine}
          onChange={(legalLine) =>
            setDraft({ ...draft, footer: { ...draft.footer, legalLine } })
          }
          helper="{year} and {name} are replaced when the page renders."
        />

        <div>
          <Label>Link groups</Label>
          <ListEditor
            items={draft.footer.groups}
            onChange={(groups) => setDraft({ ...draft, footer: { ...draft.footer, groups } })}
            keyFor={(group) => group.id}
            titleFor={(group) => group.title || "Untitled group"}
            subtitleFor={(group) => `${group.links.length} links`}
            max={8}
            addLabel="Add footer group"
            emptyLabel="No footer groups."
            onCreate={() => ({ id: newId("group"), title: "", links: [] })}
            renderItem={(group, _i, patchGroup) => (
              <>
                <TextRow
                  label="Group title"
                  value={group.title}
                  onChange={(title) => patchGroup({ title })}
                  helper="Leave blank on a single group to keep today's flat footer row."
                />
                <div>
                  <Label>Links</Label>
                  <ListEditor
                    items={group.links}
                    onChange={(links) => patchGroup({ links })}
                    keyFor={(link) => link.id}
                    titleFor={(link) => link.label || "New link"}
                    subtitleFor={(link) => link.href}
                    defaultOpen
                    max={20}
                    addLabel="Add link"
                    emptyLabel="No links in this group."
                    onCreate={() => ({
                      id: newId("flink"),
                      label: "",
                      href: "/",
                      order: group.links.length,
                      visible: true,
                      external: false,
                    })}
                    renderItem={(link, _index, patchLink) => (
                      <LinkFields link={link} patch={patchLink} targets={targets} />
                    )}
                  />
                </div>
              </>
            )}
          />
        </div>

        <p className="text-xs text-ink-muted">
          Social profile links live in{" "}
          <Link href="/seoteam/site" className="text-biro underline underline-offset-2">
            Site settings
          </Link>{" "}
          — they feed both the footer and the Organization structured data.
        </p>
      </AdminSection>

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

function LinkFields({
  link,
  patch,
  targets,
}: {
  link: NavLink;
  patch: (changes: Partial<NavLink>) => void;
  targets: TargetOption[];
}) {
  const known = targets.some((t) => t.value === link.href);
  const [custom, setCustom] = React.useState(!known && link.href !== "");

  return (
    <>
      <FieldGrid>
        <TextRow label="Label" value={link.label} onChange={(label) => patch({ label })} />
        <div>
          <Label>Target</Label>
          <Select
            value={custom ? CUSTOM : link.href}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustom(true);
                return;
              }
              setCustom(false);
              patch({ href: e.target.value, external: false });
            }}
          >
            {targets.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom URL…</option>
          </Select>
        </div>
      </FieldGrid>
      {custom && (
        <TextRow
          label="Custom URL"
          value={link.href}
          placeholder="https://example.com"
          onChange={(href) => patch({ href })}
        />
      )}
      <div className="flex flex-wrap gap-x-8">
        <ToggleRow
          label="Visible"
          checked={link.visible}
          onCheckedChange={(visible) => patch({ visible })}
        />
        <ToggleRow
          label="Opens in a new tab"
          description="Adds rel=noopener noreferrer."
          checked={link.external}
          onCheckedChange={(external) => patch({ external })}
        />
      </div>
    </>
  );
}
