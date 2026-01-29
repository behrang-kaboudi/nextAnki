import { IpaCandidate } from "./shared";

// Kept name for compatibility with existing callers.
export type SetFor2Result = {
  person?: IpaCandidate;
  job?: IpaCandidate;
  adj?: IpaCandidate;
  persianImage?: IpaCandidate | null;
};
