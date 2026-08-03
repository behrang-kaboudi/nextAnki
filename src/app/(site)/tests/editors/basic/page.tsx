import { TiptapEditor } from "@/components/editor/TiptapEditor";

export const metadata = {
  title: "Editor Test",
};

export default function EditorTestPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Editor Test
        </h1>
        <p className="text-sm text-muted">
          Tiptap playground for building a richer editor.
        </p>
      </div>

      <TiptapEditor />
    </div>
  );
}

