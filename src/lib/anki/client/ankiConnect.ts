import axios from "axios";

import type {
  AnkiActionParams,
  AnkiActionResult,
  AnkiConnectAction,
  AnkiConnectClient,
  AnkiConnectClientOptions,
  AnkiConnectRequest,
  AnkiConnectResponse,
} from "./types";

type ActionParams<TAction extends AnkiConnectAction> = AnkiActionParams<TAction>;
type ActionResult<TAction extends AnkiConnectAction> = AnkiActionResult<TAction>;

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

  function enqueueRequestDetailed<TResult>(task: () => Promise<TResult>) {
    const run = requestQueue.then(() => task());
    requestQueue = run.catch(() => null);
    return run;
  }

  async function ankiRequest<TAction extends AnkiConnectAction>(
    action: TAction,
    params?: ActionParams<TAction>,
  ): Promise<ActionResult<TAction> | null> {
    const payload: AnkiConnectRequest<TAction, ActionParams<TAction>> = {
      action,
      version: 6,
      params: params ?? ({} as ActionParams<TAction>),
    };

    return enqueueRequest(async () => {
      for (;;) {
        try {
          const res = await axios.post<
            AnkiConnectResponse<ActionResult<TAction>>
          >(baseUrl, payload, { timeout: timeoutMs });

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

  async function ankiRequestDetailed<TAction extends AnkiConnectAction>(
    action: TAction,
    params?: ActionParams<TAction>,
  ): Promise<
    | { ok: true; result: ActionResult<TAction> | null }
    | { ok: false; error: string }
  > {
    const payload: AnkiConnectRequest<TAction, ActionParams<TAction>> = {
      action,
      version: 6,
      params: params ?? ({} as ActionParams<TAction>),
    };

    return enqueueRequestDetailed(async () => {
      for (;;) {
        try {
          const res = await axios.post<
            AnkiConnectResponse<ActionResult<TAction>>
          >(baseUrl, payload, { timeout: timeoutMs });

          if (res.data.error) {
            const message = res.data.error.toString();
            if (isDuplicateErrorMessage(message)) {
              return { ok: true as const, result: null };
            }
            return { ok: false as const, error: message };
          }

          return { ok: true as const, result: res.data.result };
        } catch (error) {
          if (isRetryableTransportError(error)) {
            await new Promise((r) => setTimeout(r, retryDelayMs));
            continue;
          }

          const message = axios.isAxiosError(error)
            ? ((
                error.response?.data as { error?: unknown } | undefined
              )?.error?.toString() ??
              error.message ??
              "AxiosError")
            : error instanceof Error
              ? error.message
              : String(error ?? "");

          if (isDuplicateErrorMessage(message)) {
            return { ok: true as const, result: null };
          }

          return {
            ok: false as const,
            error: message || "Unknown AnkiConnect error",
          };
        }
      }
    });
  }

  return {
    request(action, ...rest) {
      const params = (rest[0] ?? undefined) as
        | ActionParams<typeof action>
        | undefined;
      return ankiRequest(action, params);
    },
    requestDetailed(action, ...rest) {
      const params = (rest[0] ?? undefined) as
        | ActionParams<typeof action>
        | undefined;
      return ankiRequestDetailed(action, params);
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

export function ankiRequestDetailed<TAction extends AnkiConnectAction>(
  action: TAction,
  ...params: ActionParams<TAction> extends Record<string, never>
    ? []
    : [params: ActionParams<TAction>]
) {
  return getDefaultClient().requestDetailed(action, ...(params as never));
}
