"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";

import { structureBuilderHelpContent } from "./helpContent";
import type { HelpKey } from "./types";
import { useStructureBuilder } from "./useStructureBuilder";

type ActionButtonProps = {
  helpKey: HelpKey;
  label: string;
  isRunning: boolean;
  isPrimary?: boolean;
  onHelp: (key: HelpKey) => void;
  onClick: () => void | Promise<unknown>;
};

function ActionButton({ helpKey, label, isRunning, isPrimary = false, onHelp, onClick }: ActionButtonProps) {
  const buttonClassName = isPrimary
    ? "h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
    : "h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onHelp(helpKey)}
        className="h-7 self-end rounded-lg border border-card bg-background px-2 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
      >
        Help
      </button>
      <button type="button" onClick={onClick} disabled={isRunning} className={buttonClassName}>
        {isRunning ? "..." : label}
      </button>
    </div>
  );
}

type ManualIntervalNoticeProps = {
  deckNames: string[];
};

function ManualIntervalNotice({ deckNames }: ManualIntervalNoticeProps) {
  if (!deckNames.length) return null;

  return (
    <div dir="rtl" className="rounded-xl border border-red-500/30 bg-red-600/10 p-3 text-sm font-semibold text-red-700">
      بعد از اجرای Step 2 باید این دو مورد را برای دک{" "}
      <span className="font-mono">{deckNames.join(" , ")}</span> به صورت دستی در Anki تنظیم/بررسی کنی:
      <div dir="ltr" className="mt-2 text-left font-normal">
        <span className="font-mono">New Cards -&gt; Graduating interval</span>: <span className="font-mono">5</span>
        {"  "} | {"  "}
        <span className="font-mono">New Cards -&gt; Easy interval</span>: <span className="font-mono">6</span>
      </div>
    </div>
  );
}

type LogPanelProps = {
  logs: string[];
  logBoxRef: React.RefObject<HTMLDivElement | null>;
};

function LogPanel({ logs, logBoxRef }: LogPanelProps) {
  return (
    <div ref={logBoxRef} className="max-h-[180px] min-h-[72px] overflow-auto rounded-xl border border-card bg-background p-3">
      {logs.length ? (
        <div className="grid gap-2">
          {logs.map((line, index) => (
            <div key={`${index}-${line}`} className="font-mono text-xs text-muted">
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted">No logs yet.</div>
      )}
    </div>
  );
}

type HelpModalProps = {
  helpKey: HelpKey;
  onClose: () => void;
};

function HelpModal({ helpKey, onClose }: HelpModalProps) {
  const helpContent = structureBuilderHelpContent[helpKey];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div
        dir="rtl"
        lang="fa"
        className="flex w-full max-w-2xl flex-col rounded-2xl border border-card bg-background p-4 text-right shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">راهنما</div>
            <div className="mt-1 text-xs opacity-80">{helpContent.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card bg-background px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <div className="mt-4">{helpContent.body}</div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StructureBuilderClient() {
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const {
    isRunning,
    logs,
    logBoxRef,
    manualIntervalsRequiredDecks,
    handleCreateStructure,
    step1EnsureDecks,
    step2EnsureDeckConfigs,
    step3EnsureMetaLexVr9NoteType,
    step4EnsureMetaLexVr9Templates,
  } = useStructureBuilder();

  return (
    <div className="grid gap-6">
      <PageHeader title="Structure Builder" subtitle="Build structure + log output." />

      <section className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <div className="text-sm font-semibold text-foreground">Actions</div>
            <div className="text-xs text-muted">Run steps to sync Anki deck/model setup.</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionButton
              helpKey="create"
              label="Create Structure"
              isRunning={isRunning}
              isPrimary
              onHelp={setHelpKey}
              onClick={handleCreateStructure}
            />
            <ActionButton
              helpKey="step1"
              label="Step 1: Ensure Decks"
              isRunning={isRunning}
              onHelp={setHelpKey}
              onClick={step1EnsureDecks}
            />
            <ActionButton
              helpKey="step2"
              label="Step 2: Ensure Deck Configs"
              isRunning={isRunning}
              onHelp={setHelpKey}
              onClick={step2EnsureDeckConfigs}
            />
            <ActionButton
              helpKey="step3"
              label="Step 3: Ensure Note Type"
              isRunning={isRunning}
              onHelp={setHelpKey}
              onClick={step3EnsureMetaLexVr9NoteType}
            />
            <ActionButton
              helpKey="step4"
              label="Step 4: Ensure Templates"
              isRunning={isRunning}
              onHelp={setHelpKey}
              onClick={step4EnsureMetaLexVr9Templates}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="text-sm font-semibold text-foreground">Log</div>
          <ManualIntervalNotice deckNames={manualIntervalsRequiredDecks} />
          <LogPanel logs={logs} logBoxRef={logBoxRef} />
        </div>
      </section>

      {helpKey ? <HelpModal helpKey={helpKey} onClose={() => setHelpKey(null)} /> : null}
    </div>
  );
}
