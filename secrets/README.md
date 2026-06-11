# Neptune Chat Secrets Server

**U1.4** — Centralized, typed secrets management. No more `process.env` scattered everywhere.

## Quick Start

```typescript
import { secrets } from '@/secrets';

// Before (OLD - never do this):
const token = process.env.SLACK_BOT_TOKEN || "";

// After (NEW - always do this):
const token = secrets.slack.botToken;
```

## Architecture

```
secrets/
├── index.ts        # z.object schema + parseEnv() + export typed `secrets` const
├── categories.ts   # Documentation for each secret (what, rotation, source)
└── README.md       # This file
```

### Schema Validation

All secrets are validated at **import time** via Zod:
- **Required secrets** (e.g., `slack.botToken`): throw if missing
- **Optional secrets** (e.g., `hyperswitch.apiKey`): default to `""`
- **URL secrets**: validated as valid URLs or empty string

### Category Groups

| Category | Schema Key | Env Vars |
|----------|-----------|----------|
| Slack | `secrets.slack` | `SLACK_BOT_TOKEN`, `JARVIS_ADMIN_CHANNEL_ID` |
| NMI | `secrets.nmi` | `NMI_SECURITY_KEY`, `NMI_CONNECTOR_MCA_ID` |
| Hyperswitch | `secrets.hyperswitch` | `HYPERSWITCH_*` (9 vars) |
| Base44 | `secrets.base44` | `BASE44_*` (7 vars) |
| Vercel | `secrets.vercel` | `VERCEL_TOKEN`, `VERCEL_TEAM_ID` |
| GitHub | `secrets.github` | `GITHUB_TOKEN` |
| VPS | `secrets.vps` | `VPS_BRIDGE_URL`, `NEPTUNE_INTERNAL_TOKEN` |
| OpenAI | `secrets.openai` | `OPENAI_API_KEY` |
| Anthropic | `secrets.anthropic` | `ANTHROPIC_API_KEY` |
| DeepSeek | `secrets.deepseek` | `DEEPSEEK_API_KEY` |
| AI Gateway | `secrets.aiGateway` | `AI_GATEWAY_API_KEY` |
| Internal | `secrets.internal` | `POSTGRES_URL`, `REDIS_URL`, `AUTH_SECRET` |
| Neptune V2 | `secrets.neptuneV2` | `NEPTUNE_V2_*`, `OPEN_AGENTS_*` |
| E2B | `secrets.e2b` | `E2B_API_KEY`, `E2B_ACCESS_TOKEN` |
| Resend | `secrets.resend` | `RESEND_API_KEY` |
| Linear | `secrets.linear` | `LINEAR_API_KEY` |
| Forth | `secrets.forth` | `FORTH_API_TOKEN` |
| Vapi | `secrets.vapi` | `VAPI_PRIVATE_KEY` |
| GHL | `secrets.ghl` | `GHL_API_KEY` |
| Affy | `secrets.affy` | `AFFY_API_KEY` |
| Wiki | `secrets.wiki` | `HERMES_KEY` |

## Adding a New Secret

1. **Add schema field** in `secrets/index.ts`:
   ```typescript
   // In the appropriate category schema
   const myConnectorSchema = z.object({
     existingField: optionalApiKey,
     newField: optionalApiKey,  // <-- add here
   });
   ```

2. **Add env var mapping** in `parseEnv()`:
   ```typescript
   myConnector: {
     existingField: process.env.EXISTING_VAR ?? "",
     newField: process.env.NEW_VAR ?? "",  // <-- add here
   },
   ```

3. **Document** in `secrets/categories.ts`:
   ```typescript
   {
     key: "newField",
     envVar: "NEW_VAR",
     description: "What this secret does",
     rotation: "Every 6 months",
     source: "Where to get it",
     required: false,
   },
   ```

4. **Set in Vercel** via REST API:
   ```bash
   curl -X POST "https://api.vercel.com/v10/projects/{projectId}/env" \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key":"NEW_VAR","value":"...","target":["production","preview","development"],"type":"encrypted"}'
   ```

## Rotating a Secret

1. Generate new value (e.g., `openssl rand -base64 32`)
2. Update in Vercel via REST API:
   ```bash
   curl -X PATCH "https://api.vercel.com/v9/projects/{projectId}/env/{envId}" \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"value":"new-value"}'
   ```
3. Redeploy to pick up new value (any push to main triggers redeploy)
4. Revoke old key at source (e.g., OpenAI dashboard, GitHub tokens page)

## Naming Conventions

- **Env vars**: `UPPER_SNAKE_CASE` — `SLACK_BOT_TOKEN`, `BASE44_API_KEY`
- **Schema keys**: `camelCase` — `botToken`, `apiKey`
- **Category names**: `snake_case` in categories.ts, `camelCase` in schema
- **Required secrets**: Use `z.string().min(1)` (no `.default()`)
- **Optional secrets**: Use `.default("")` or `optionalApiKey` / `optionalString`

## Migration Status

- [x] Schema created (secrets/index.ts)
- [x] Categories documented (secrets/categories.ts)
- [x] README written
- [ ] Connector tools migrated to use `@/secrets`
- [ ] lib/ai/* files migrated to use `@/secrets`
- [ ] All 80 Vercel env vars audited and documented

## Vercel Env Audit (2026-06-11)

80 environment variables configured on the neptune-chat Vercel project (`prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl`). Full listing in `secrets/categories.ts`.

Key stats:
- **Connector APIs**: 14 (slack, nmi, hyperswitch, base44, github, vercel, linear, forth, vapi, ghl, affy, resend, e2b, wiki)
- **AI Providers**: 7 (openai, anthropic, deepseek, xai, groq, google, ai_gateway)
- **Infrastructure**: 6 (postgres, redis, auth, blob, diagnostics)
- **Neptune V2**: 8 (handoff, chat URL, tasks URL, auth)
- **Other services**: 15 (n8n, godaddy, clerk, twenty, swami, etc.)
