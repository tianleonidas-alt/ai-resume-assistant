import { NextResponse } from "next/server";
import { LLM_PROVIDERS } from "@/lib/llm";

export const runtime = "nodejs";

/**
 * Exposes provider display info (label + configured model name) to the client
 * so the model selector can show the real model. Never returns API keys.
 */
export async function GET() {
  return NextResponse.json({
    providers: LLM_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      model: process.env[provider.modelEnv] || provider.defaultModel,
    })),
  });
}
