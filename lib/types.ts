import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

/** ArtifactLanguage — determines which sandbox runtime to use for code execution */
export type ArtifactLanguage =
  | "html"
  | "css"
  | "javascript"
  | "typescript"
  | "jsx"
  | "tsx"
  | "python"
  | "json"
  | "markdown"
  | "unknown";

/** Detect language from code content using heuristics */
export function detectArtifactLanguage(content: string): ArtifactLanguage {
  const head = content.trimStart().slice(0, 500);

  // HTML detection — must come before JSX since JSX also has <tags>
  if (/^<!DOCTYPE\s+html/i.test(head)) return "html";
  if (/^<html[\s>]/i.test(head)) return "html";
  if (/^<head>/i.test(head) || /^<body[\s>]/i.test(head)) return "html";
  if (/^<(div|section|main|header|footer|nav|article|aside)[\s>]/i.test(head))
    return "html";

  // JSX/TSX — React components
  if (/^import\s+.*from\s+["']react["']/m.test(head)) return "jsx";
  if (/^['"]use client['"]/.test(head) && /<(div|section|main)/.test(head))
    return "jsx";
  if (/^import\s+React/.test(head)) return "jsx";
  if (/^export\s+(default\s+)?function\s+\w+/.test(head) && /return\s*\(?\s*</.test(head))
    return "jsx";

  // Python detection
  if (/^from\s+[\w.]+\s+import\s+/m.test(head)) return "python";
  if (/^import\s+[\w.,\s]+$/m.test(head) && !head.includes(";") && !head.includes("{"))
    return "python";
  if (/^def\s+\w+\s*\(/.test(head)) return "python";
  if (/^class\s+\w+.*:\s*$/m.test(head)) return "python";
  if (/^#!/.test(head) && /python/.test(head)) return "python";
  if (/print\s*\(/.test(head) && !head.includes("{") && !head.includes("=>"))
    return "python";

  // TypeScript detection
  if (/^interface\s+\w+\s*\{/.test(head)) return "typescript";
  if (/^type\s+\w+\s*=/.test(head)) return "typescript";
  if (/:\s*(string|number|boolean|void|any)\b/.test(head) && /^(const|let|var|function)/.test(head))
    return "typescript";

  // JavaScript detection
  if (/^(const|let|var|function)\s/.test(head)) return "javascript";
  if (/^import\s+/.test(head)) return "javascript";
  if (/^export\s+/.test(head)) return "javascript";
  if (/console\.(log|error|warn)\(/.test(head)) return "javascript";

  // CSS detection
  if (/^[.@#][\w-]+\s*\{/.test(head)) return "css";
  if (/^:root\s*\{/.test(head)) return "css";

  // JSON detection
  if (/^\s*[{[]/.test(head)) {
    try {
      JSON.parse(content);
      return "json";
    } catch {}
  }

  return "unknown";
}
