"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionIcon } from "@/components/icons/ActionIcon";

import { LocalAiHelpModal } from "./LocalAiHelpModal";

type JsonSetting = string | number | boolean | null;
type Settings = Record<string, JsonSetting>;

type AiModel = {
  id: number;
  name: string;
  provider: string;
  modelIdentifier: string;
  baseUrl: string;
  systemPrompt: string | null;
  settings: Settings;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ModelForm = {
  name: string;
  modelIdentifier: string;
  baseUrl: string;
  systemPrompt: string;
  settingsJson: string;
  isEnabled: boolean;
  isDefault: boolean;
};

const DEFAULT_BASE_URL = "http://localhost:1234/v1";
const DEFAULT_SETTINGS: Settings = { temperature: 0.7, top_p: 0.95, max_tokens: 1024 };
const fieldClass = "w-full rounded-xl border border-card bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 disabled:opacity-60";
const textButtonClass = "rounded-xl border border-card bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-50 dark:hover:bg-white/5";
const primaryButtonClass = "rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function modelToForm(model: AiModel): ModelForm {
  return {
    name: model.name,
    modelIdentifier: model.modelIdentifier,
    baseUrl: model.baseUrl,
    systemPrompt: model.systemPrompt ?? "",
    settingsJson: JSON.stringify(model.settings, null, 2),
    isEnabled: model.isEnabled,
    isDefault: model.isDefault,
  };
}

function parseSettings(text: string): Settings {
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings must be a JSON object.");
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
      throw new Error(`Setting \"${key}\" must be a string, number, boolean, or null.`);
    }
  }
  return value as Settings;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

export function LocalAiChatClient() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ModelForm | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [newModelIdentifier, setNewModelIdentifier] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [notice, setNotice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [usage, setUsage] = useState<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId) ?? null,
    [models, selectedId],
  );

  const loadModels = useCallback(async (preferredId?: number) => {
    setLoadingModels(true);
    try {
      const body = await readJson<{ models: AiModel[] }>(await fetch("/api/ai/local-models", { cache: "no-store" }));
      setModels(body.models);
      const next = body.models.find((model) => model.id === preferredId)
        ?? body.models.find((model) => model.id === selectedId)
        ?? body.models.find((model) => model.isDefault)
        ?? body.models[0]
        ?? null;
      setSelectedId(next?.id ?? null);
      setForm(next ? modelToForm(next) : null);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingModels(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadModels();
    // Initial load only; later reloads are invoked explicitly after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  function selectModel(model: AiModel) {
    if (sending) return;
    setSelectedId(model.id);
    setForm(modelToForm(model));
    setMessages([]);
    setUsage(null);
    setChatError("");
    setNotice("");
    setSettingsError("");
  }

  async function discoverModels() {
    setDiscovering(true);
    setSettingsError("");
    setNotice("");
    try {
      const query = new URLSearchParams({ baseUrl });
      const body = await readJson<{ models: string[] }>(await fetch(`/api/ai/lm-studio/models?${query}`, { cache: "no-store" }));
      setDiscoveredModels(body.models);
      setNewModelIdentifier(body.models[0] ?? "");
      setNotice(body.models.length ? `Found ${body.models.length} model${body.models.length === 1 ? "" : "s"}.` : "LM Studio is reachable, but no model is currently loaded.");
    } catch (error) {
      setDiscoveredModels([]);
      setSettingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setDiscovering(false);
    }
  }

  async function addModel() {
    const identifier = newModelIdentifier.trim();
    if (!identifier) {
      setSettingsError("Enter or discover an LM Studio model identifier first.");
      return;
    }
    setAdding(true);
    setSettingsError("");
    setNotice("");
    try {
      const body = await readJson<{ model: AiModel }>(await fetch("/api/ai/local-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: identifier,
          modelIdentifier: identifier,
          baseUrl,
          systemPrompt: "You are a helpful assistant.",
          settings: DEFAULT_SETTINGS,
          isEnabled: true,
          isDefault: models.length === 0,
        }),
      }));
      await loadModels(body.model.id);
      setNotice(`Added ${body.model.name}.`);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setAdding(false);
    }
  }

  function updateNumericSetting(key: string, value: number) {
    if (!form) return;
    try {
      const settings = parseSettings(form.settingsJson);
      settings[key] = value;
      setForm({ ...form, settingsJson: JSON.stringify(settings, null, 2) });
      setSettingsError("");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error));
    }
  }

  const parsedSettings = useMemo(() => {
    if (!form) return null;
    try {
      return parseSettings(form.settingsJson);
    } catch {
      return null;
    }
  }, [form]);

  async function saveModel() {
    if (!form || !selectedModel) return;
    setSaving(true);
    setSettingsError("");
    setNotice("");
    try {
      const settings = parseSettings(form.settingsJson);
      const body = await readJson<{ model: AiModel }>(await fetch(`/api/ai/local-models/${selectedModel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, settings }),
      }));
      await loadModels(body.model.id);
      setNotice("Model settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function removeModel() {
    if (!selectedModel || !window.confirm(`Delete model configuration \"${selectedModel.name}\"?`)) return;
    setSaving(true);
    setSettingsError("");
    try {
      await readJson(await fetch(`/api/ai/local-models/${selectedModel.id}`, { method: "DELETE" }));
      setMessages([]);
      await loadModels();
      setNotice("Model configuration deleted.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !selectedModel || sending || !selectedModel.isEnabled) return;
    const userMessage: ChatMessage = { id: makeId(), role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setChatError("");
    setUsage(null);
    try {
      const body = await readJson<{
        output: string;
        usage: { promptTokens: number; completionTokens: number; totalTokens: number };
      }>(await fetch("/api/ai/local-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModel.id,
          messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      }));
      setMessages((current) => [...current, { id: makeId(), role: "assistant", content: body.output }]);
      setUsage(body.usage);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[25rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-5">
        <section className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
          <div className="border-b border-card bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">LM Studio models</h2>
                <p className="mt-1 text-xs leading-5 text-muted">Discover a running server, then save any loaded model.</p>
              </div>
              <div className="flex items-center gap-2">
                <LocalAiHelpModal />
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">LOCAL</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Base URL</span>
              <input className={fieldClass} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} />
            </label>
            <button type="button" className={textButtonClass} onClick={discoverModels} disabled={discovering}>
              {discovering ? "Connecting…" : "Discover loaded models"}
            </button>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Model identifier</span>
              <input
                className={fieldClass}
                list="lm-studio-models"
                value={newModelIdentifier}
                onChange={(event) => setNewModelIdentifier(event.target.value)}
                placeholder="e.g. qwen/qwen3-4b"
                spellCheck={false}
              />
              <datalist id="lm-studio-models">
                {discoveredModels.map((model) => <option key={model} value={model} />)}
              </datalist>
            </label>
            <button type="button" className={primaryButtonClass} onClick={addModel} disabled={adding || !newModelIdentifier.trim()}>
              {adding ? "Adding…" : "Add model"}
            </button>
          </div>

          <div className="border-t border-card p-3">
            {loadingModels ? <p className="px-2 py-3 text-sm text-muted">Loading saved models…</p> : null}
            {!loadingModels && models.length === 0 ? (
              <div className="rounded-xl border border-dashed border-card p-4 text-sm leading-6 text-muted">No saved models yet. Start the LM Studio server, discover a loaded model, and add it here.</div>
            ) : null}
            <div className="grid gap-1.5">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => selectModel(model)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${selectedId === model.id ? "border-[var(--primary)] bg-[var(--primary)]/8" : "border-transparent hover:border-card hover:bg-black/5 dark:hover:bg-white/5"}`}
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${model.isEnabled ? "bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129_/_0.12)]" : "bg-zinc-400"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{model.name}</span>
                      {model.isDefault ? <span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--primary)]">default</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">{model.modelIdentifier}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {form && selectedModel ? (
          <section className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Model settings</h2>
                <p className="mt-1 text-xs text-muted">Saved per model in the database.</p>
              </div>
              <button
                type="button"
                aria-label="Delete model configuration"
                title="Delete model configuration"
                onClick={removeModel}
                disabled={saving}
                className="rounded border border-red-500/20 p-1.5 text-red-600 transition hover:bg-red-500/10 active:scale-90 disabled:opacity-50"
              >
                <ActionIcon name="trash" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted">Display name <span className="font-normal">(unique)</span></span>
                <input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted">LM Studio identifier</span>
                <input className={fieldClass} value={form.modelIdentifier} onChange={(event) => setForm({ ...form, modelIdentifier: event.target.value })} spellCheck={false} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted">Base URL</span>
                <input className={fieldClass} value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} spellCheck={false} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted">System prompt</span>
                <textarea className={`${fieldClass} min-h-24 resize-y`} value={form.systemPrompt} onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })} />
              </label>

              <div className="grid gap-4 rounded-xl border border-card bg-background/60 p-4">
                <RangeSetting label="Temperature" value={Number(parsedSettings?.temperature ?? 0.7)} min={0} max={2} step={0.05} onChange={(value) => updateNumericSetting("temperature", value)} />
                <RangeSetting label="Top P" value={Number(parsedSettings?.top_p ?? 0.95)} min={0} max={1} step={0.05} onChange={(value) => updateNumericSetting("top_p", value)} />
                <label className="grid grid-cols-[1fr_7rem] items-center gap-3 text-xs font-semibold text-muted">
                  Max tokens
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    step={1}
                    value={Number(parsedSettings?.max_tokens ?? 1024)}
                    onChange={(event) => updateNumericSetting("max_tokens", Number(event.target.value))}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted">All generation settings (JSON)</span>
                <textarea
                  className={`${fieldClass} min-h-40 resize-y font-mono text-xs leading-5`}
                  value={form.settingsJson}
                  onChange={(event) => setForm({ ...form, settingsJson: event.target.value })}
                  onBlur={() => {
                    try {
                      const settings = parseSettings(form.settingsJson);
                      setForm({ ...form, settingsJson: JSON.stringify(settings, null, 2) });
                      setSettingsError("");
                    } catch (error) {
                      setSettingsError(error instanceof Error ? error.message : String(error));
                    }
                  }}
                  spellCheck={false}
                />
                <span className="text-[11px] leading-4 text-muted">Extra OpenAI-compatible keys are forwarded to LM Studio. `model`, `messages`, and `stream` are controlled by the app.</span>
              </label>

              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} /> Enabled
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} /> Default model
                </label>
              </div>
              <button type="button" className={primaryButtonClass} onClick={saveModel} disabled={saving || !parsedSettings}>
                {saving ? "Saving…" : "Save model settings"}
              </button>
            </div>
          </section>
        ) : null}

        {settingsError ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{settingsError}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}
      </aside>

      <section className="flex min-h-[46rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card bg-gradient-to-r from-[var(--primary)]/10 to-transparent px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${selectedModel?.isEnabled ? "bg-emerald-500" : "bg-zinc-400"}`} />
              <h2 className="truncate font-semibold text-foreground">{selectedModel?.name ?? "Choose a local model"}</h2>
            </div>
            <p className="mt-1 truncate text-xs text-muted">{selectedModel ? `${selectedModel.modelIdentifier} · ${selectedModel.baseUrl}` : "Add an LM Studio model to begin chatting."}</p>
          </div>
          <button
            type="button"
            className={textButtonClass}
            onClick={() => { setMessages([]); setUsage(null); setChatError(""); }}
            disabled={!messages.length || sending}
          >
            Clear conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,var(--color-card),transparent_45%)] p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="grid h-full min-h-80 place-items-center">
              <div className="max-w-md text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]"><ActionIcon name="sparkles" className="size-7" /></div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">A private local conversation</h3>
                <p className="mt-2 text-sm leading-6 text-muted">Messages go from this app’s server directly to your configured LM Studio endpoint. Conversation history stays in this browser tab.</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-3xl gap-4">
              {messages.map((message) => (
                <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "rounded-br-md bg-[var(--primary)] text-[var(--primary-foreground)]" : "rounded-bl-md border border-card bg-background text-foreground"}`}>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-65">{message.role}</div>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  </div>
                </article>
              ))}
              {sending ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-card bg-background px-4 py-4" aria-label="LM Studio is responding">
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--primary)]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:150ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:300ms]" />
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-card bg-card p-4 sm:p-5">
          {chatError ? <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{chatError}</div> : null}
          {usage ? (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              <span>Prompt: {usage.promptTokens.toLocaleString()} tokens</span>
              <span>Response: {usage.completionTokens.toLocaleString()} tokens</span>
              <span>Total: {usage.totalTokens.toLocaleString()} tokens</span>
            </div>
          ) : null}
          <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-card bg-background p-2 shadow-sm focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={2}
              placeholder={selectedModel ? "Message your local model…" : "Add or choose a model first…"}
              disabled={!selectedModel || sending || !selectedModel.isEnabled}
              className="max-h-48 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:opacity-60"
            />
            <button type="button" className={primaryButtonClass} onClick={sendMessage} disabled={!draft.trim() || !selectedModel?.isEnabled || sending}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">Enter to send · Shift+Enter for a new line · generation settings are read from the saved model record</p>
        </div>
      </section>
    </div>
  );
}

function RangeSetting({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between text-xs font-semibold text-muted"><span>{label}</span><span className="rounded-md border border-card bg-card px-2 py-0.5 font-mono text-foreground">{safeValue}</span></span>
      <input type="range" min={min} max={max} step={step} value={safeValue} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
    </label>
  );
}
