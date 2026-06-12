/**
 * Slack Comprehensive Client — U2.3.B (27 actions)
 *
 * Wraps Slack Web API operations behind a typed action router.
 * Uses @slack/web-api WebClient with secrets.slack.botToken.
 *
 * Actions:
 *   READ:  list_channels, get_channel, channel_history, thread_replies,
 *          search_messages, list_users, get_user, get_user_by_email,
 *          get_reactions, get_channel_members, get_team_info, get_user_presence
 *   WRITE: send_message, send_thread_reply, send_dm, add_reaction,
 *          remove_reaction, update_message, delete_message, set_topic,
 *          set_purpose, upload_file, schedule_message, invite_to_channel,
 *          kick_from_channel
 *   BULK:  bulk_send, bulk_react
 *
 * Usage:
 *   import { execute } from "@/connectors/slack/client";
 *   const result = await execute({ action: "send_message", args: { channel: "#general", text: "Hello" } });
 */

import { WebClient } from "@slack/web-api";
import { secrets } from "@/secrets";

// ── Client Setup ──────────────────────────────────────────────────────────────

const SLACK_BOT_TOKEN = secrets.slack.botToken;

function getClient(): WebClient {
  if (!SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN is required for Slack connector");
  }
  return new WebClient(SLACK_BOT_TOKEN);
}

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

// ── Helper ────────────────────────────────────────────────────────────────────

function ok(data: unknown, action: string): ActionResponse {
  return { success: true, action, data };
}

function fail(action: string, err: unknown): ActionResponse {
  const msg = err instanceof Error ? err.message : String(err);
  return { success: false, error: `${action} failed: ${msg}` };
}

// ── READ Actions ──────────────────────────────────────────────────────────────

async function listChannels(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const limit = (args?.limit as number) || 100;
    const types = (args?.types as string) || "public_channel,private_channel";
    const result = await client.conversations.list({
      limit,
      types,
      exclude_archived: args?.exclude_archived !== false,
    });
    return ok({ channels: result.channels, response_metadata: result.response_metadata }, "list_channels");
  } catch (e) { return fail("list_channels", e); }
}

async function getChannel(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channelId = args?.channel as string;
    if (!channelId) return { success: false, error: "Missing required arg: channel" };
    const result = await client.conversations.info({ channel: channelId });
    return ok(result.channel, "get_channel");
  } catch (e) { return fail("get_channel", e); }
}

async function channelHistory(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    if (!channel) return { success: false, error: "Missing required arg: channel" };
    const limit = (args?.limit as number) || 100;
    const result = await client.conversations.history({ channel, limit });
    return ok({ messages: result.messages, has_more: result.has_more }, "channel_history");
  } catch (e) { return fail("channel_history", e); }
}

async function threadReplies(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const ts = args?.ts as string;
    if (!channel || !ts) return { success: false, error: "Missing required args: channel and ts" };
    const result = await client.conversations.replies({ channel, ts });
    return ok({ messages: result.messages, has_more: result.has_more }, "thread_replies");
  } catch (e) { return fail("thread_replies", e); }
}

async function searchMessages(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const query = args?.query as string;
    if (!query) return { success: false, error: "Missing required arg: query" };
    const count = (args?.count as number) || 20;
    const result = await client.search.messages({ query, count });
    return ok(result.messages, "search_messages");
  } catch (e) { return fail("search_messages", e); }
}

async function listUsers(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const limit = (args?.limit as number) || 200;
    const result = await client.users.list({ limit });
    return ok({ members: result.members, response_metadata: result.response_metadata }, "list_users");
  } catch (e) { return fail("list_users", e); }
}

async function getUser(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const user = args?.user as string;
    if (!user) return { success: false, error: "Missing required arg: user" };
    const result = await client.users.info({ user });
    return ok(result.user, "get_user");
  } catch (e) { return fail("get_user", e); }
}

async function getUserByEmail(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const email = args?.email as string;
    if (!email) return { success: false, error: "Missing required arg: email" };
    const result = await client.users.lookupByEmail({ email });
    return ok(result.user, "get_user_by_email");
  } catch (e) { return fail("get_user_by_email", e); }
}

async function getReactions(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const ts = args?.ts as string;
    if (!channel || !ts) return { success: false, error: "Missing required args: channel and ts" };
    const result = await client.reactions.get({ channel, timestamp: ts, full: true });
    return ok(result, "get_reactions");
  } catch (e) { return fail("get_reactions", e); }
}

async function getChannelMembers(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    if (!channel) return { success: false, error: "Missing required arg: channel" };
    const limit = (args?.limit as number) || 500;
    const result = await client.conversations.members({ channel, limit });
    return ok({ members: result.members, response_metadata: result.response_metadata }, "get_channel_members");
  } catch (e) { return fail("get_channel_members", e); }
}

async function getTeamInfo(_args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const result = await client.team.info();
    return ok(result.team, "get_team_info");
  } catch (e) { return fail("get_team_info", e); }
}

async function getUserPresence(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const user = args?.user as string;
    if (!user) return { success: false, error: "Missing required arg: user" };
    const result = await client.users.getPresence({ user });
    return ok(result, "get_user_presence");
  } catch (e) { return fail("get_user_presence", e); }
}

// ── WRITE Actions ─────────────────────────────────────────────────────────────

async function sendMessage(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const text = args?.text as string;
    if (!channel || text === undefined) return { success: false, error: "Missing required args: channel and text" };
    const blocks = args?.blocks;
    const result = await client.chat.postMessage({
      channel,
      text,
      ...(blocks ? { blocks: blocks as never } : {}),
      ...(args?.thread_ts ? { thread_ts: args.thread_ts as string } : {}),
    });
    return ok({ channel: result.channel, ts: result.ts }, "send_message");
  } catch (e) { return fail("send_message", e); }
}

async function sendThreadReply(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const text = args?.text as string;
    const threadTs = args?.thread_ts as string;
    if (!channel || text === undefined || !threadTs) {
      return { success: false, error: "Missing required args: channel, text, and thread_ts" };
    }
    const result = await client.chat.postMessage({ channel, text, thread_ts: threadTs });
    return ok({ channel: result.channel, ts: result.ts }, "send_thread_reply");
  } catch (e) { return fail("send_thread_reply", e); }
}

async function sendDm(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const user = args?.user as string;
    const text = args?.text as string;
    if (!user || text === undefined) return { success: false, error: "Missing required args: user and text" };
    // Open DM channel
    const dm = await client.conversations.open({ users: user });
    if (!dm.ok || !dm.channel?.id) return { success: false, error: "Failed to open DM channel" };
    const result = await client.chat.postMessage({ channel: dm.channel.id, text });
    return ok({ channel: result.channel, ts: result.ts }, "send_dm");
  } catch (e) { return fail("send_dm", e); }
}

async function addReaction(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const name = args?.name as string;
    const timestamp = args?.timestamp as string;
    if (!channel || !name || !timestamp) {
      return { success: false, error: "Missing required args: channel, name, and timestamp" };
    }
    const result = await client.reactions.add({ channel, name, timestamp });
    return ok({ ok: result.ok }, "add_reaction");
  } catch (e) { return fail("add_reaction", e); }
}

async function removeReaction(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const name = args?.name as string;
    const timestamp = args?.timestamp as string;
    if (!channel || !name || !timestamp) {
      return { success: false, error: "Missing required args: channel, name, and timestamp" };
    }
    const result = await client.reactions.remove({ channel, name, timestamp });
    return ok({ ok: result.ok }, "remove_reaction");
  } catch (e) { return fail("remove_reaction", e); }
}

async function updateMessage(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const ts = args?.ts as string;
    const text = args?.text as string;
    if (!channel || !ts || text === undefined) {
      return { success: false, error: "Missing required args: channel, ts, and text" };
    }
    const result = await client.chat.update({ channel, ts, text });
    return ok({ channel: result.channel, ts: result.ts }, "update_message");
  } catch (e) { return fail("update_message", e); }
}

async function deleteMessage(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const ts = args?.ts as string;
    if (!channel || !ts) return { success: false, error: "Missing required args: channel and ts" };
    const result = await client.chat.delete({ channel, ts });
    return ok({ ok: result.ok }, "delete_message");
  } catch (e) { return fail("delete_message", e); }
}

async function setTopic(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const topic = args?.topic as string;
    if (!channel || topic === undefined) return { success: false, error: "Missing required args: channel and topic" };
    const result = await client.conversations.setTopic({ channel, topic });
    return ok({ ok: result.ok, topic }, "set_topic");
  } catch (e) { return fail("set_topic", e); }
}

async function setPurpose(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const purpose = args?.purpose as string;
    if (!channel || purpose === undefined) return { success: false, error: "Missing required args: channel and purpose" };
    const result = await client.conversations.setPurpose({ channel, purpose });
    return ok({ ok: result.ok, purpose }, "set_purpose");
  } catch (e) { return fail("set_purpose", e); }
}

async function uploadFile(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channels = args?.channels as string;
    const content = args?.content as string;
    const filename = (args?.filename as string) || "upload.txt";
    const title = (args?.title as string) || "";
    if (!channels || content === undefined) {
      return { success: false, error: "Missing required args: channels and content" };
    }
    const result = await (client as Record<string, any>).files.uploadV2({
      channel_id: channels,
      content,
      filename,
      title,
    });
    return ok({ files: result.files }, "upload_file");
  } catch (e) { return fail("upload_file", e); }
}

async function scheduleMessage(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const text = args?.text as string;
    const postAt = args?.post_at as number;
    if (!channel || text === undefined || !postAt) {
      return { success: false, error: "Missing required args: channel, text, and post_at (Unix timestamp)" };
    }
    const result = await client.chat.scheduleMessage({
      channel,
      text,
      post_at: String(postAt),
    });
    return ok({ channel: result.channel, scheduled_message_id: result.scheduled_message_id }, "schedule_message");
  } catch (e) { return fail("schedule_message", e); }
}

async function inviteToChannel(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const users = args?.users as string;
    if (!channel || !users) return { success: false, error: "Missing required args: channel and users (comma-separated IDs)" };
    const result = await client.conversations.invite({ channel, users });
    return ok({ ok: result.ok }, "invite_to_channel");
  } catch (e) { return fail("invite_to_channel", e); }
}

async function kickFromChannel(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channel = args?.channel as string;
    const user = args?.user as string;
    if (!channel || !user) return { success: false, error: "Missing required args: channel and user" };
    const result = await client.conversations.kick({ channel, user });
    return ok({ ok: result.ok }, "kick_from_channel");
  } catch (e) { return fail("kick_from_channel", e); }
}

// ── BULK Actions ──────────────────────────────────────────────────────────────

async function bulkSend(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const channels = args?.channels as string[];
    const text = args?.text as string;
    if (!channels?.length || text === undefined) {
      return { success: false, error: "Missing required args: channels (string[]) and text" };
    }
    const results = await Promise.allSettled(
      channels.map((ch) =>
        client.chat.postMessage({ channel: ch, text }).then((r) => ({ channel: r.channel, ts: r.ts }))
      )
    );
    return ok({
      total: channels.length,
      succeeded: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
      results,
    }, "bulk_send");
  } catch (e) { return fail("bulk_send", e); }
}

async function bulkReact(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const client = getClient();
    const reacts = args?.reacts as Array<{ channel: string; name: string; timestamp: string }>;
    if (!reacts?.length) return { success: false, error: "Missing required arg: reacts (array of {channel, name, timestamp})" };
    const results = await Promise.allSettled(
      reacts.map((r) =>
        client.reactions.add({ channel: r.channel, name: r.name, timestamp: r.timestamp }).then(() => ({ ok: true, ...r }))
      )
    );
    return ok({
      total: reacts.length,
      succeeded: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    }, "bulk_react");
  } catch (e) { return fail("bulk_react", e); }
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
    // READ
    case "list_channels": return listChannels(args);
    case "get_channel": return getChannel(args);
    case "channel_history": return channelHistory(args);
    case "thread_replies": return threadReplies(args);
    case "search_messages": return searchMessages(args);
    case "list_users": return listUsers(args);
    case "get_user": return getUser(args);
    case "get_user_by_email": return getUserByEmail(args);
    case "get_reactions": return getReactions(args);
    case "get_channel_members": return getChannelMembers(args);
    case "get_team_info": return getTeamInfo(args);
    case "get_user_presence": return getUserPresence(args);
    // WRITE
    case "send_message": return sendMessage(args);
    case "send_thread_reply": return sendThreadReply(args);
    case "send_dm": return sendDm(args);
    case "add_reaction": return addReaction(args);
    case "remove_reaction": return removeReaction(args);
    case "update_message": return updateMessage(args);
    case "delete_message": return deleteMessage(args);
    case "set_topic": return setTopic(args);
    case "set_purpose": return setPurpose(args);
    case "upload_file": return uploadFile(args);
    case "schedule_message": return scheduleMessage(args);
    case "invite_to_channel": return inviteToChannel(args);
    case "kick_from_channel": return kickFromChannel(args);
    // BULK
    case "bulk_send": return bulkSend(args);
    case "bulk_react": return bulkReact(args);

    default:
      return {
        success: false,
        error: `Unknown action: '${action}'. Available: ${availableActions.slice(0, 15).join(", ")}... (${availableActions.length} total)`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
  // READ
  "list_channels", "get_channel", "channel_history", "thread_replies",
  "search_messages", "list_users", "get_user", "get_user_by_email",
  "get_reactions", "get_channel_members", "get_team_info", "get_user_presence",
  // WRITE
  "send_message", "send_thread_reply", "send_dm", "add_reaction",
  "remove_reaction", "update_message", "delete_message", "set_topic",
  "set_purpose", "upload_file", "schedule_message", "invite_to_channel",
  "kick_from_channel",
  // BULK
  "bulk_send", "bulk_react",
];

export default { execute, availableActions };
