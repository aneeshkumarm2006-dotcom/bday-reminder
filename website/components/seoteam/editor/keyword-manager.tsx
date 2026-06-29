"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Keyword, KeywordRel, LinkOccurrences } from "@/lib/blog/types";

/**
 * Manage a post's keyword backlinks in one place: each row is a keyword, the URL
 * its occurrences should link to, and a rel option (dofollow/nofollow/sponsored).
 */
export function KeywordManager({
  keywords,
  onChange,
  linkOccurrences,
  onLinkOccurrencesChange,
}: {
  keywords: Keyword[];
  onChange: (next: Keyword[]) => void;
  linkOccurrences: LinkOccurrences;
  onLinkOccurrencesChange: (next: LinkOccurrences) => void;
}) {
  const update = (index: number, patch: Partial<Keyword>) =>
    onChange(keywords.map((k, i) => (i === index ? { ...k, ...patch } : k)));
  const add = () =>
    onChange([...keywords, { keyword: "", url: "", rel: "dofollow" }]);
  const remove = (index: number) =>
    onChange(keywords.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {keywords.length === 0 && (
        <p className="text-sm text-ink-muted">
          No keyword backlinks yet. Add a keyword and the URL its occurrences in
          the body should link to.
        </p>
      )}

      {keywords.map((keyword, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-border-subtle p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              placeholder="Keyword or phrase"
              value={keyword.keyword}
              aria-label={`Keyword ${index + 1}`}
              onChange={(e) => update(index, { keyword: e.target.value })}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove keyword ${index + 1}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-danger-bg hover:text-danger-fg"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
          <Input
            type="url"
            placeholder="https://target-url.com"
            value={keyword.url}
            aria-label={`Target URL ${index + 1}`}
            onChange={(e) => update(index, { url: e.target.value })}
          />
          <Select
            value={keyword.rel}
            aria-label={`Link type ${index + 1}`}
            onChange={(e) =>
              update(index, { rel: e.target.value as KeywordRel })
            }
          >
            <option value="dofollow">dofollow (passes link equity)</option>
            <option value="nofollow">nofollow</option>
            <option value="sponsored">sponsored</option>
          </Select>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={add} type="button">
        <Plus size={18} aria-hidden="true" />
        Add keyword
      </Button>

      <div className="mt-1">
        <Label htmlFor="link-occurrences">Link occurrences</Label>
        <Select
          id="link-occurrences"
          value={linkOccurrences}
          onChange={(e) =>
            onLinkOccurrencesChange(e.target.value as LinkOccurrences)
          }
        >
          <option value="first">First occurrence only (recommended)</option>
          <option value="all">Every occurrence</option>
        </Select>
      </div>
    </div>
  );
}
