"use client";

import { Mark, mergeAttributes } from "@tiptap/core";

export type InlineDir = "rtl" | "ltr";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineDir: {
      setInlineDir: (dir: InlineDir) => ReturnType;
      unsetInlineDir: () => ReturnType;
    };
  }
}

export const InlineDirMark = Mark.create({
  name: "inlineDir",

  addAttributes() {
    return {
      dir: {
        default: "rtl",
        parseHTML: (element) =>
          element.getAttribute("dir") === "ltr" ? "ltr" : "rtl",
        renderHTML: (attrs) => ({ dir: attrs.dir }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[dir="rtl"]' },
      { tag: 'span[dir="ltr"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setInlineDir:
        (dir) =>
        ({ commands }) =>
          commands.setMark(this.name, { dir }),
      unsetInlineDir:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

