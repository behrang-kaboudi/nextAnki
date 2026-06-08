export type LogFn = (line: string) => void;

export type StepResult = { ok: true } | { ok: false };

export type HelpKey = "create" | "step1" | "step2" | "step3" | "step4";
