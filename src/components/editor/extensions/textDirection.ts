"use client";

import { Extension } from "@tiptap/core";

export type TextDir = "rtl" | "ltr" | "auto";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textDirection: {
      setTextDirection: (dir: TextDir) => ReturnType;
      unsetTextDirection: () => ReturnType;
    };
  }
}

export const TextDirectionExtension = Extension.create({
  name: "textDirection",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "listItem"],
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) => element.getAttribute("dir"),
            renderHTML: (attrs) =>
              attrs.dir ? { dir: attrs.dir as string } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextDirection:
        (dir) =>
        ({ state, tr, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          const supported = new Set([
            "paragraph",
            "heading",
            "blockquote",
            "listItem",
          ]);
          const updatedAt = new Set<number>();

          if (selection.empty) {
            const { $from } = selection;
            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth);
              if (!supported.has(node.type.name)) continue;
              const pos = $from.before(depth);
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir });
              if (dispatch) dispatch(tr);
              return true;
            }
            return true;
          }

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!supported.has(node.type.name)) return;
            if (updatedAt.has(pos)) return;
            updatedAt.add(pos);
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir });
          });

          if (dispatch) dispatch(tr);
          return true;
        },
      unsetTextDirection:
        () =>
        ({ state, tr, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          const supported = new Set([
            "paragraph",
            "heading",
            "blockquote",
            "listItem",
          ]);
          const updatedAt = new Set<number>();

          if (selection.empty) {
            const { $from } = selection;
            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth);
              if (!supported.has(node.type.name)) continue;
              if (node.attrs.dir == null) return true;
              const pos = $from.before(depth);
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: null });
              if (dispatch) dispatch(tr);
              return true;
            }
            return true;
          }

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!supported.has(node.type.name)) return;
            if (updatedAt.has(pos)) return;
            updatedAt.add(pos);
            if (node.attrs.dir == null) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: null });
          });

          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
