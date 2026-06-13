import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream, modelId, specification }) => {
    let draftContent = "";

    // U9.1 FIX: Use specification as primary prompt context when provided.
    // This ensures the artifact content reflects the primary LLM's intent and data,
    // not just a generic title-based generation. Falls back to title-only for backward compat.
    const promptContext = specification
      ? `Title: ${title}\n\nDetailed specification from the conversation:\n${specification}\n\nWrite comprehensive content following the specification above. Include all data points, findings, and structure mentioned. Use markdown with appropriate headings.`
      : title;

    const { fullStream } = streamText({
      model: getLanguageModel(modelId),
      system:
        "You are generating artifact content for a side panel. Write detailed, well-structured content following the provided specification. Markdown is supported. Use headings wherever appropriate. Include ALL data points and findings mentioned in the specification — be thorough.",
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: promptContext,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: getLanguageModel(modelId),
      system: updateDocumentPrompt(document.content, "text"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
