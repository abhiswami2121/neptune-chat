/**
 * U1.4: Secrets Categories — documentation for each secret.
 *
 * Each category documents:
 * - What each secret does
 * - Rotation policy
 * - Where to get/regenerate it
 */

export interface SecretDoc {
  key: string;
  envVar: string;
  description: string;
  rotation: string;
  source: string;
  required: boolean;
}

export interface CategoryDoc {
  name: string;
  description: string;
  secrets: SecretDoc[];
}

/**
 * All secret categories with documentation.
 * Used by /api/secrets/docs (future) and the secrets/README.md generator.
 */
export const SECRET_CATEGORIES: CategoryDoc[] = [
  {
    name: "slack",
    description: "Slack workspace integration — bot messaging, channel operations",
    secrets: [
      {
        key: "botToken",
        envVar: "SLACK_BOT_TOKEN",
        description: "Slack Bot User OAuth token (xoxb-...) for sending/receiving messages",
        rotation: "Every 6 months. Regenerate at https://api.slack.com/apps → OAuth & Permissions",
        source: "https://api.slack.com/apps/A08A4Q15A64/oauth",
        required: true,
      },
      {
        key: "jarvisAdminChannelId",
        envVar: "JARVIS_ADMIN_CHANNEL_ID",
        description: "Channel ID for #jarvis-admin (C0AQDDC3HAB) — agent-only comms",
        rotation: "Never (channel ID is stable)",
        source: "Slack → right-click channel → Copy link → extract ID",
        required: true,
      },
      {
        key: "newleafAdminChannelId",
        envVar: "NEWLEAF_ADMIN_CHANNEL_ID",
        description: "Channel ID for #newleaf-admin (C096PSS45Q9) — legacy, read-only",
        rotation: "Never (channel ID is stable)",
        source: "Slack → right-click channel → Copy link → extract ID",
        required: false,
      },
      {
        key: "jarvisAdminWebhookUrl",
        envVar: "SLACK_JARVIS_ADMIN_WEBHOOK_URL",
        description: "Incoming webhook URL for posting to #jarvis-admin",
        rotation: "Every 12 months",
        source: "https://api.slack.com/apps/A08A4Q15A64/incoming-webhooks",
        required: false,
      },
    ],
  },
  {
    name: "nmi",
    description: "NMI Payments — card vault, recurring billing, transaction queries",
    secrets: [
      {
        key: "securityKey",
        envVar: "NMI_SECURITY_KEY",
        description: "NMI API security key for payment gateway operations",
        rotation: "Every 6 months. Regenerate in NMI merchant portal → Settings → Security Keys",
        source: "https://secure.networkmerchants.com/",
        required: false,
      },
      {
        key: "connectorMcaId",
        envVar: "NMI_CONNECTOR_MCA_ID",
        description: "NMI Connector MCA ID for Hyperswitch integration",
        rotation: "Never (static connector identifier)",
        source: "Hyperswitch dashboard → Connectors → NMI",
        required: false,
      },
    ],
  },
  {
    name: "hyperswitch",
    description: "Hyperswitch — payment orchestration layer (self-hosted)",
    secrets: [
      {
        key: "apiKey",
        envVar: "HYPERSWITCH_API_KEY",
        description: "Hyperswitch API key for server-side operations",
        rotation: "Every 6 months. Regenerate in Hyperswitch dashboard → API Keys",
        source: "Hyperswitch admin dashboard",
        required: false,
      },
      {
        key: "adminApiKey",
        envVar: "HYPERSWITCH_ADMIN_API_KEY",
        description: "Admin-level API key for Hyperswitch management",
        rotation: "Every 3 months",
        source: "Hyperswitch admin dashboard → Admin Keys",
        required: false,
      },
    ],
  },
  {
    name: "base44",
    description: "Base44 CRM — entity queries, customer 360, reporting hub",
    secrets: [
      {
        key: "apiKey",
        envVar: "BASE44_API_KEY",
        description: "Base44 API key for MCP bridge and entity CRUD operations",
        rotation: "Every 6 months. Regenerate in Base44 admin panel",
        source: "Base44 admin dashboard → API Keys",
        required: true,
      },
      {
        key: "apiUrl",
        envVar: "BASE44_API_URL",
        description: "Base44 API base URL (default: http://187.127.250.171:3001)",
        rotation: "Only if VPS IP changes",
        source: "VPS deployment config",
        required: false,
      },
    ],
  },
  {
    name: "vercel",
    description: "Vercel — project management, deployments, domains",
    secrets: [
      {
        key: "token",
        envVar: "VERCEL_TOKEN",
        description: "Full Account scope Vercel token for deployment operations",
        rotation: "Every 3 months. Regenerate at https://vercel.com/account/tokens",
        source: "https://vercel.com/account/tokens",
        required: true,
      },
      {
        key: "webhookSecret",
        envVar: "VERCEL_WEBHOOK_SECRET",
        description: "Secret for verifying Vercel webhook payloads",
        rotation: "Every 12 months",
        source: "Vercel project → Settings → Webhooks",
        required: false,
      },
    ],
  },
  {
    name: "github",
    description: "GitHub — repo access, code search, PR management",
    secrets: [
      {
        key: "token",
        envVar: "GITHUB_TOKEN",
        description: "GitHub personal access token (classic) with repo + workflow scope",
        rotation: "Every 3 months. Regenerate at https://github.com/settings/tokens",
        source: "https://github.com/settings/tokens",
        required: true,
      },
    ],
  },
  {
    name: "vps",
    description: "VPS — hostingerBridge, claude-agent-api, file operations",
    secrets: [
      {
        key: "bridgeUrl",
        envVar: "VPS_BRIDGE_URL",
        description: "VPS bridge URL for sandbox and vault operations",
        rotation: "Only if VPS IP changes",
        source: "VPS deployment (default: http://localhost:8400)",
        required: false,
      },
      {
        key: "internalToken",
        envVar: "NEPTUNE_INTERNAL_TOKEN",
        description: "Internal auth token for Neptune microservices communication",
        rotation: "Every 6 months. Generate: openssl rand -base64 32",
        source: "Generated at deploy time",
        required: true,
      },
      {
        key: "hostingerApiKey",
        envVar: "HOSTINGER_API_KEY",
        description: "Hostinger VPS API key for server management",
        rotation: "Every 6 months",
        source: "Hostinger panel → API Keys",
        required: false,
      },
    ],
  },
  {
    name: "openai",
    description: "OpenAI — GPT-4o, o4-mini, embeddings",
    secrets: [
      {
        key: "apiKey",
        envVar: "OPENAI_API_KEY",
        description: "OpenAI API key (sk-...)",
        rotation: "Every 3 months. Regenerate at https://platform.openai.com/api-keys",
        source: "https://platform.openai.com/api-keys",
        required: false,
      },
    ],
  },
  {
    name: "anthropic",
    description: "Anthropic — Claude Opus 4.7, Sonnet 4.5",
    secrets: [
      {
        key: "apiKey",
        envVar: "ANTHROPIC_API_KEY",
        description: "Anthropic API key (sk-ant-...)",
        rotation: "Every 3 months. Regenerate at https://console.anthropic.com/keys",
        source: "https://console.anthropic.com/keys",
        required: true,
      },
    ],
  },
  {
    name: "deepseek",
    description: "DeepSeek — V3, R1, V4 models",
    secrets: [
      {
        key: "apiKey",
        envVar: "DEEPSEEK_API_KEY",
        description: "DeepSeek API key",
        rotation: "Every 6 months",
        source: "https://platform.deepseek.com/api_keys",
        required: false,
      },
    ],
  },
  {
    name: "ai_gateway",
    description: "AI Gateway — unified LLM routing",
    secrets: [
      {
        key: "apiKey",
        envVar: "AI_GATEWAY_API_KEY",
        description: "AI Gateway API key for unified model access",
        rotation: "Every 6 months",
        source: "AI Gateway admin dashboard",
        required: false,
      },
    ],
  },
  {
    name: "internal",
    description: "Internal infrastructure — auth, database, diagnostics",
    secrets: [
      {
        key: "authSecret",
        envVar: "AUTH_SECRET",
        description: "Better Auth signing secret for JWT tokens",
        rotation: "Every 6 months. Generate: openssl rand -base64 32",
        source: "Generated. Set via Vercel env or .env.local",
        required: true,
      },
      {
        key: "postgresUrl",
        envVar: "POSTGRES_URL",
        description: "PostgreSQL connection string (Neon serverless)",
        rotation: "Every 6 months. Rotate in Neon dashboard",
        source: "Neon console → Connection Details",
        required: true,
      },
      {
        key: "redisUrl",
        envVar: "REDIS_URL",
        description: "Redis connection string (Upstash)",
        rotation: "Every 12 months. Rotate in Upstash dashboard",
        source: "Upstash console → Connect",
        required: true,
      },
    ],
  },
  {
    name: "neptune_v2",
    description: "Neptune V2 — coding agent handoff target (separate Vercel project)",
    secrets: [
      {
        key: "chatUrl",
        envVar: "NEPTUNE_V2_CHAT_URL",
        description: "Neptune V2 /api/chat endpoint URL",
        rotation: "Only if V2 project URL changes",
        source: "Vercel project settings for neptune-v2",
        required: false,
      },
      {
        key: "handoffSecret",
        envVar: "NEPTUNE_V2_HANDOFF_SECRET",
        description: "Secret for authenticating V1→V2 handoff requests",
        rotation: "Every 6 months. Generate: openssl rand -base64 32",
        source: "Generated. Must match on both V1 and V2",
        required: false,
      },
      {
        key: "openAgentsUrl",
        envVar: "OPEN_AGENTS_URL",
        description: "Open Agents base URL (legacy name for Neptune V2)",
        rotation: "Only if V2 URL changes",
        source: "Vercel deployment URL for neptune-v2",
        required: false,
      },
    ],
  },
  {
    name: "e2b",
    description: "E2B — cloud sandbox execution engine",
    secrets: [
      {
        key: "apiKey",
        envVar: "E2B_API_KEY",
        description: "E2B API key for sandbox creation and management",
        rotation: "Every 6 months. Regenerate at https://e2b.dev/dashboard",
        source: "https://e2b.dev/dashboard",
        required: false,
      },
      {
        key: "jarvisTemplateId",
        envVar: "E2B_JARVIS_TEMPLATE_ID",
        description: "E2B sandbox template ID for Jarvis coding agent",
        rotation: "Only when template is rebuilt",
        source: "E2B dashboard → Templates",
        required: false,
      },
    ],
  },
  {
    name: "resend",
    description: "Resend — transactional email delivery",
    secrets: [
      {
        key: "apiKey",
        envVar: "RESEND_API_KEY",
        description: "Resend API key for sending emails",
        rotation: "Every 6 months. Regenerate at https://resend.com/api-keys",
        source: "https://resend.com/api-keys",
        required: false,
      },
    ],
  },
  {
    name: "linear",
    description: "Linear — issue tracking and project management",
    secrets: [
      {
        key: "apiKey",
        envVar: "LINEAR_API_KEY",
        description: "Linear API key for issue CRUD operations",
        rotation: "Every 6 months. Regenerate at https://linear.app/settings/api",
        source: "https://linear.app/settings/api",
        required: false,
      },
    ],
  },
  {
    name: "forth",
    description: "Forth DPP — debt protection program, credit repair",
    secrets: [
      {
        key: "apiToken",
        envVar: "FORTH_API_TOKEN",
        description: "Forth Credit API token for dispute management",
        rotation: "Every 6 months",
        source: "Forth Credit partner portal",
        required: false,
      },
    ],
  },
  {
    name: "vapi",
    description: "Vapi — Voice AI call logs, transcripts, agent analytics",
    secrets: [
      {
        key: "privateKey",
        envVar: "VAPI_PRIVATE_KEY",
        description: "Vapi private API key for call operations",
        rotation: "Every 6 months. Regenerate at https://dashboard.vapi.ai/settings",
        source: "https://dashboard.vapi.ai/settings",
        required: false,
      },
    ],
  },
  {
    name: "ghl",
    description: "GoHighLevel — CRM, SMS, email, pipeline",
    secrets: [
      {
        key: "apiKey",
        envVar: "GHL_API_KEY",
        description: "GHL API key for CRM operations",
        rotation: "Every 6 months. Regenerate in GHL marketplace app settings",
        source: "GHL Marketplace → App Settings",
        required: false,
      },
    ],
  },
  {
    name: "affy",
    description: "Affy Maverick — chargeback disputes and defense automation",
    secrets: [
      {
        key: "apiKey",
        envVar: "AFFY_API_KEY",
        description: "Affy API key for chargeback operations",
        rotation: "Every 6 months",
        source: "Affy partner dashboard",
        required: false,
      },
    ],
  },
  {
    name: "wiki",
    description: "Hermes Wiki — knowledge ingestion, querying, linting",
    secrets: [
      {
        key: "hermesKey",
        envVar: "HERMES_KEY",
        description: "Hermes API key for wiki operations",
        rotation: "Every 6 months. Generate: openssl rand -base64 32",
        source: "Generated. Set in both neptune-chat and hermes-api envs",
        required: false,
      },
    ],
  },
];

/**
 * Generate a flat lookup: envVar → SecretDoc
 */
export function getSecretByEnvVar(envVar: string): SecretDoc | undefined {
  for (const cat of SECRET_CATEGORIES) {
    const found = cat.secrets.find((s) => s.envVar === envVar);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get all required secrets that are currently unset.
 */
export function getMissingRequiredSecrets(): SecretDoc[] {
  const missing: SecretDoc[] = [];
  for (const cat of SECRET_CATEGORIES) {
    for (const s of cat.secrets) {
      if (s.required && !process.env[s.envVar]) {
        missing.push(s);
      }
    }
  }
  return missing;
}
