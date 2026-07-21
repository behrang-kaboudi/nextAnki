import {
  createAnkiConnectClient,
  type AnkiActionParams,
  type AnkiActionResult,
  type AnkiConnectAction,
  type AnkiConnectClientOptions,
} from "../client";

type OperationArgs<TAction extends AnkiConnectAction> =
  AnkiActionParams<TAction> extends Record<string, never>
    ? []
    : [params: AnkiActionParams<TAction>];

export type AnkiOperationResult<TAction extends AnkiConnectAction> =
  | { ok: true; result: AnkiActionResult<TAction> | null }
  | { ok: false; error: string };

export type AnkiOperations = {
  [TAction in AnkiConnectAction]: (
    ...params: OperationArgs<TAction>
  ) => Promise<AnkiOperationResult<TAction>>;
};

/**
 * Named, type-safe Anki operations for application consumers.
 * The raw AnkiConnect action dispatch remains private to this directory.
 */
export function createAnkiOperations(
  options: AnkiConnectClientOptions = {},
): AnkiOperations {
  const client = createAnkiConnectClient(options);
  const requestDetailed = client.requestDetailed as (
    action: AnkiConnectAction,
    params?: unknown,
  ) => Promise<unknown>;

  return new Proxy({} as AnkiOperations, {
    get(_target, action: string) {
      return (params?: unknown) =>
        requestDetailed(action as AnkiConnectAction, params);
    },
  });
}

export const ankiOperations = createAnkiOperations();
