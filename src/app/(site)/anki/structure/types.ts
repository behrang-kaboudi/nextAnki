export type LogFn = (line: string) => void;

export type StepResult = { ok: true } | { ok: false };

export type HelpKey = "create" | "step1" | "step2" | "step3" | "step4" | "step5" | "step6" | "copyTemplates";

export type LogLevel = "info" | "success" | "warning" | "error";

export type StructureLog = {
  id: number;
  at: string;
  level: LogLevel;
  message: string;
};

export type StepState = "idle" | "checking" | "ready" | "needs-change" | "running" | "success" | "error";

export type StructureStepStatus = {
  state: StepState;
  detail: string;
};
