"use client";

import { useEffect, useState } from "react";
import { isLlmProvider, LLM_PROVIDERS, type LlmProvider, type LlmProviderConfig } from "@/lib/llm";

const STORAGE_KEY = "career-llm-provider";

export function readLlmProvider(): LlmProvider {
  if (typeof window === "undefined") return "deepseek";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isLlmProvider(stored) ? stored : "deepseek";
  } catch {
    return "deepseek";
  }
}

export function writeLlmProvider(value: LlmProvider) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

type ProviderInfo = { id: string; label: string; model: string };

export function LlmSelector({ value, onChange }: { value: LlmProvider; onChange: (value: LlmProvider) => void }) {
  const [models, setModels] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void fetch("/api/llm/providers", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((payload: { providers?: ProviderInfo[] } | null) => {
        if (!active || !payload?.providers) return;
        setModels(Object.fromEntries(payload.providers.map((item) => [item.id, item.model])));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <label className="llm-selector">
      <span>模型</span>
      <select value={value} onChange={(event) => onChange(event.target.value as LlmProvider)}>
        {LLM_PROVIDERS.map((provider: LlmProviderConfig) => (
          <option key={provider.id} value={provider.id}>
            {models[provider.id] ? `${provider.label} · ${models[provider.id]}` : provider.label}
          </option>
        ))}
      </select>
    </label>
  );
}
