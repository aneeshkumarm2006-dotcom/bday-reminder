"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { fileToDataUri, uploadImageRequest } from "@/lib/blog/dashboard-api";

export function CoverImageField({
  coverImage,
  coverImageAlt,
  onChange,
  onError,
}: {
  coverImage: string;
  coverImageAlt: string;
  onChange: (next: { coverImage: string; coverImageAlt: string }) => void;
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const dataUri = await fileToDataUri(file);
      const url = await uploadImageRequest(dataUri);
      onChange({ coverImage: url, coverImageAlt });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Cover upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {coverImage ? (
        <div className="relative overflow-hidden rounded-md border border-border-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/data URLs */}
          <img
            src={coverImage}
            alt={coverImageAlt || "Cover preview"}
            className="aspect-[16/9] w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange({ coverImage: "", coverImageAlt })}
            aria-label="Remove cover image"
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink/60 text-paper hover:bg-ink/80"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-busy={uploading}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong text-ink-muted transition-colors hover:bg-surface-sunken disabled:opacity-60"
        >
          <ImagePlus size={22} aria-hidden="true" />
          <span className="text-sm">
            {uploading ? "Uploading…" : "Upload cover image"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />

      {coverImage && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Replace image"}
        </Button>
      )}

      <TextField
        label="Cover image alt text"
        value={coverImageAlt}
        onChange={(e) =>
          onChange({ coverImage, coverImageAlt: e.target.value })
        }
        helper="Describe the image for accessibility and SEO."
      />
    </div>
  );
}
