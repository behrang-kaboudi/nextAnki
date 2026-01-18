"use client";

import { useState } from "react";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

export default function EditorDemoPage() {
  const [html, setHtml] = useState(
    `<p>سلام <strong>دنیا</strong> — select some text, then try RTL/LTR.</p><p>Second paragraph for multi-block selection.</p>`
  );
  const [decision, setDecision] = useState<string | null>(null);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Editor Demo
        </h1>
        <p className="text-sm text-muted">
          Use RTL/LTR to set block direction (multi-block selection) or inline
          direction (single-block selection / mid-paragraph cursor).
        </p>
      </div>

      <RichTextEditor
        valueHtml={html}
        onChangeHtml={setHtml}
        onDirDecision={(d) => setDecision(JSON.stringify(d, null, 2))}
      />

      <div className="grid gap-2 rounded-xl border border-card bg-background p-3">
        <div className="text-sm font-semibold text-foreground">Live HTML</div>
        <textarea
          readOnly
          value={html}
          className="min-h-48 w-full resize-y rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
        />
      </div>

      {decision ? (
        <div className="grid gap-2 rounded-xl border border-card bg-background p-3">
          <div className="text-sm font-semibold text-foreground">
            Last Direction Decision
          </div>
          <textarea
            readOnly
            value={decision}
            className="min-h-40 w-full resize-y rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
          />
        </div>
      ) : null}
    </div>
  );
}
