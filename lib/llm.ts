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
    defaultModel: "qwen3.7-plus",
  },
];

export function isLlmProvider(value: string): value is LlmProvider {
  return LLM_PROVIDERS.some((provider) => provider.id === value);
}

export function getLlmProvider(id: string): LlmProviderConfig | undefined {
  return LLM_PROVIDERS.find((provider) => provider.id === id);
}
