import { renderPromptFromFile } from "../_core/promptStore";

export const mixSentencePrompt = {
  single: async (data: unknown) => {
    const dataString = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return renderPromptFromFile({
      file: "word-extraction/templates/mix-sentence.single.v1",
      vars: { data: dataString },
    });
  },
  batch: async (data: unknown[]) => {
    const dataString = JSON.stringify(data, null, 2);
    return renderPromptFromFile({
      file: "word-extraction/templates/mix-sentence.batch.v1",
      vars: { data: dataString },
    });
  },
};

