export type LlmProvider = "deepseek" | "dashscope";

export type LlmProviderConfig = {
  id: LlmProvider;
  label: string;
  defaultBaseUrl: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
};

export const LLM_PROVIDERS: LlmProviderConfig[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-v4-flash",
  },
  {
    id: "dashscope",
    label: "阿里云百炼",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    baseUrlEnv: "DASHSCOPE_BASE_URL",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    modelEnv: "DASHSCOPE_MODEL",
    defaultModel: "qwen3.6-flash",
  },
];

export function isLlmProvider(value: string): value is LlmProvider {
  return LLM_PROVIDERS.some((provider) => provider.id === value);
}

export function getLlmProvider(id: string): LlmProviderConfig | undefined {
  return LLM_PROVIDERS.find((provider) => provider.id === id);
}

export type LlmChatMessage = { role: "system" | "user"; content: string };

/**
 * Server-only chat completion helper. API keys are always read from
 * server-side environment variables and never leave the server. Returns the
 * model actually used so callers can record it.
 */
export async function runChatCompletion(options: {
  provider: LlmProvider;
  model?: string;
  messages: LlmChatMessage[];
  temperature?: number;
  json?: boolean;
}): Promise<{ content: string; model: string; usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null }> {
  const provider = getLlmProvider(options.provider);
  if (!provider) throw new Error(`不支持的模型提供方：${options.provider}。`);

  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`服务端尚未配置 ${provider.apiKeyEnv}，请先在 .env.local 中设置。`);
  }

  const model = options.model || process.env[provider.modelEnv] || provider.defaultModel;
  const baseUrl = (process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.45,
      ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`LLM API error (${provider.id})`, response.status, body);
    const snippet = body.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
    const detail = snippet ? `（HTTP ${response.status} ${snippet}）` : `（HTTP ${response.status}）`;
    throw new Error(`${provider.label} 服务暂时不可用或密钥无效，请检查配置后重试。${detail}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空。");
  const rawUsage = data.usage;
  const usage = rawUsage && typeof rawUsage === "object"
    ? {
        promptTokens: typeof rawUsage.prompt_tokens === "number" ? rawUsage.prompt_tokens : null,
        completionTokens: typeof rawUsage.completion_tokens === "number" ? rawUsage.completion_tokens : null,
        totalTokens: typeof rawUsage.total_tokens === "number" ? rawUsage.total_tokens : null,
      }
    : null;
  return { content, model, usage };
}

/** Parse the first JSON object out of a model response (strips fences). */
export function readJsonObject(content: string): Record<string, unknown> {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error("Model response did not contain a JSON object");
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}
