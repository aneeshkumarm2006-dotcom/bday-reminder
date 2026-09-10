"use client";

import * as React from "react";

import { TextRow, TextAreaRow } from "@/components/seoteam/admin/fields";
import { MediaPickerField } from "@/components/seoteam/admin/media-picker";
import type { SitePhoto } from "@/lib/content/types";

/**
 * The editor for a page's photograph (`SitePhoto`) — the picker, its alt text,
 * and its caption in one field group, so every place a photo can be set asks
 * for the same three things in the same order.
 *
 * Alt text sits directly under the picker on purpose. It's the single highest-
 * value thing about a content image for both screen readers and Google Images,
 * and burying it two fields down is how images end up shipped without it.
 *
 * The pixel size is measured rather than typed. `width`/`height` only exist so
 * the public renderer can reserve the image's box before it loads (CLS), which
 * is a detail nobody editing copy should have to know about — so whenever the
 * URL changes, the browser loads it and writes the intrinsic size back. A URL
 * that can't be loaded (typo, hotlink-protected host) resets the size to 0,
 * which renders a dimensionless `<img>` rather than a collapsed one.
 */
export function PhotoField({
  value,
  onChange,
  label = "Photo",
  helper,
}: {
  value: SitePhoto;
  onChange: (next: SitePhoto) => void;
  label?: string;
  helper?: string;
}) {
  const patch = (next: Partial<SitePhoto>) => onChange({ ...value, ...next });

  // The measuring effect below has to see the *current* value and handler when
  // the image finally loads, but must not re-run when the alt or caption
  // changes — the URL is its only real input. Hence the latest-ref pattern,
  // with the writes in their own effect (a ref written during render is a
  // React 19 lint error, and would tear under concurrent rendering).
  const onChangeRef = React.useRef(onChange);
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  const { imageUrl } = value;

  React.useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new Image();
    const write = (width: number, height: number) => {
      if (cancelled) return;
      const current = valueRef.current;
      // Don't churn the form (and the unsaved-changes bar) when it already agrees.
      if (current.imageUrl !== imageUrl) return;
      if (current.width === width && current.height === height) return;
      onChangeRef.current({ ...current, width, height });
    };
    img.onload = () => write(img.naturalWidth || 0, img.naturalHeight || 0);
    img.onerror = () => write(0, 0);
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return (
    <>
      <MediaPickerField
        label={label}
        value={value.imageUrl}
        onChange={(nextUrl) =>
          // Clear the measured size immediately; the effect fills in the new
          // one once the image loads. Carrying the old numbers over would
          // reserve the wrong box for whatever was just picked.
          patch({ imageUrl: nextUrl, width: 0, height: 0 })
        }
        helper={helper ?? "Leave empty to hide this band on the live page."}
      />
      <TextRow
        label="Alt text"
        value={value.imageAlt}
        onChange={(imageAlt) => patch({ imageAlt })}
        min={10}
        max={125}
        helper="What the photo actually shows, in a sentence. Read aloud by screen readers and used by Google Images — don't list keywords."
      />
      <TextAreaRow
        label="Caption"
        value={value.caption}
        rows={2}
        onChange={(caption) => patch({ caption })}
        helper="Optional line under the photo. Visible on the page, so write it as copy."
      />
      {value.imageUrl && (
        <p className="text-xs text-ink-muted">
          {value.width > 0 && value.height > 0
            ? `Measured at ${value.width}×${value.height}px — saved with the photo so the page doesn't jump while it loads.`
            : "Couldn't measure this image, so the page can't reserve space for it. It will still render."}
        </p>
      )}
    </>
  );
}
