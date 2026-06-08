/**
 * GET /api/tools — List available tools with descriptions and schemas.
 * Statically defined from the inline tools catalog.
 */

const AVAILABLE_TOOLS = [
  // Knowledge Tools
  {
    name: "readSkill",
    description:
      "Read a skill/playbook from the Jarvis cortex. Provide the skill name (e.g., 'neptune-project-hierarchy-LOCKED').",
    category: "knowledge",
    inputs: { name: "string — skill file name without .md extension" },
  },
  {
    name: "readPRD",
    description:
      "Read a PRD (Product Requirements Document) from the Jarvis knowledge base.",
    category: "knowledge",
    inputs: { name: "string — PRD file name without .md extension" },
  },
  {
    name: "listSkills",
    description:
      "List all available skills and playbooks from the Jarvis cortex.",
    category: "knowledge",
    inputs: {
      category: "enum: skills|prds|all (optional, default: all)",
      search: "string (optional) — filter by file name",
    },
  },
  {
    name: "searchKnowledge",
    description: "Search across all Jarvis knowledge files for a query string.",
    category: "knowledge",
    inputs: {
      query: "string — search keywords",
      category: "enum: skills|prds|all (optional)",
      maxResults: "number (optional, default: 5)",
    },
  },

  // Data Tools
  {
    name: "queryDatabase",
    description:
      "Run a read-only SQL SELECT query against the Postgres database.",
    category: "data",
    inputs: {
      sql: "string — SELECT query",
      limit: "number (optional, default: 50, max: 100)",
    },
  },
  {
    name: "pullSlackMessages",
    description: "Pull recent messages from a Slack channel.",
    category: "data",
    inputs: {
      channel: "string — Slack channel ID",
      limit: "number (optional, default: 10)",
      oldest: "string (optional) — oldest timestamp",
    },
  },
  {
    name: "fetchURL",
    description: "Fetch content from a URL and return as text or markdown.",
    category: "data",
    inputs: {
      url: "string — URL to fetch",
      returnType: "enum: text|json|markdown (optional)",
      maxLength: "number (optional, default: 10000)",
    },
  },

  // Workflow Tools
  {
    name: "runWorkflow",
    description:
      "Trigger a Workflow SDK 5 durable workflow to execute asynchronously.",
    category: "workflow",
    inputs: {
      task: "string — task description",
      params: "object (optional) — workflow parameters",
      model: "string (optional) — model to use",
    },
  },

  // V2 Bridge Tools
  {
    name: "listV2Sessions",
    description: "List recent coding sessions from Neptune V2.",
    category: "v2_bridge",
    inputs: {
      status: "enum: running|completed|failed|all (optional)",
      limit: "number (optional, default: 10)",
    },
  },
  {
    name: "getV2Session",
    description: "Get detailed info about a specific V2 coding session.",
    category: "v2_bridge",
    inputs: { sessionId: "string — V2 session ID" },
  },
  {
    name: "postV2Session",
    description: "Hand off a coding task to Neptune V2.",
    category: "v2_bridge",
    inputs: {
      prompt: "string — coding task description",
      context: "string (optional) — additional context",
      model: "string (optional) — model for V2",
    },
  },
];

export function GET() {
  const categories = [
    ...new Set(AVAILABLE_TOOLS.map((t) => t.category)),
  ].sort();

  return Response.json({
    count: AVAILABLE_TOOLS.length,
    categories,
    tools: AVAILABLE_TOOLS,
  });
}
