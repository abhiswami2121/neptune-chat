# PLAYBOOK-ROUTER.md — Single Entry Point for ALL Agent Operations

> **Version:** 1.0.0 | **Date:** 2026-06-12 | **Status:** ACTIVE
> **Architecture:** Playbook-First Orchestration (PRD: jarvis/prd/PLAYBOOK-FIRST-ORCHESTRATION-MASTER-PRD-2026-06-12.md)
> **Role:** THE file every agent reads FIRST on every user message. Do not bypass.

---

## CARDINAL RULE #1: READ THIS FILE FIRST

On EVERY user message, your FIRST action is to read this router. Match the user's dominant intent to one playbook. Load that playbook. Execute its SOP. NEVER grep tools or browse the filesystem directly without going through this router.

## CARDINAL RULE #2: ONE PLAYBOOK AT A TIME

Pick the ONE playbook that best matches the user's dominant intent. NEVER load multiple playbooks at once. If the user asks about multiple domains, handle the primary intent first, then ask about the secondary.

## CARDINAL RULE #3: NEVER GREP TOOLS DIRECTLY

Do NOT search for tools, skills, or functions by grepping the filesystem. The playbook you load tells you EXACTLY which connectors, skills, and functions to use. Trust the playbook.

---

## INTENT → PLAYBOOK MAP (80+ Routes)

### P0: BILLING & PAYMENTS (Money Movement)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 1 | Charge a customer | charge, bill, payment, collect, run card, process, transaction | `playbooks/billing/playbook-billing.md` | NMI vault + CIT/MIT rules |
| 2 | Refund a customer | refund, return money, reverse charge, give back | `playbooks/billing/playbook-billing.md` | Requires original txn verification |
| 3 | Check payment status | did payment go through, charge status, txn lookup, verify payment | `playbooks/billing/playbook-billing.md` | NMI transaction_query |
| 4 | Recover declined card | decline, failed, insufficient funds, do not honor, card declined | `playbooks/billing/playbook-billing.md` | Smart Retry Engine + billing link |
| 5 | Create billing link | billing link, pay now, update card, new payment, Collect.js | `playbooks/billing/playbook-billing.md` | NMI Collect.js + vault create |
| 6 | Manage subscriptions | subscription, recurring, cancel sub, pause, resume, next charge | `playbooks/billing/playbook-billing.md` | NMI subscription CRUD |
| 7 | Vault health check | vault check, CoF health, card on file, vault audit, vanished vault | `playbooks/billing/playbook-billing.md` | Golden Vault architecture |
| 8 | Fix billing chain | broken chain, orphan sub, ghost CRM, billing recon, missing sub | `playbooks/billing/playbook-billing.md` | 123-124 broken chains tracked |
| 9 | Payment date change | reschedule, change date, payment date, move charge | `playbooks/billing/playbook-billing.md` | NMI subscription date sync |
| 10 | CVV/billing error | cvv mismatch, 225, card error, validation, config decline | `playbooks/billing/playbook-billing.md` | CVV token pass-through fix |
| 11 | NMI operations | nmi, network token, DPAN, customer vault, merchant initiated | `playbooks/billing/playbook-billing.md` | NMI connector mastery |
| 12 | Hyperswitch payments | hyperswitch, newleaf-pay, payment routes, gateway | `playbooks/billing/playbook-billing.md` | Hyperswitch connector |

### P0: CUSTOMER SUPPORT & TRIAGE (Human Safety Net)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 13 | Customer 360 lookup | customer 360, look up, who is, check on, pull up, find customer, account | `playbooks/customer-support/playbook-customer-support.md` | Full cross-system dossier |
| 14 | Create support ticket | ticket, create ticket, open issue, support request, help ticket | `playbooks/customer-support/playbook-customer-support.md` | SupportTicket entity |
| 15 | Triage a ticket | triage, classify, route, assign, priority, sla | `playbooks/customer-support/playbook-customer-support.md` | SLA tracking (4h critical) |
| 16 | Resolve a ticket | resolve, close ticket, fix issue, ticket done | `playbooks/customer-support/playbook-customer-support.md` | Resolution + 48h cooldown |
| 17 | Chargeback risk | chargeback, unauthorized, didn't authorize, bank shut down | `playbooks/customer-support/playbook-customer-support.md` | P0 escalation → disputes |
| 18 | Customer complaint | complaint, angry, frustrated, unhappy, mad | `playbooks/customer-support/playbook-customer-support.md` | Sentiment + escalation |
| 19 | General customer inquiry | question, ask, how do I, what is, explain to customer | `playbooks/customer-support/playbook-customer-support.md` | First-line support |

### P0: DISPUTES & FCRA COMPLIANCE

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 20 | Start dispute round | dispute, challenge, remove from credit, fix credit, delete item | `playbooks/disputes/playbook-disputes.md` | FCRA 30-day clock |
| 21 | Track dispute response | dispute status, bureau response, what happened with, responded | `playbooks/disputes/playbook-disputes.md` | Response tracking mandatory |
| 22 | Prepare dispute letter | draft letter, write dispute, bureau letter, fcRA letter | `playbooks/disputes/playbook-disputes.md` | Forth letter generation |
| 23 | Round 2 dispute | round 2, second dispute, escalated, reinvestigation | `playbooks/disputes/playbook-disputes.md` | Supervisor review required |
| 24 | Credit report review | credit report, pull report, check credit, score, negative items | `playbooks/disputes/playbook-disputes.md` | NegativeItem identification |
| 25 | FCRA compliance check | fcra, compliance, statutory, deadline, violation | `playbooks/disputes/playbook-disputes.md` | 30/45-day statutory windows |

### P1: DEPLOY & SHIP (Vercel + GitHub)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 26 | Ship a feature | ship, deploy, land, merge, release, push to prod | `playbooks/deploy-vercel-github/playbook-deploy.md` | Vercel + GitHub PR flow |
| 27 | Create a PR | pr, pull request, open pr, create pr, merge request | `playbooks/deploy-vercel-github/playbook-deploy.md` | GitHub connector PR workflow |
| 28 | Diagnose stale UI | stale, not updating, old version, cache, didn't change | `playbooks/deploy-vercel-github/playbook-deploy.md` | Vercel cache + rebuild |
| 29 | Rollback deployment | rollback, revert, undo deploy, go back, previous version | `playbooks/deploy-vercel-github/playbook-deploy.md` | Vercel rollback |
| 30 | Deploy to Vercel | vercel, deploy to vercel, push live, ship to cloud | `playbooks/vercel-discipline/playbook-vercel-discipline.md` | Vercel deployment standards |
| 31 | Check deployment status | is it live, deploy status, build status, vercel check | `playbooks/vercel-discipline/playbook-vercel-discipline.md` | Build + deployment verification |
| 32 | Vercel security/config | env vars, vercel config, domain, security headers, edge | `playbooks/vercel-discipline/playbook-vercel-discipline.md` | Environment audit |

### P1: ENGINEERING & CODE

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 33 | Code review | review, code review, audit code, look at this code | `playbooks/engineering/playbook-engineering.md` | Review patterns + quality gates |
| 34 | Architecture decision | should we, which approach, architecture, design, pattern | `playbooks/engineering/playbook-engineering.md` | ADR process |
| 35 | Write a PRD | write prd, spec out, plan feature, document requirement | `playbooks/engineering/playbook-engineering.md` | PRD template + standards |
| 36 | Refactor code | refactor, clean up, improve, restructure, reorganize | `playbooks/engineering/playbook-engineering.md` | Pattern mapping |
| 37 | Debug an issue | debug, bug, error, not working, broken, crash, why is | `playbooks/engineering/playbook-engineering.md` | Scientific debug method |
| 38 | Build a feature | build, create, implement, add, make, new feature | `playbooks/engineering/playbook-engineering.md` | Feature implementation |
| 39 | MCP/code edit | edit file, fix code, change, modify, update code | `playbooks/engineering/playbook-engineering.md` | MCP edits discipline |

### P1: AGENT ORCHESTRATION

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 40 | Dispatch a task | dispatch, send to agent, assign, handoff, delegate | `playbooks/agent-orchestration/playbook-agent-orchestration.md` | Agent routing + dispatch |
| 41 | Multi-agent coordination | multi agent, parallel, team, swarm, collaborate | `playbooks/agent-orchestration/playbook-agent-orchestration.md` | Cross-agent task delegation |
| 42 | Agent failure recovery | agent failed, retry, stuck, error, dispatch error | `playbooks/agent-orchestration/playbook-agent-orchestration.md` | Self-healing after failure |
| 43 | Check agent status | agent status, who is working, what is running, tasks | `playbooks/agent-orchestration/playbook-agent-orchestration.md` | Agent availability + load |
| 44 | Spawn coding agent | spawn, v2 sandbox, sandbox, coding agent, handoff to v2 | `playbooks/agent-orchestration/playbook-agent-orchestration.md` | V2 E2B sandbox handoff |

### P1: REPORTING & ANALYTICS

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 45 | Morning pulse | morning pulse, daily report, today summary, overview | `playbooks/reporting/playbook-reporting.md` | reportingHub.overview |
| 46 | Customer metrics | how many customers, mrr, revenue, churn, growth | `playbooks/reporting/playbook-reporting.md` | Aggregated metrics |
| 47 | Billing recon | billing chain, recon, broken chains, sync health | `playbooks/reporting/playbook-reporting.md` | Hourly chain reconciliation |
| 48 | Agent performance | agent metrics, commissions, performance, sales | `playbooks/reporting/playbook-reporting.md` | Agent KPIs |
| 49 | Sync health audit | sync health, data freshness, warehouse, ingestion | `playbooks/reporting/playbook-reporting.md` | Warehouse + ChromaDB |
| 50 | Enrollment funnel | enrollment stats, funnel, conversion, stuck, pipeline | `playbooks/reporting/playbook-reporting.md` | Enrollment funnel metrics |
| 51 | Create custom report | report, analytics, query, stats, dashboard, metrics | `playbooks/reporting/playbook-reporting.md` | Custom reporting hub queries |

### P1: VPS OPERATIONS

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 52 | VPS health check | vps health, server status, system check, cpu, memory | `playbooks/vps-ops/playbook-vps-ops.md` | pm2 + nginx + Cloudflare |
| 53 | VPS incident response | vps down, server crashed, outage, offline, not responding | `playbooks/vps-ops/playbook-vps-ops.md` | Incident playbook |
| 54 | Deploy to VPS | vps deploy, update server, restart service, pm2 | `playbooks/vps-ops/playbook-vps-ops.md` | pm2 + git pull workflow |
| 55 | Check logs | logs, error log, access log, nginx log, pm2 log | `playbooks/vps-ops/playbook-vps-ops.md` | Log inspection |
| 56 | SSL/certificate | ssl, cert, https, certificate, tls, expired | `playbooks/vps-ops/playbook-vps-ops.md` | Certbot + Cloudflare |

### P2: MARKETING & LEAD FLOW

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 57 | Campaign management | campaign, dialer, outbound, call campaign, auto dialer | `playbooks/marketing/playbook-marketing.md` | GHL campaigns |
| 58 | Lead nurture | nurture, sequence, follow up, drip, sms sequence | `playbooks/marketing/playbook-marketing.md` | Automation sequences |
| 59 | SMS/email blast | blast, mass sms, bulk email, broadcast, send to all | `playbooks/marketing/playbook-marketing.md` | 10DLC compliance |
| 60 | DNC compliance | dnc, do not call, opt out, unsubscribe, stop | `playbooks/marketing/playbook-marketing.md` | DncList entity |
| 61 | Marketing analytics | campaign roi, conversion rate, lead source, attribution | `playbooks/marketing/playbook-marketing.md` | Campaign performance |
| 62 | Enrollment sequence | enrollment flow, signup, onboarding sequence, welcome | `playbooks/marketing/playbook-marketing.md` | 3,165 active sequences |

### P2: HR & TEAM

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 63 | Team status check | team, who is working, agent availability, staffing | `playbooks/HR/playbook-HR.md` | Agent availability |
| 64 | Onboarding | onboard, new hire, new agent, welcome, setup account | `playbooks/HR/playbook-HR.md` | Personnel onboarding |
| 65 | Compliance training | training, pci training, compliance, certification | `playbooks/HR/playbook-HR.md` | PCI DSS training tracking |

### CROSS-CUTTING: CONNECTOR-SPECIFIC

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 66 | Slack operations | slack, post to slack, send message, channel, dm, notify | `connectors/slack/PLAYBOOK.md` | Slack connector mastery |
| 67 | GitHub operations | github, repo, commit, branch, clone, git, push | `connectors/github/PLAYBOOK.md` | GitHub connector mastery |
| 68 | Vercel operations | vercel, deploy, preview, production, domain, env | `connectors/vercel/PLAYBOOK.md` | Vercel connector mastery |
| 69 | Vapi call operations | vapi, call, haley, phone, dial, transcript | `connectors/vapi/PLAYBOOK.md` | Vapi connector mastery |
| 70 | Linear project mgmt | linear, issue, project, sprint, ticket, backlog | `connectors/linear/PLAYBOOK.md` | Linear connector |
| 71 | GHL marketing ops | ghl, gohighlevel, crm, pipeline, contact | `connectors/ghl/PLAYBOOK.md` | GHL connector |
| 72 | Wiki/docs operations | wiki, docs, document, knowledge base, confluence | `connectors/wiki/PLAYBOOK.md` | Wiki connector |
| 73 | Hyperswitch payment | hyperswitch, payment gateway, processor, routing | `connectors/hyperswitch/PLAYBOOK.md` | Hyperswitch connector |
| 74 | Affy operations | affy, affiliate, partner, referral | `connectors/affy/PLAYBOOK.md` | Affy connector |
| 75 | Forth operations | forth, credit, bureau, equifax, experian, transunion | `connectors/forth/PLAYBOOK.md` | Forth connector |
| 76 | MCP hub operations | mcp hub, connect, integration, api, register | `connectors/mcp-hub/PLAYBOOK.md` | MCP hub connector |
| 77 | Base44 operations | base44, entity, query, customer, create, update | `connectors/base44/PLAYBOOK.md` | Base44 connector mastery |

### FALLBACK & META

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 78 | List all playbooks | what playbooks exist, list domains, show operations | `playbooks/playbook-index.md` | Domain discovery |
| 79 | What can you do | capabilities, what can you do, help, how to use | `playbooks/playbook-index.md` | Capability discovery |
| 80 | I don't know where | not sure, don't know, which playbook, where should I | `playbooks/playbook-index.md` | Fallback: list all domains |
| 81 | Create new skill | new skill, author skill, create skill, build skill | `playbooks/engineering/playbook-engineering.md` | skill-author capability |
| 82 | System/I need meta help | anything not matching above | `playbooks/playbook-index.md` | Default: show the index |

---

## ANTI-PATTERNS (WHAT THE AGENT MUST NEVER DO)

| # | Anti-Pattern | Why Wrong | Correct Approach |
|---|-------------|----------|-----------------|
| 1 | **Skipping the router** — going directly to grep/tools | 400+ tools/functions, you WILL pick the wrong one | Read THIS file first. Match intent. Load playbook. |
| 2 | **Loading multiple playbooks** | Fragmented context — you'll mix safeguards from different domains | Pick ONE playbook based on DOMINANT intent |
| 3 | **Guessing a routine** — not loading the playbook | You'll miss critical safeguards and anti-patterns | `load_skill` the playbook BEFORE executing |
| 4 | **Grep-searching tools** instead of following playbook | The playbook tells you EXACTLY which tools to use | Trust the playbook's Toolbox section |
| 5 | **Reading files directly** without playbook guidance | You'll read wrong files, miss related context | The playbook maps files → functions → connectors |
| 6 | **Executing without safeguards** | Billing: might charge without vault check. Disputes: might miss FCRA deadline. | Read Safeguards section BEFORE any tool call |
| 7 | **Using deprecated API fields** (e.g., `source_transaction_id`) | Breaks billing chain, causes chargebacks | Playbook Anti-Patterns section lists banned fields |
| 8 | **Parallelizing across domains** | Each domain has different safeguards, mixing them breaks both | Complete one domain task before starting another |

---

## HOW TO USE THIS ROUTER (Agent Protocol)

1. **Step 1: Read intent.** Extract the user's dominant business intent from their message.
2. **Step 2: Match trigger.** Find matching trigger keywords in the table above. If multiple match, pick the highest-priority (P0 > P1 > P2).
3. **Step 3: Load playbook.** Use `load_skill` with the exact playbook path from the table.
4. **Step 4: Read safeguards.** Before executing ANY tool call, read the playbook's Safeguards and Anti-Patterns sections.
5. **Step 5: Execute SOP.** Follow the playbook's workflow steps in order. Respect [PARALLEL] markers.
6. **Step 6: Annotate.** After completion, append outcome + learnings back to the playbook (annotation loop).

---

## PLAYBOOK FILE PATHS (Quick Reference)

```
Playbooks (Domain SOPs):
  playbooks/billing/playbook-billing.md                     — Billing & Payments
  playbooks/customer-support/playbook-customer-support.md   — Support Triage
  playbooks/disputes/playbook-disputes.md                   — Credit Disputes
  playbooks/deploy-vercel-github/playbook-deploy.md         — Deploy & Ship
  playbooks/engineering/playbook-engineering.md             — Engineering & Code
  playbooks/agent-orchestration/playbook-agent-orchestration.md — Agent Orchestration
  playbooks/reporting/playbook-reporting.md                 — Reporting & Analytics
  playbooks/vps-ops/playbook-vps-ops.md                     — VPS Operations
  playbooks/vercel-discipline/playbook-vercel-discipline.md — Vercel Discipline
  playbooks/marketing/playbook-marketing.md                 — Marketing & Leads
  playbooks/HR/playbook-HR.md                               — HR & Team

Connector Playbooks (Tool Mastery):
  connectors/base44/PLAYBOOK.md   connectors/slack/PLAYBOOK.md
  connectors/nmi/PLAYBOOK.md      connectors/github/PLAYBOOK.md
  connectors/vercel/PLAYBOOK.md   connectors/vapi/PLAYBOOK.md
  connectors/ghl/PLAYBOOK.md      connectors/linear/PLAYBOOK.md
  connectors/wiki/PLAYBOOK.md     connectors/hyperswitch/PLAYBOOK.md
  connectors/forth/PLAYBOOK.md    connectors/affy/PLAYBOOK.md
  connectors/mcp-hub/PLAYBOOK.md

Index:
  playbooks/playbook-index.md — Full domain catalog (use when unsure)
```

---

## CARDINAL RULES (LOCKED — NEVER VIOLATE)

1. **PLAYBOOK-ROUTER.md is THE entry point.** Read it FIRST on every user message.
2. **ONE playbook at a time.** Pick based on dominant intent.
3. **NEVER grep tools directly.** The playbook tells you what to use.
4. **Safeguards BEFORE execution.** Read the playbook's Safeguards section before any tool call.
5. **Anti-patterns are law.** If a playbook says "NEVER do X," you NEVER do X.
6. **Slack #jarvis-admin ONLY.** Never newleaf-admin.
7. **NEVER real customer data** in test/smoke scenarios.
8. **Commit author:** abhiswami2121 <abhiswami2121@gmail.com>.
9. **NEVER cancel other agent sessions.**
10. **After every execution, annotate** back to the playbook (outcome, duration, error, learning).
11. **Pattern A+1:** Only 7 tools (the 6 gatekeepers + run_workflow). No additional tool discovery.
12. **Vercel REST API only** — never use Vercel CLI on VPS.
13. **NEVER edit VPS Python scripts or pm2 reload** (cardinal 6a153d63).

---

*End of PLAYBOOK-ROUTER.md. Load your playbook now.*
