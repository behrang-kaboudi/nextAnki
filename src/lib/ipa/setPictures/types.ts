import type { PictureWord } from "@prisma/client";

// Kept name for compatibility with existing callers.
export type SetFor2Result = {
  person?: PictureWord;
  job?: PictureWord;
  adj?: PictureWord;
  persianImage?: PictureWord | null;
};
