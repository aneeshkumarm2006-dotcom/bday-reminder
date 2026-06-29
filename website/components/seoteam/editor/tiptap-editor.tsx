"use client";

import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
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
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  /** Upload a dropped/pasted/selected image and resolve to its URL. */
  onUploadImage: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink",
        active && "bg-biro-tint text-biro hover:bg-biro-tint",
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [, setTick] = useState(0);

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

  const openLinkDialog = () => {
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkOpen(false);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (file) await uploadAndInsert(file, editor.view);
  };

  return (
    <div className="rounded-lg border border-border-strong bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border-subtle p-1.5">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />
        <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={18} />
        </ToolbarButton>
        <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />
        <ToolbarButton label="Add link" active={editor.isActive("link")} onClick={openLinkDialog}>
          <LinkIconLucide size={18} />
        </ToolbarButton>
        <ToolbarButton label="Insert image" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={18} />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border-subtle" aria-hidden="true" />
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={18} />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={18} />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
      </div>

      <EditorContent editor={editor} className="px-4 py-3" />

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
    </div>
  );
}
