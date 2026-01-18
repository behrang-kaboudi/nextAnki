"use client";

import { useMemo } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { InlineDirMark } from "@/components/editor/extensions/inlineDir";
import { TextDirectionExtension } from "@/components/editor/extensions/textDirection";
import {
  applyDirSmart,
  decideDirSmart,
  getDirActive,
} from "@/components/editor/extensions/dirSmart";

function Icon({ children }: { children: React.ReactNode }) {
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

function DirButton({
  label,
  active,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
        "border-card bg-background text-foreground hover:bg-card/60",
        "disabled:opacity-50",
        active ? "bg-card" : "",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function RichTextEditor({
  valueHtml,
  onChangeHtml,
  editable = true,
  onDirDecision,
}: {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  editable?: boolean;
  onDirDecision?: (decision: ReturnType<typeof decideDirSmart>) => void;
}) {
  const extensions = useMemo(
    () => [
      StarterKit,
      InlineDirMark,
      TextDirectionExtension,
      Placeholder.configure({ placeholder: "Type here…" }),
    ],
    []
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: valueHtml,
    editable,
    onUpdate: ({ editor }) => onChangeHtml(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-[14rem] rounded-xl border border-card bg-background px-4 py-3 text-foreground outline-none max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:list-inside [&_ul,&_ol]:p-0 [&_li]:my-1",
      },
    },
  });

  const isDisabled = !editor || !editor.isEditable;
  const rtlActive = !!editor && getDirActive(editor, "rtl");
  const ltrActive = !!editor && getDirActive(editor, "ltr");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-card bg-background p-2">
        <DirButton
          label="RTL"
          active={rtlActive}
          disabled={isDisabled}
          onClick={() => {
            if (!editor) return;
            onDirDecision?.(decideDirSmart(editor, "rtl"));
            applyDirSmart(editor, "rtl");
          }}
          icon={
            <Icon>
              <path d="M20 6H10" />
              <path d="M20 10H6" />
              <path d="M20 14H10" />
              <path d="M20 18H6" />
              <path d="M6 8l-2 2 2 2" />
            </Icon>
          }
        />
        <DirButton
          label="LTR"
          active={ltrActive}
          disabled={isDisabled}
          onClick={() => {
            if (!editor) return;
            onDirDecision?.(decideDirSmart(editor, "ltr"));
            applyDirSmart(editor, "ltr");
          }}
          icon={
            <Icon>
              <path d="M4 6h10" />
              <path d="M4 10h14" />
              <path d="M4 14h10" />
              <path d="M4 18h14" />
              <path d="M18 8l2 2-2 2" />
            </Icon>
          }
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
