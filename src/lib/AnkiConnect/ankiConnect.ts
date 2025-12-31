import axios from "axios";

export type AnkiConnectError = {
  message: string;
};

export type AnkiConnectResponse<TResult> = {
  result: TResult;
  error: string | null;
};

export type AnkiConnectRequest<TAction extends string, TParams> = {
  action: TAction;
  version: 6;
  params: TParams;
};

export type AnkiNoteFieldValue = string;

export type AnkiNoteFields = Record<string, AnkiNoteFieldValue>;

export type AnkiNote = {
  deckName: string;
  modelName: string;
  fields: AnkiNoteFields;
  tags?: string[];
  options?: {
    allowDuplicate?: boolean;
    duplicateScope?: "deck" | "collection";
    duplicateScopeOptions?: {
      deckName?: string;
      checkChildren?: boolean;
      checkAllModels?: boolean;
    };
  };
  audio?: Array<{
    url?: string;
    path?: string;
    filename: string;
    fields: string[];
    skipHash?: string;
  }>;
  video?: Array<{
    url?: string;
    path?: string;
    filename: string;
    fields: string[];
    skipHash?: string;
  }>;
  picture?: Array<{
    url?: string;
    path?: string;
    filename: string;
    fields: string[];
    skipHash?: string;
  }>;
};

export type AnkiNotesInfo = Array<{
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<
    string,
    {
      value: string;
      order: number;
    }
  >;
}>;

export type AnkiConnectActionMap = {
  requestPermission: { params?: Record<string, never>; result: { permission: "granted" | "denied" } };
  version: { params?: Record<string, never>; result: number };
  sync: { params?: Record<string, never>; result: null };

  deckNames: { params?: Record<string, never>; result: string[] };
  createDeck: { params: { deck: string }; result: null };

  modelNames: { params?: Record<string, never>; result: string[] };
  modelFieldNames: { params: { modelName: string }; result: string[] };

  findNotes: { params: { query: string }; result: number[] };
  notesInfo: { params: { notes: number[] }; result: AnkiNotesInfo };

  findCards: { params: { query: string }; result: number[] };
  cardsInfo: {
    params: { cards: number[] };
    result: Array<{
      cardId: number;
      note: number;
      deckName: string;
      modelName: string;
      ord: number;
      type: number;
      queue: number;
      due: number;
      factor: number;
      reps: number;
      lapses: number;
      left: number;
      mod: number;
    }>;
  };
  answerCards: { params: { answers: Array<{ cardId: number; ease: 1 | 2 | 3 | 4 }> }; result: null };
  forgetCards: { params: { cards: number[] }; result: null };

  addNote: { params: { note: AnkiNote }; result: number | null };
  updateNoteFields: { params: { note: { id: number; fields: AnkiNoteFields } }; result: null };
  deleteNotes: { params: { notes: number[] }; result: null };

  addTags: { params: { notes: number[]; tags: string }; result: null };
  removeTags: { params: { notes: number[]; tags: string }; result: null };
};

export type AnkiConnectAction = keyof AnkiConnectActionMap;

type ActionParams<TAction extends AnkiConnectAction> =
  AnkiConnectActionMap[TAction] extends { params: infer P }
    ? P
    : Record<string, never>;

type ActionResult<TAction extends AnkiConnectAction> =
  AnkiConnectActionMap[TAction] extends { result: infer R } ? R : never;

export type AnkiConnectClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
};

export type AnkiConnectClient = {
  request<TAction extends AnkiConnectAction>(
    action: TAction,
    ...params: ActionParams<TAction> extends Record<string, never>
      ? []
      : [params: ActionParams<TAction>]
  ): Promise<ActionResult<TAction> | null>;
};

const defaultBaseUrl =
  typeof window === "undefined" ? "http://127.0.0.1:8765" : "/api/anki-connect";

function isDuplicateErrorMessage(message: string) {
  return message.toLowerCase().includes("duplicate");
}

function isRetryableTransportError(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "ECONNRESET" || message.includes("socket hang up");
}

export function createAnkiConnectClient(
  options: AnkiConnectClientOptions = {},
): AnkiConnectClient {
  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const timeoutMs = options.timeoutMs ?? 5000;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  let requestQueue: Promise<unknown> = Promise.resolve();

  function enqueueRequest<TResult>(task: () => Promise<TResult>) {
    requestQueue = requestQueue
      .then(() => task())
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[AnkiConnect Queue Error]:", message);
        return Promise.resolve(null);
      });

    return requestQueue as Promise<TResult | null>;
  }

  async function ankiRequest<TAction extends AnkiConnectAction>(
    action: TAction,
    params?: ActionParams<TAction>,
  ): Promise<ActionResult<TAction> | null> {
    const payload: AnkiConnectRequest<TAction, ActionParams<TAction>> = {
      action,
      version: 6,
      params: (params ?? ({} as ActionParams<TAction>)),
    };

    return enqueueRequest(async () => {
      for (;;) {
        try {
          const res = await axios.post<AnkiConnectResponse<ActionResult<TAction>>>(
            baseUrl,
            payload,
            { timeout: timeoutMs },
          );

          if (res.data.error) {
            const message = res.data.error.toString();
            if (isDuplicateErrorMessage(message)) {
              console.warn(`Duplicate note ignored (${String(action)}).`);
              return null;
            }
            throw new Error(message);
          }

          return res.data.result;
        } catch (error) {
          if (isRetryableTransportError(error)) {
            await new Promise((r) => setTimeout(r, retryDelayMs));
            continue;
          }

          const message =
            error instanceof Error ? error.message : String(error ?? "");

          if (isDuplicateErrorMessage(message)) {
            console.warn(`Duplicate note ignored (${String(action)}).`);
            return null;
          }

          console.error(`[AnkiConnect Error] ${String(action)}:`, message);
          return null;
        }
      }
    });
  }

  return {
    request(action, ...rest) {
      const params = (rest[0] ?? undefined) as ActionParams<typeof action> | undefined;
      return ankiRequest(action, params);
    },
  };
}

let defaultClient: AnkiConnectClient | null = null;

function getDefaultClient() {
  if (!defaultClient) defaultClient = createAnkiConnectClient();
  return defaultClient;
}

export function ankiRequest<TAction extends AnkiConnectAction>(
  action: TAction,
  ...params: ActionParams<TAction> extends Record<string, never>
    ? []
    : [params: ActionParams<TAction>]
) {
  return getDefaultClient().request(action, ...(params as never));
}
