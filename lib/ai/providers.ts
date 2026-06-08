import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider, gateway } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

// ── Direct DeepSeek client (lazy init) ──────────────────────────────
// Created lazily so process.env is guaranteed populated at call time.
// Uses the user's own DEEPSEEK_API_KEY from Vercel env — bypasses
// Vercel AI Gateway entirely.

let _deepseekDirect: ReturnType<typeof createOpenAICompatible> | null = null;

function getDeepSeekDirect() {
  if (!_deepseekDirect) {
    _deepseekDirect = createOpenAICompatible({
      baseURL: "https://api.deepseek.com/v1",
      name: "deepseek-direct",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }
  return _deepseekDirect;
}

// Internal model ID → DeepSeek API model name mapping
const DEEPSEEK_MODEL_MAP: Record<string, string> = {
  "deepseek-v4-pro": "deepseek-chat", // DeepSeek V4 Pro → deepseek-chat (latest)
  "deepseek-reasoner": "deepseek-reasoner", // DeepSeek R1 reasoning
};

// Which internal model IDs route through the direct DeepSeek pipeline
const DIRECT_DEEPSEEK_IDS = new Set(Object.keys(DEEPSEEK_MODEL_MAP));

// ── Test mock provider ──────────────────────────────────────────────

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

// ── Language model resolver ─────────────────────────────────────────

export function getLanguageModel(modelId: string) {
  // Test environment → mock
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  // Direct DeepSeek models → user's own API key, NO gateway
  if (DIRECT_DEEPSEEK_IDS.has(modelId)) {
    const apiModelName = DEEPSEEK_MODEL_MAP[modelId];
    return getDeepSeekDirect().chatModel(apiModelName);
  }

  // Everything else → Vercel AI Gateway (needs AI_GATEWAY_API_KEY)
  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return gateway.languageModel(titleModel.id);
}
