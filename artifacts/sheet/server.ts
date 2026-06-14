import { smoothStream, streamText } from "ai";
import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

// Phase 10-A: 30s hard timeout for artifact LLM generation (standardized across all kinds)
const ARTIFACT_GENERATION_TIMEOUT_MS = 30_000;

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Artifact generation timed out after ${ms / 1000}s`)),
      ms
    )
  );
}

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  onCreateDocument: async ({ title, dataStream, modelId, specification }) => {
    let draftContent = "";

    // Phase 10-A: Use specification as primary prompt context when provided.
    // Standardized pattern matching text/server.ts and code/server.ts.
    const promptContext = specification
      ? `Title: ${title}\n\nDetailed specification from the conversation:\n${specification}\n\nCreate a CSV spreadsheet following the specification above. Include all columns, data points, and structure mentioned. Use clear column headers and realistic sample data.`
      : title;

    try {
      const { fullStream } = await Promise.race([
        streamText({
          model: getLanguageModel(modelId),
          system: `${sheetPrompt}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences. Follow the specification precisely.`,
          experimental_transform: smoothStream({ chunking: "word" }),
          prompt: promptContext,
        }),
        timeoutReject(ARTIFACT_GENERATION_TIMEOUT_MS),
      ]);

      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-sheetDelta",
            data: draftContent,
            transient: true,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sheetDocumentHandler] onCreateDocument failed: ${errorMsg}`);
      dataStream.write({
        type: "data-sheetDelta",
        data: `\n\n// [Spreadsheet generation failed: ${errorMsg}. Please retry or ask the assistant for help.]`,
        transient: false,
      });
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    try {
      const { fullStream } = await Promise.race([
        streamText({
          model: getLanguageModel(modelId),
          system: `${updateDocumentPrompt(document.content, "sheet")}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`,
          experimental_transform: smoothStream({ chunking: "word" }),
          prompt: description,
        }),
        timeoutReject(ARTIFACT_GENERATION_TIMEOUT_MS),
      ]);

      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-sheetDelta",
            data: draftContent,
            transient: true,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sheetDocumentHandler] onUpdateDocument failed: ${errorMsg}`);
      dataStream.write({
        type: "data-sheetDelta",
        data: `\n\n// [Spreadsheet update failed: ${errorMsg}]`,
        transient: false,
      });
    }

    return draftContent;
  },
});
