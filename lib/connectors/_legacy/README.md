# Legacy Connectors — Migrated from U1 Tool Array

## U2.1.C Migration (2026-06-12)

These 13 connector modules were the original U1 integration layer. Under Pattern A
(Documentation-Driven Runtime), they are no longer exposed as individual tools.

### Migration Path
- **Before U2.1**: 21+ tools exposed directly to the model
- **After U2.1**: 6 gatekeeper tools → load_skill → connector playbooks → execute_skill

### Legacy Connector List
| Connector | Domain | Tools | Status |
|-----------|--------|-------|--------|
| nmi | billing-flow | 5 | → load_skill |
| slack | comms | 6 | → load_skill |
| github | coding | 7 | → load_skill |
| linear | support-triage | 5 | → load_skill |
| base44 | customer-enrollment | 7 | → load_skill |
| ghl | customer-comms | 5 | → load_skill |
| hyperswitch | billing-flow | 4 | → load_skill |
| forth | credit-disputes | 5 | → load_skill |
| vapi | support-triage | 5 | → load_skill |
| vercel | coding | 6 | → load_skill |
| mcp-hub | mcp-edits | 4 | → load_skill |
| wiki | reporting | 4 | → load_skill |
| affy | customer-comms | 3 | → load_skill |

### How to Access Legacy Connectors
Use `load_skill` with the connector path:
```
load_skill(skill_path: "connectors/nmi")
load_skill(skill_path: "connectors/slack")
```

The load_skill tool reads the connector playbook and returns all tool documentation.
The agent then uses that documentation to call the appropriate operations via the
connector's underlying MCP bridge or REST API.

### File Locations
- Connector manifests: `lib/connectors/<name>/manifest.ts`
- Tool modules: `lib/connectors/<name>/index.ts`
- Playbooks: `lib/connectors/<name>/PLAYBOOK.md`
- Skill docs: `skills/connectors/<name>/`

These files remain in place and functional — they are just not exposed as
individual tools in the agent's active tool set.
