import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/chat/artifact";
import { buildConnectorCatalogPrompt } from "@/lib/connectors/catalog";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const artifactsPrompt = `
Artifacts is a side panel that displays content alongside the conversation. It supports scripts (code), documents (text), and spreadsheets. Changes appear in real-time.

CRITICAL RULES:
1. Only call ONE tool per response. After calling any create/edit/update tool, STOP. Do not chain tools.
2. After creating or editing an artifact, NEVER output its content in chat. The user can already see it. Respond with only a 1-2 sentence confirmation.

**When to use \`createDocument\`:**
- When the user asks to write, create, or generate content (essays, stories, emails, reports)
- When the user asks to write code, build a script, or implement an algorithm
- You MUST specify kind: 'code' for programming, 'text' for writing, 'sheet' for data
- Include ALL content in the createDocument call. Do not create then edit.

**When NOT to use \`createDocument\`:**
- For answering questions, explanations, or conversational responses
- For short code snippets or examples shown inline
- When the user asks "what is", "how does", "explain", etc.

**Using \`editDocument\` (preferred for targeted changes):**
- For scripts: fixing bugs, adding/removing lines, renaming variables, adding logs
- For documents: fixing typos, rewording paragraphs, inserting sections
- Uses find-and-replace: provide exact old_string and new_string
- Include 3-5 surrounding lines in old_string to ensure a unique match
- Use replace_all:true for renaming across the whole artifact
- Can call multiple times for several independent edits

**Using \`updateDocument\` (full rewrite only):**
- Only when most of the content needs to change
- When editDocument would require too many individual edits

**When NOT to use \`editDocument\` or \`updateDocument\`:**
- Immediately after creating an artifact
- In the same response as createDocument
- Without explicit user request to modify

**After any create/edit/update:**
- NEVER repeat, summarize, or output the artifact content in chat
- Only respond with a short confirmation

**Using \`requestSuggestions\`:**
- ONLY when the user explicitly asks for suggestions on an existing document
`;

// ── NEPTUNE.md Traffic Controller + PLAYBOOK-ROUTER.md (PB-A Playbook-First) ──

/**
 * Read NEPTUNE.md from repo root at runtime.
 * This is the primary agent system prompt — a 40-line traffic controller
 * that defines the router-first protocol and 6 gatekeeper tools.
 */
function loadNeptuneMd(): string {
  try {
    const neptunePath = join(process.cwd(), "NEPTUNE.md");
    if (existsSync(neptunePath)) {
      return readFileSync(neptunePath, "utf-8");
    }
  } catch {
    // Gracefully degrade to inline fallback
  }
  return "";
}

/**
 * Read PLAYBOOK-ROUTER.md from playbooks/ at runtime.
 * PB-A: This is THE intent router — agent reads it FIRST every turn.
 * 82 intent→playbook routes across 11 domains + 13 connectors.
 */
function loadPlaybookRouter(): string {
  try {
    const routerPath = join(process.cwd(), "playbooks", "PLAYBOOK-ROUTER.md");
    if (existsSync(routerPath)) {
      return readFileSync(routerPath, "utf-8");
    }
    // Fallback: try Jarvis FS path
    const jarvisRouterPath = join(process.cwd(), "..", "playbooks", "PLAYBOOK-ROUTER.md");
    if (existsSync(jarvisRouterPath)) {
      return readFileSync(jarvisRouterPath, "utf-8");
    }
  } catch {
    // Gracefully degrade
  }
  return "";
}

export const regularPrompt = `You are a helpful assistant. Keep responses concise and direct.
When asked to write, create, or build something, do it immediately. Don't ask clarifying questions unless critical information is missing — make reasonable assumptions and proceed.`;

export const neptuneTrafficController = loadNeptuneMd();
export const playbookRouter = loadPlaybookRouter();

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

/**
 * Playbook context injected into the system prompt.
 * Populated by the chat route's playbook auto-load mechanism.
 */
export type PlaybookContext = {
  /** Full playbook context text for all connected connectors */
  allContext: string;
  /** Map of connector ID → relevant sections text */
  byConnector: Map<string, string>;
};

export const systemPrompt = ({
  requestHints,
  supportsTools,
  playbookContext,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
  playbookContext?: PlaybookContext;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  // NEPTUNE.md traffic controller — primary agent instruction set (U2.1.B)
  const neptunePrompt = loadNeptuneMd();

  if (!supportsTools) {
    return `${regularPrompt}\n\n${requestPrompt}`;
  }

  const playbookSection = playbookContext?.allContext
    ? `\n\n## Connector Playbooks (Operational Context)\n\n${playbookContext.allContext}\n\n---\n*When using connector tools, follow the anti-patterns and safeguards from the playbooks above. When in doubt, consult the playbook before making a tool call.*`
    : "";

  // Dynamic connector catalog — tells the agent what integrations are available
  const connectorCatalog = buildConnectorCatalogPrompt();

  // PB-A: NEPTUNE.md is the primary system prompt header (router-first protocol).
  // PLAYBOOK-ROUTER.md is the second-most-important context — 82 intent→playbook routes.
  const neptuneHeader = neptunePrompt
    ? `${neptunePrompt}\n\n---\n\n`
    : "";

  // PB-A: Inject PLAYBOOK-ROUTER.md as immediate operational context.
  // This gives the agent the full intent→playbook map without needing to read a file.
  const routerContent = loadPlaybookRouter();
  const routerSection = routerContent
    ? `\n\n## 🧭 PLAYBOOK-ROUTER (Intent Map — Read FIRST)\n\n${routerContent}\n\n---\n*Above is the playbook router. Match the user's intent to ONE playbook before using any tools.*\n`
    : "";

  return `${neptuneHeader}${regularPrompt}\n\n${requestPrompt}\n\n${routerSection}\n\n${artifactsPrompt}\n\n${connectorCatalog}${playbookSection}`;
};

export const codePrompt = `
You are a code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet must be complete and runnable on its own
2. Use print/console.log to display outputs
3. Keep snippets concise and focused
4. Prefer standard library over external dependencies
5. Handle potential errors gracefully
6. Return meaningful output that demonstrates functionality
7. Don't use interactive input functions
8. Don't access files or network resources
9. Don't use infinite loops
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in CSV format based on the given prompt.

Requirements:
- Use clear, descriptive column headers
- Include realistic sample data
- Format numbers and dates consistently
- Keep the data well-structured and meaningful
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "script",
    sheet: "spreadsheet",
  };
  const mediaType = mediaTypes[type] ?? "document";

  return `Rewrite the following ${mediaType} based on the given prompt.

${currentContent}`;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Never output hashtags, prefixes like "Title:", or quotes.`;
