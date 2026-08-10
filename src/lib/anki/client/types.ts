import type { AnkiTag } from "../tags";

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
  tags?: AnkiTag[];
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

export type AnkiMultiAction =
  | {
      action: "updateNoteFields";
      params: { note: { id: number; fields: AnkiNoteFields } };
    }
  | {
      action: "addNote";
      params: { note: AnkiNote };
    };

export type AnkiMultiActionResult =
  | number
  | null
  | { result: unknown; error: string | null };

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

export type AnkiDeckConfig = {
  id: number;
  name: string;
  [k: string]: unknown;
  new?: {
    perDay?: number;
    per_day?: number;
    delays?: number[];
    ints?: number[];
    initialFactor?: number;
    initial_factor?: number;
    [k: string]: unknown;
  };
  lapse?: {
    delays?: number[];
    [k: string]: unknown;
  };
  rev?: {
    perDay?: number;
    per_day?: number;
    ease4?: number;
    [k: string]: unknown;
  };
};

export type AnkiConnectActionMap = {
  requestPermission: {
    params?: Record<string, never>;
    result: { permission: "granted" | "denied" };
  };
  version: { params?: Record<string, never>; result: number };
  sync: { params?: Record<string, never>; result: null };
  multi: {
    params: { actions: AnkiMultiAction[] };
    result: AnkiMultiActionResult[];
  };

  storeMediaFile: {
    params: { filename: string; data: string; deleteExisting?: boolean };
    result: string | null;
  };
  deleteMediaFile: {
    params: { filename: string };
    result: null;
  };
  getMediaFilesNames: {
    params: { pattern: string };
    result: string[];
  };
  getMediaDirPath: {
    params?: Record<string, never>;
    result: string;
  };

  deckNames: { params?: Record<string, never>; result: string[] };
  createDeck: { params: { deck: string }; result: number };

  getDeckConfig: { params: { deck: string }; result: AnkiDeckConfig };
  saveDeckConfig: { params: { config: AnkiDeckConfig }; result: boolean };
  setDeckConfigId: {
    params: { decks: string[]; configId: number };
    result: boolean;
  };
  cloneDeckConfigId: {
    params: { name: string; cloneFrom?: number };
    result: number | false;
  };
  removeDeckConfigId: {
    params: { configId: number };
    result: boolean;
  };

  modelNames: { params?: Record<string, never>; result: string[] };
  modelFieldNames: { params: { modelName: string }; result: string[] };
  modelFieldAdd: {
    params: { modelName: string; fieldName: string };
    result: null;
  };
  modelFieldRemove: {
    params: { modelName: string; fieldName: string };
    result: null;
  };
  modelFieldReposition: {
    params: { modelName: string; fieldName: string; index: number };
    result: null;
  };
  createModel: {
    params: {
      modelName: string;
      inOrderFields: string[];
      cardTemplates: Array<{ Name?: string; Front: string; Back: string }>;
      css?: string;
      isCloze?: boolean;
    };
    result: unknown;
  };
  modelTemplates: {
    params: { modelName: string };
    result: Record<string, { Front: string; Back: string }>;
  };
  modelTemplateAdd: {
    params: {
      modelName: string;
      template: { Name: string; Front: string; Back: string };
    };
    result: null;
  };
  modelTemplateRemove: {
    params: {
      modelName: string;
      templateName: string;
    };
    result: null;
  };
  modelTemplateRename: {
    params: {
      modelName: string;
      oldTemplateName: string;
      newTemplateName: string;
    };
    result: null;
  };
  updateModelTemplates: {
    params: {
      model: {
        name: string;
        templates: Record<string, { Front?: string; Back?: string }>;
      };
    };
    result: null;
  };

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
      interval?: number;
      factor: number;
      reps: number;
      lapses: number;
      left: number;
      mod: number;
      flags?: number;
    }>;
  };
  getIntervals: {
    params: { cards: number[] | string[]; complete?: boolean };
    result: number[] | number[][];
  };
  changeDeck: { params: { cards: number[]; deck: string }; result: null };
  setDueDate: { params: { cards: number[]; days: string }; result: boolean };
  getReviewsOfCards: {
    params: { cards: number[] | string[] };
    result: Record<
      string,
      Array<{
        id: number;
        usn: number;
        ease: number;
        ivl: number;
        lastIvl: number;
        factor: number;
        time: number;
        type: number;
      }>
    >;
  };
  answerCards: {
    params: { answers: Array<{ cardId: number; ease: 1 | 2 | 3 | 4 }> };
    result: null;
  };
  areSuspended: { params: { cards: number[] }; result: boolean[] };
  suspend: { params: { cards: number[] }; result: null };
  unsuspend: { params: { cards: number[] }; result: null };
  forgetCards: { params: { cards: number[] }; result: null };
  setSpecificValueOfCard: {
    params: {
      card: number;
      keys: string[];
      newValues: Array<string | number>;
      warning_check?: boolean;
    };
    result: boolean[];
  };

  addNote: { params: { note: AnkiNote }; result: number | null };
  updateNoteFields: {
    params: { note: { id: number; fields: AnkiNoteFields } };
    result: null;
  };
  deleteNotes: { params: { notes: number[] }; result: null };

  addTags: { params: { notes: number[]; tags: AnkiTag }; result: null };
  removeTags: { params: { notes: number[]; tags: AnkiTag }; result: null };
};

export type AnkiConnectAction = keyof AnkiConnectActionMap;

export type AnkiActionParams<TAction extends AnkiConnectAction> =
  AnkiConnectActionMap[TAction] extends { params: infer P }
    ? P
    : Record<string, never>;

export type AnkiActionResult<TAction extends AnkiConnectAction> =
  AnkiConnectActionMap[TAction] extends { result: infer R } ? R : never;

type ActionParams<TAction extends AnkiConnectAction> = AnkiActionParams<TAction>;
type ActionResult<TAction extends AnkiConnectAction> = AnkiActionResult<TAction>;

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
  requestDetailed<TAction extends AnkiConnectAction>(
    action: TAction,
    ...params: ActionParams<TAction> extends Record<string, never>
      ? []
      : [params: ActionParams<TAction>]
  ): Promise<
    | { ok: true; result: ActionResult<TAction> | null }
    | { ok: false; error: string }
  >;
};
