import { getLlmProvider, type LlmProvider } from "@/lib/llm";

export type LlmChatMessage = { role: "system" | "user"; content: string };

/**
 * Server-only chat completion helper. Supports any provider registered in
 * lib/llm.ts (DeepSeek and Alibaba Cloud Bailian by default). API keys are
 * always read from server-side environment variables and never leave the
 * server. Returns the model actually used so callers can record it.
 */
export async function runChatCompletion(options: {
  provider: LlmProvider;
  model?: string;
  messages: LlmChatMessage[];
  temperature?: number;
  json?: boolean;
}): Promise<{ content: string; model: string }> {
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
    console.error(`LLM API error (${provider.id})`, response.status, await response.text());
    throw new Error(`${provider.label} 服务暂时不可用或密钥无效，请检查配置后重试。`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空。");
  return { content, model };
}
