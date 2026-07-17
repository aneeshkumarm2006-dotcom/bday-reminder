"use client";

import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link as LinkIconLucide,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  /** Live current HTML value. Seeds the editor once; also drives the HTML view. */
  initialContent: string;
  onChange: (html: string) => void;
  /** Upload a dropped/pasted/selected image and resolve to its URL. */
  onUploadImage: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink",
        active && "bg-biro-tint text-biro hover:bg-biro-tint",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

export function TiptapEditor({
  initialContent,
  onChange,
  onUploadImage,
  onError,
}: TiptapEditorProps) {
  const onChangeRef = useRef(onChange);
  const uploadRef = useRef(onUploadImage);
  const errorRef = useRef(onError);
  // Keep the latest callbacks without re-creating the editor (refs synced in an
  // effect, not during render, per react-hooks rules).
  useEffect(() => {
    onChangeRef.current = onChange;
    uploadRef.current = onUploadImage;
    errorRef.current = onError;
  });

  // Latest value, readable from event handlers without stale closures.
  const valueRef = useRef(initialContent);
  useEffect(() => {
    valueRef.current = initialContent;
  });

  // Source mode. In "html" the <textarea> is the source of truth: it keeps the
  // raw HTML (incl. markup the visual editor's schema would drop) as the form
  // value. Toggling back to visual loads that HTML into the editor WITHOUT
  // emitting an update, so the raw value is preserved until the next visual edit.
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [, setTick] = useState(0);

  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Upload an image file and insert it at the current selection. Works off the
  // ProseMirror `view` (passed by drop/paste handlers and editor.view) so the
  // handlers don't close over the not-yet-assigned `editor` const.
  const uploadAndInsert = async (file: File, view: EditorView) => {
    if (!file.type.startsWith("image/")) return;
    try {
      const url = await uploadRef.current(file);
      const { state } = view;
      const node = state.schema.nodes.image?.create({ src: url });
      if (!node) return;
      view.dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    } catch (err) {
      errorRef.current?.(
        err instanceof Error ? err.message : "Image upload failed.",
      );
    }
  };

  const editor = useEditor({
    immediatelyRender: false, // required under the Next.js App Router (SSR)
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      LinkExt.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: "Write or paste your content here…",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "prose-blog focus:outline-none" },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => void uploadAndInsert(file, view));
        return true;
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => void uploadAndInsert(file, view));
        return true;
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  });

  // Keep the toolbar's active states in sync with the selection.
  useEffect(() => {
    if (!editor) return;
    const update = () => setTick((t) => t + 1);
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-border-strong bg-surface p-4 text-sm text-ink-muted">
        Loading editor…
      </div>
    );
  }

  const isHtml = mode === "html";

  const toggleMode = () => {
    if (isHtml) {
      // html → visual: load the current (possibly raw) HTML into the editor for
      // visual editing. emitUpdate=false so the toggle itself never overwrites the
      // form value with a normalized getHTML() — the raw HTML is preserved until
      // the next *visual* edit (which drops schema-unknown markup, as documented).
      editor.commands.setContent(valueRef.current, false);
      setMode("visual");
    } else {
      // visual → html: the form value is already the live editor HTML (onUpdate
      // keeps it synced), so just swap the surface — do NOT re-emit getHTML() here,
      // or a html→visual→html round-trip would silently normalize the raw source.
      setMode("html");
    }
  };

  const openLinkDialog = () => {
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  const openImageDialog = () => {
    setImageUrl("");
    setImageAlt("");
    setImageOpen(true);
  };

  const onUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      errorRef.current?.("Choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadRef.current(file);
      setImageUrl(url);
    } catch (err) {
      errorRef.current?.(
        err instanceof Error ? err.message : "Image upload failed.",
      );
    } finally {
      setUploading(false);
    }
  };

  const applyImage = () => {
    const src = imageUrl.trim();
    if (!src) return;
    editor.chain().focus().setImage({ src, alt: imageAlt.trim() }).run();
    setImageOpen(false);
  };

  return (
    <div className="rounded-lg border border-border-strong bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border-subtle p-1.5">
        <ToolbarButton label="Bold" disabled={isHtml} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton label="Italic" disabled={isHtml} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton label="Underline" disabled={isHtml} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={18} />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" disabled={isHtml} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />
        <ToolbarButton label="Heading 2" disabled={isHtml} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Heading 3" disabled={isHtml} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Bullet list" disabled={isHtml} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" disabled={isHtml} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton label="Quote" disabled={isHtml} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={18} />
        </ToolbarButton>
        <ToolbarButton label="Code block" disabled={isHtml} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />
        <ToolbarButton label="Add link" disabled={isHtml} active={editor.isActive("link")} onClick={openLinkDialog}>
          <LinkIconLucide size={18} />
        </ToolbarButton>
        <ToolbarButton label="Insert image" disabled={isHtml} onClick={openImageDialog}>
          <ImageIcon size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />
        <ToolbarButton label="Undo" disabled={isHtml} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={isHtml} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={18} />
        </ToolbarButton>

        {/* Right-aligned HTML source toggle. */}
        <span className="ml-auto" />
        <ToolbarButton label="Show HTML" active={isHtml} onClick={toggleMode}>
          <Code2 size={18} />
        </ToolbarButton>
      </div>

      {isHtml ? (
        <>
          <textarea
            value={initialContent}
            onChange={(e) => onChangeRef.current(e.target.value)}
            spellCheck={false}
            className="block h-[32rem] w-full resize-none overflow-y-auto overscroll-contain bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-ink focus:outline-none"
            aria-label="HTML source"
          />
          <p className="border-t border-border-subtle px-4 py-2 text-xs text-ink-muted">
            HTML view shows the exact source. Editing in the visual editor may drop
            markup it doesn&apos;t recognize (e.g. tables) — finish raw-HTML posts here.
          </p>
        </>
      ) : (
        <EditorContent
          editor={editor}
          className="h-[32rem] overflow-y-auto overscroll-contain px-4 py-3"
        />
      )}

      <Dialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add a link"
        description="Paste a URL. Leave it empty to remove the link."
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="URL"
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyLink}>Apply</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        title="Insert image"
        description="Upload a file or paste an image URL, then add alt text."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={16} aria-hidden="true" />
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUploadImageFile}
            />
          </div>
          <TextField
            label="Image URL"
            type="url"
            placeholder="https://… or upload above"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          {imageUrl.trim() && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/data URLs
            <img
              src={imageUrl.trim()}
              alt=""
              className="max-h-40 w-full rounded-md border border-border-subtle object-contain"
            />
          )}
          <TextField
            label="Alt text"
            helper="Describe the image for SEO and screen readers. Recommended."
            placeholder="e.g. A birthday cake with lit candles"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyImage} disabled={!imageUrl.trim() || uploading}>
              Insert
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
