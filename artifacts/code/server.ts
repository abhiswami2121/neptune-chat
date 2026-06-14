import { smoothStream, streamText } from "ai";
import { codePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
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

function stripFences(code: string): string {
  return code
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({ title, dataStream, modelId, specification }) => {
    let draftContent = "";

    // Phase 10-A: Use specification as primary prompt context when provided.
    // Standardized pattern matching text/server.ts and sheet/server.ts.
    const promptContext = specification
      ? `Task: ${title}\n\nDetailed specification from the conversation:\n${specification}\n\nWrite the complete code following the specification above. Include all functions, types, and logic described.`
      : title;

    try {
      const { fullStream } = await Promise.race([
        streamText({
          model: getLanguageModel(modelId),
          system: `${codePrompt}\n\nOutput ONLY the code. No explanations, no markdown fences, no wrapping. Follow the specification precisely.`,
          experimental_transform: smoothStream({ chunking: "word" }),
          prompt: promptContext,
        }),
        timeoutReject(ARTIFACT_GENERATION_TIMEOUT_MS),
      ]);

      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-codeDelta",
            data: stripFences(draftContent),
            transient: true,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[codeDocumentHandler] onCreateDocument failed: ${errorMsg}`);
      dataStream.write({
        type: "data-codeDelta",
        data: `\n\n// [Code generation failed: ${errorMsg}. Please retry or ask the assistant for help.]`,
        transient: false,
      });
    }

    return stripFences(draftContent);
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    try {
      const { fullStream } = await Promise.race([
        streamText({
          model: getLanguageModel(modelId),
          system: `${updateDocumentPrompt(document.content, "code")}\n\nOutput ONLY the complete updated code. No explanations, no markdown fences, no wrapping.`,
          experimental_transform: smoothStream({ chunking: "word" }),
          prompt: description,
        }),
        timeoutReject(ARTIFACT_GENERATION_TIMEOUT_MS),
      ]);

      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-codeDelta",
            data: stripFences(draftContent),
            transient: true,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[codeDocumentHandler] onUpdateDocument failed: ${errorMsg}`);
      dataStream.write({
        type: "data-codeDelta",
        data: `\n\n// [Code update failed: ${errorMsg}]`,
        transient: false,
      });
    }

    return stripFences(draftContent);
  },
});
