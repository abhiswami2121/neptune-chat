/**
 * Hyperswitch Comprehensive Client — U2.3.D (22 actions)
 *
 * Wraps Hyperswitch payment orchestration behind a typed action router.
 * Proxies through VPS tools bridge (Hyperswitch API key stays on VPS).
 * Hyperswitch also has an MCP server for standard payment operations.
 *
 * Actions:
 *   PAYMENTS:   create_payment, get_payment, capture_payment, cancel_payment, list_payments
 *   METHODS:    list_payment_methods, get_payment_method, delete_payment_method
 *   CUSTOMERS:  create_customer, get_customer, update_customer
 *   REFUNDS:    create_refund, get_refund, list_refunds
 *   SUBSCRIPTIONS: create_subscription, get_subscription, update_subscription, cancel_subscription
 *   WEBHOOKS:   list_events, retry_event
 *   COF:        gateway_failover, cof_audit
 *
 * Usage:
 *   import { execute } from "@/connectors/hyperswitch/client";
 *   const result = await execute({ action: "list_payments", args: { limit: 10 } });
 */

import { secrets } from "@/secrets";

// ── Bridge Config ─────────────────────────────────────────────────────────────

const BRIDGE_URL = secrets.vps.toolsBridgeUrl;
const BASE44_KEY = secrets.base44.apiKey;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionRequest {
  action: string;
  args?: Record<string, unknown>;
}

export interface ActionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  action?: string;
}

// ── Bridge Helper ─────────────────────────────────────────────────────────────

async function bridgeCall(
  hsAction: string,
  actionName: string,
  payload: Record<string, unknown> = {}
): Promise<ActionResponse> {
  if (!BRIDGE_URL) {
    return { success: false, error: "VPS_TOOLS_BRIDGE_URL not configured" };
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/tool/hyperswitch/${hsAction}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BASE44_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        success: false,
        error: `Hyperswitch bridge returned ${res.status}: ${res.statusText}`,
        action: actionName,
      };
    }
    const data = await res.json();
    return { success: true, action: actionName, data };
  } catch (err) {
    return {
      success: false,
      error: `Hyperswitch bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
      action: actionName,
    };
  }
}

// ── PAYMENT Actions ───────────────────────────────────────────────────────────

async function createPayment(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createPayment", "create_payment", args || {});
}

async function getPayment(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getPayment", "get_payment", args || {});
}

async function capturePayment(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("capturePayment", "capture_payment", args || {});
}

async function cancelPayment(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cancelPayment", "cancel_payment", args || {});
}

async function listPayments(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("listPayments", "list_payments", args || {});
}

// ── PAYMENT METHOD Actions ────────────────────────────────────────────────────

async function listPaymentMethods(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("listPaymentMethods", "list_payment_methods", args || {});
}

async function getPaymentMethod(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getPaymentMethod", "get_payment_method", args || {});
}

async function deletePaymentMethod(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("deletePaymentMethod", "delete_payment_method", args || {});
}

// ── CUSTOMER Actions ──────────────────────────────────────────────────────────

async function createCustomer(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createCustomer", "create_customer", args || {});
}

async function getCustomer(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getCustomer", "get_customer", args || {});
}

async function updateCustomer(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("updateCustomer", "update_customer", args || {});
}

// ── REFUND Actions ────────────────────────────────────────────────────────────

async function createRefund(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createRefund", "create_refund", args || {});
}

async function getRefund(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getRefund", "get_refund", args || {});
}

async function listRefunds(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("listRefunds", "list_refunds", args || {});
}

// ── SUBSCRIPTION Actions ──────────────────────────────────────────────────────

async function createSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createSubscription", "create_subscription", args || {});
}

async function getSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getSubscription", "get_subscription", args || {});
}

async function updateSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("updateSubscription", "update_subscription", args || {});
}

async function cancelSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cancelSubscription", "cancel_subscription", args || {});
}

// ── WEBHOOK Actions ───────────────────────────────────────────────────────────

async function listEvents(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("listEvents", "list_events", args || {});
}

async function retryEvent(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("retryEvent", "retry_event", args || {});
}

// ── CoF (Gateway Failover) Actions ────────────────────────────────────────────

async function gatewayFailover(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gatewayFailover", "gateway_failover", args || {});
}

async function cofAudit(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofAudit", "cof_audit", args || {});
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
    // PAYMENTS
    case "create_payment": return createPayment(args);
    case "get_payment": return getPayment(args);
    case "capture_payment": return capturePayment(args);
    case "cancel_payment": return cancelPayment(args);
    case "list_payments": return listPayments(args);
    // PAYMENT METHODS
    case "list_payment_methods": return listPaymentMethods(args);
    case "get_payment_method": return getPaymentMethod(args);
    case "delete_payment_method": return deletePaymentMethod(args);
    // CUSTOMERS
    case "create_customer": return createCustomer(args);
    case "get_customer": return getCustomer(args);
    case "update_customer": return updateCustomer(args);
    // REFUNDS
    case "create_refund": return createRefund(args);
    case "get_refund": return getRefund(args);
    case "list_refunds": return listRefunds(args);
    // SUBSCRIPTIONS
    case "create_subscription": return createSubscription(args);
    case "get_subscription": return getSubscription(args);
    case "update_subscription": return updateSubscription(args);
    case "cancel_subscription": return cancelSubscription(args);
    // WEBHOOKS
    case "list_events": return listEvents(args);
    case "retry_event": return retryEvent(args);
    // CoF
    case "gateway_failover": return gatewayFailover(args);
    case "cof_audit": return cofAudit(args);

    default:
      return {
        success: false,
        error: `Unknown action: '${action}'. Available: ${availableActions.slice(0, 15).join(", ")}... (${availableActions.length} total)`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
  // PAYMENTS
  "create_payment", "get_payment", "capture_payment", "cancel_payment", "list_payments",
  // PAYMENT METHODS
  "list_payment_methods", "get_payment_method", "delete_payment_method",
  // CUSTOMERS
  "create_customer", "get_customer", "update_customer",
  // REFUNDS
  "create_refund", "get_refund", "list_refunds",
  // SUBSCRIPTIONS
  "create_subscription", "get_subscription", "update_subscription", "cancel_subscription",
  // WEBHOOKS
  "list_events", "retry_event",
  // CoF
  "gateway_failover", "cof_audit",
];

export default { execute, availableActions };
