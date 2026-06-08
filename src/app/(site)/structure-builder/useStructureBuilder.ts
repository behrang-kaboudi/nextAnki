"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ensureDeckConfigs } from "./ensureDeckConfigs";
import { ensureRequiredDecks } from "./ensureDecks";
import { ensureMetaLexVr9NoteType } from "./ensureNoteType";
import { ensureMetaLexVr9Templates } from "./ensureTemplates";

export function useStructureBuilder() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [manualIntervalsRequiredDecks, setManualIntervalsRequiredDecks] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [...prev, line]);
  }, []);

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const step1EnsureDecks = useCallback(() => ensureRequiredDecks(appendLog), [appendLog]);

  const step2EnsureDeckConfigs = useCallback(
    () => ensureDeckConfigs(appendLog, setManualIntervalsRequiredDecks),
    [appendLog],
  );

  const step3EnsureMetaLexVr9NoteType = useCallback(() => ensureMetaLexVr9NoteType(appendLog), [appendLog]);

  const step4EnsureMetaLexVr9Templates = useCallback(() => ensureMetaLexVr9Templates(appendLog), [appendLog]);

  const handleCreateStructure = useCallback(async () => {
    setIsRunning(true);
    try {
      appendLog("Create Structure: started.");
      setManualIntervalsRequiredDecks([]);
      const s1 = await step1EnsureDecks();
      if (!s1.ok) return;
      const s2 = await step2EnsureDeckConfigs();
      if (!s2.ok) return;
      const s3 = await step3EnsureMetaLexVr9NoteType();
      if (!s3.ok) return;
      const s4 = await step4EnsureMetaLexVr9Templates();
      if (!s4.ok) return;
      appendLog("Create Structure: done.");
    } finally {
      setIsRunning(false);
    }
  }, [
    appendLog,
    step1EnsureDecks,
    step2EnsureDeckConfigs,
    step3EnsureMetaLexVr9NoteType,
    step4EnsureMetaLexVr9Templates,
  ]);

  return {
    isRunning,
    logs,
    logBoxRef,
    manualIntervalsRequiredDecks,
    handleCreateStructure,
    step1EnsureDecks,
    step2EnsureDeckConfigs,
    step3EnsureMetaLexVr9NoteType,
    step4EnsureMetaLexVr9Templates,
  };
}
