import { NextResponse } from "next/server";
import { billingCurrency, isBillingEnabled, parsePacks } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    enabled: isBillingEnabled(),
    currency: billingCurrency(),
    packs: parsePacks(),
  });
}
