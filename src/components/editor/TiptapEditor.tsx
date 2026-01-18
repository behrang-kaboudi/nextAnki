"use client";

import { useCallback, useMemo, useState } from "react";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";

import { InlineDirMark } from "@/components/editor/extensions/inlineDir";
import { TextDirectionExtension } from "@/components/editor/extensions/textDirection";
import { applyDirSmart, getDirActive } from "@/components/editor/extensions/dirSmart";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

function Icon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      {children}
    </svg>
  );
}

function ToolbarButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-lg border px-2.5 py-1.5 text-sm transition",
        "border-card bg-background text-foreground hover:bg-card/60",
        "disabled:opacity-50",
        active ? "bg-card" : "",
      ].join(" ")}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <span className="sr-only">{label}</span>
      {icon}
    </button>
  );
}

function setLink(editor: Editor) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", prev ?? "");
  if (url === null) return;
  if (!url.trim()) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: url.trim() })
    .run();
}

function addImage(editor: Editor) {
  const url = window.prompt("Image URL");
  if (!url) return;
  editor.chain().focus().setImage({ src: url.trim() }).run();
}

function hasStoredMark(editor: Editor, markName: string): boolean {
  const stored = editor.state.storedMarks ?? editor.state.selection.$from.marks();
  return stored.some((m) => m.type.name === markName);
}

export function TiptapEditor({
  value,
  placeholder = "Write something…",
  onChange,
  editable = true,
}: {
  value?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
}) {
  const [heading, setHeading] = useState<"p" | HeadingLevel>("p");
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(value ?? "");

  const extensions = useMemo(
    () => [
      StarterKit.configure({}),
      Underline,
      Highlight,
      Image,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      InlineDirMark,
      TextDirectionExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value ?? "",
    editable,
    onUpdate: ({ editor }) => {
      const next = editor.getHTML();
      setSourceHtml(next);
      onChange?.(next);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[12rem] rounded-xl border border-card bg-background px-4 py-3 text-foreground outline-none max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:list-inside [&_ul,&_ol]:p-0 [&_li]:my-1",
      },
    },
  });

  const applyHeading = useCallback(
    (next: "p" | HeadingLevel) => {
      if (!editor) return;
      setHeading(next);
      const chain = editor.chain().focus();
      if (next === "p") chain.setParagraph().run();
      else chain.toggleHeading({ level: next }).run();
    },
    [editor]
  );

  if (!editor) return null;

  const html = showSource ? sourceHtml : editor.getHTML();
  const isDisabled = !editor.isEditable;
  const rtlActive = getDirActive(editor, "rtl");
  const ltrActive = getDirActive(editor, "ltr");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-card bg-background p-2">
        <div className="flex items-center gap-2">
          <select
            value={heading}
            onChange={(e) => {
              const raw = e.target.value;
              const next = raw === "p" ? "p" : (Number(raw) as HeadingLevel);
              applyHeading(next);
            }}
            className="rounded-lg border border-card bg-background px-2 py-1.5 text-sm text-foreground"
            aria-label="Block type"
          >
            <option value="p">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>
        </div>

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label="Bold"
          icon={
            <Icon>
              <path d="M8 4h6a4 4 0 0 1 0 8H8z" />
              <path d="M8 12h7a4 4 0 0 1 0 8H8z" />
              <path d="M8 4v16" />
            </Icon>
          }
          active={editor.isActive("bold") || hasStoredMark(editor, "bold")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          icon={
            <Icon>
              <path d="M19 4H10" />
              <path d="M14 4L8 20" />
              <path d="M14 20H5" />
            </Icon>
          }
          active={editor.isActive("italic") || hasStoredMark(editor, "italic")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Underline"
          icon={
            <Icon>
              <path d="M7 4v6a5 5 0 0 0 10 0V4" />
              <path d="M5 20h14" />
            </Icon>
          }
          active={
            editor.isActive("underline") || hasStoredMark(editor, "underline")
          }
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="Strikethrough"
          icon={
            <Icon>
              <path d="M4 12h16" />
              <path d="M10 6h7" />
              <path d="M7 6a3 3 0 0 1 3-2" />
              <path d="M17 18a3 3 0 0 1-3 2H7" />
              <path d="M6 18h8" />
            </Icon>
          }
          active={editor.isActive("strike") || hasStoredMark(editor, "strike")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          label="Inline Code"
          icon={
            <Icon>
              <path d="M9 18L3 12l6-6" />
              <path d="M15 6l6 6-6 6" />
            </Icon>
          }
          active={editor.isActive("code") || hasStoredMark(editor, "code")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarButton
          label="Highlight"
          icon={
            <Icon>
              <path d="M4 20h16" />
              <path d="M7 13l7-7 3 3-7 7H7z" />
              <path d="M14 6l3 3" />
            </Icon>
          }
          active={
            editor.isActive("highlight") || hasStoredMark(editor, "highlight")
          }
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        />

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label="Bullet List"
          icon={
            <Icon>
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M4 6h.01" />
              <path d="M4 12h.01" />
              <path d="M4 18h.01" />
            </Icon>
          }
          active={editor.isActive("bulletList")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Ordered List"
          icon={
            <Icon>
              <path d="M9 6h12" />
              <path d="M9 12h12" />
              <path d="M9 18h12" />
              <path d="M4 6h1" />
              <path d="M4 12h1" />
              <path d="M4 18h1" />
            </Icon>
          }
          active={editor.isActive("orderedList")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Blockquote"
          icon={
            <Icon>
              <path d="M7 9h4v4H7z" />
              <path d="M13 9h4v4h-4z" />
              <path d="M7 13c0 3-1 5-3 6" />
              <path d="M13 13c0 3-1 5-3 6" />
            </Icon>
          }
          active={editor.isActive("blockquote")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Code Block"
          icon={
            <Icon>
              <path d="M8 17l-5-5 5-5" />
              <path d="M16 7l5 5-5 5" />
              <path d="M14 5l-4 14" />
            </Icon>
          }
          active={editor.isActive("codeBlock")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label="Align Left"
          icon={
            <Icon>
              <path d="M4 6h16" />
              <path d="M4 10h10" />
              <path d="M4 14h16" />
              <path d="M4 18h10" />
            </Icon>
          }
          active={editor.isActive({ textAlign: "left" })}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />
        <ToolbarButton
          label="Align Center"
          icon={
            <Icon>
              <path d="M4 6h16" />
              <path d="M7 10h10" />
              <path d="M4 14h16" />
              <path d="M7 18h10" />
            </Icon>
          }
          active={editor.isActive({ textAlign: "center" })}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />
        <ToolbarButton
          label="Align Right"
          icon={
            <Icon>
              <path d="M4 6h16" />
              <path d="M10 10h10" />
              <path d="M4 14h16" />
              <path d="M10 18h10" />
            </Icon>
          }
          active={editor.isActive({ textAlign: "right" })}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />
        <ToolbarButton
          label="Justify"
          icon={
            <Icon>
              <path d="M4 6h16" />
              <path d="M4 10h16" />
              <path d="M4 14h16" />
              <path d="M4 18h16" />
            </Icon>
          }
          active={editor.isActive({ textAlign: "justify" })}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        />

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label="Link"
          icon={
            <Icon>
              <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
              <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
            </Icon>
          }
          active={editor.isActive("link")}
          disabled={isDisabled}
          onClick={() => setLink(editor)}
        />
        <ToolbarButton
          label="Image"
          icon={
            <Icon>
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
              <path d="M20 16l-5-5-7 7" />
            </Icon>
          }
          disabled={isDisabled}
          onClick={() => addImage(editor)}
        />

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label="Undo"
          icon={
            <Icon>
              <path d="M9 14l-4-4 4-4" />
              <path d="M5 10h7a7 7 0 0 1 7 7v1" />
            </Icon>
          }
          disabled={isDisabled || !editor.can().chain().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Redo"
          icon={
            <Icon>
              <path d="M15 6l4 4-4 4" />
              <path d="M19 10h-7a7 7 0 0 0-7 7v1" />
            </Icon>
          }
          disabled={isDisabled || !editor.can().chain().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        />

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label="RTL"
          icon={
            <Icon>
              <path d="M20 6H10" />
              <path d="M20 10H6" />
              <path d="M20 14H10" />
              <path d="M20 18H6" />
              <path d="M6 8l-2 2 2 2" />
            </Icon>
          }
          active={rtlActive}
          disabled={isDisabled}
          onClick={() => applyDirSmart(editor, "rtl")}
        />
        <ToolbarButton
          label="LTR"
          icon={
            <Icon>
              <path d="M4 6h10" />
              <path d="M4 10h14" />
              <path d="M4 14h10" />
              <path d="M4 18h14" />
              <path d="M18 8l2 2-2 2" />
            </Icon>
          }
          active={ltrActive}
          disabled={isDisabled}
          onClick={() => applyDirSmart(editor, "ltr")}
        />

        <div className="h-7 w-px bg-card" />

        <ToolbarButton
          label={showSource ? "Hide source" : "View source"}
          icon={
            <Icon>
              <path d="M8 17l-5-5 5-5" />
              <path d="M16 7l5 5-5 5" />
              <path d="M14 5l-4 14" />
            </Icon>
          }
          active={showSource}
          disabled={isDisabled}
          onClick={() => setShowSource((prev) => !prev)}
        />
      </div>

      <EditorContent editor={editor} />

      {showSource ? (
        <div className="grid gap-2 rounded-xl border border-card bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground">HTML</div>
            <button
              type="button"
              className="rounded-lg border border-card bg-background px-2.5 py-1.5 text-sm text-foreground transition hover:bg-card/60"
              onClick={() => {
                void navigator.clipboard.writeText(html);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={html}
            className="min-h-40 w-full resize-y rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
          />
        </div>
      ) : null}
    </div>
  );
}
