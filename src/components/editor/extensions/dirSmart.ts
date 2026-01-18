"use client";

import type { Editor } from "@tiptap/react";

import type { InlineDir } from "./inlineDir";

type BlockName = "paragraph" | "heading" | "blockquote" | "listItem";

export type DirApplyMode = "block" | "inlineSelection" | "inlineTyping";

export type DirDecision = {
  desiredDir: InlineDir;
  editable: boolean;
  selection: { from: number; to: number; empty: boolean };
  mode: DirApplyMode;
  blockCount?: number;
  toggleOff?: boolean;
  reason: string;
};

function getSupportedBlockAtPos(
  editor: Editor
): {
  name: BlockName;
  pos: number;
  dir: unknown;
  textLen: number;
  parentOffset: number;
} | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const name = node.type.name as BlockName;
    if (
      name === "paragraph" ||
      name === "heading" ||
      name === "blockquote" ||
      name === "listItem"
    ) {
      return {
        name,
        pos: $from.before(depth),
        dir: (node.attrs as { dir?: unknown }).dir,
        textLen: node.textContent.length,
        parentOffset: $from.parentOffset,
      };
    }
  }
  return null;
}

function getIntersectedBlocks(editor: Editor, from: number, to: number) {
  const supported = new Set<BlockName>([
    "paragraph",
    "heading",
    "blockquote",
    "listItem",
  ]);
  const blocks = new Map<number, { pos: number; dir: unknown }>();

  const addFromResolved = (resolvedPos: typeof editor.state.selection.$from) => {
    for (let depth = resolvedPos.depth; depth > 0; depth--) {
      const node = resolvedPos.node(depth);
      const name = node.type.name as BlockName;
      if (!supported.has(name)) continue;
      const pos = resolvedPos.before(depth);
      if (!blocks.has(pos)) {
        blocks.set(pos, { pos, dir: (node.attrs as { dir?: unknown }).dir });
      }
      return;
    }
  };

  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    const name = node.type.name as BlockName;
    if (!supported.has(name)) return;
    if (!blocks.has(pos)) {
      blocks.set(pos, { pos, dir: (node.attrs as { dir?: unknown }).dir });
    }
  });

  addFromResolved(editor.state.doc.resolve(from));
  addFromResolved(editor.state.doc.resolve(to));

  return [...blocks.values()];
}

function selectionHasInlineDir(editor: Editor, desiredDir: InlineDir): boolean {
  const { from, to, empty } = editor.state.selection;
  if (empty) return false;
  let found = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === "inlineDir");
    if (mark && mark.attrs?.dir === desiredDir) {
      found = true;
      return false;
    }
    return;
  });
  return found;
}

function toggleStoredInlineDir(editor: Editor, desiredDir: InlineDir) {
  const { state } = editor;
  const stored = state.storedMarks ?? state.selection.$from.marks();
  const current = stored.find((m) => m.type.name === "inlineDir")?.attrs
    ?.dir as InlineDir | undefined;

  if (current === desiredDir) {
    editor.chain().focus().unsetInlineDir().run();
  } else {
    editor.chain().focus().setInlineDir(desiredDir).run();
  }
}

function applyBlockDir(
  editor: Editor,
  desiredDir: InlineDir,
  toggleOff: boolean
) {
  if (toggleOff) editor.chain().focus().unsetTextDirection().run();
  else editor.chain().focus().setTextDirection(desiredDir).run();
}

function applyBlockDirForBlocks(
  editor: Editor,
  blocks: Array<{ pos: number }>,
  desiredDir: InlineDir,
  toggleOff: boolean
) {
  const { state, view } = editor;
  const tr = state.tr;
  const nextDir = toggleOff ? null : desiredDir;

  for (const { pos } of blocks) {
    const node = tr.doc.nodeAt(pos);
    if (!node) continue;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: nextDir });
  }

  view.dispatch(tr);
}

export function decideDirSmart(editor: Editor, desiredDir: InlineDir): DirDecision {
  const editable = editor.isEditable;
  const { from, to, empty } = editor.state.selection;

  if (!editable) {
    return {
      desiredDir,
      editable,
      selection: { from, to, empty },
      mode: "inlineTyping",
      reason: "Editor is not editable; no action.",
    };
  }

  if (!empty) {
    const blocks = getIntersectedBlocks(editor, from, to);
    const blockCount = blocks.length;

    const allAlready = blocks.every((b) => b.dir === desiredDir);
    return {
      desiredDir,
      editable,
      selection: { from, to, empty },
      mode: "block",
      blockCount,
      toggleOff: allAlready,
      reason:
        blockCount >= 2
          ? "Selection intersects 2+ blocks; apply block direction."
          : "Selection is within one block; apply block direction to the whole block (Word-like).",
    };
  }

  const block = getSupportedBlockAtPos(editor);
  if (!block) {
    return {
      desiredDir,
      editable,
      selection: { from, to, empty },
      mode: "inlineTyping",
      reason: "No supported parent block; toggle stored inline direction.",
    };
  }

  const allAlready = block.dir === desiredDir;
  return {
    desiredDir,
    editable,
    selection: { from, to, empty },
    mode: "block",
    blockCount: 1,
    toggleOff: allAlready,
    reason:
      "Cursor is inside a supported block; apply block direction to the whole block (Word-like).",
  };
}

export function applyDirSmart(editor: Editor, desiredDir: InlineDir) {
  const decision = decideDirSmart(editor, desiredDir);
  if (!decision.editable) return;

  const selection = editor.state.selection;
  const { from, to, empty } = selection;

  if (!empty) {
    const blocks = getIntersectedBlocks(editor, from, to);
    const allAlready = blocks.every((b) => b.dir === desiredDir);
    editor.chain().focus().unsetInlineDir().run();
    applyBlockDirForBlocks(editor, blocks, desiredDir, allAlready);
    return;
  }

  const block = getSupportedBlockAtPos(editor);
  if (!block) {
    toggleStoredInlineDir(editor, desiredDir);
    return;
  }

  editor.chain().focus().unsetInlineDir().run();
  const allAlready = block.dir === desiredDir;
  applyBlockDir(editor, desiredDir, allAlready);
}

export function getDirActive(editor: Editor, desiredDir: InlineDir): boolean {
  const stored = editor.state.storedMarks ?? editor.state.selection.$from.marks();
  const storedDir = stored.find((m) => m.type.name === "inlineDir")?.attrs
    ?.dir as InlineDir | undefined;
  if (storedDir) return storedDir === desiredDir;

  const block = getSupportedBlockAtPos(editor);
  const blockDir = block?.dir as InlineDir | undefined;
  if (blockDir) return blockDir === desiredDir;

  return selectionHasInlineDir(editor, desiredDir);
}
