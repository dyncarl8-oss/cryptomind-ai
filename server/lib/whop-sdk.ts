import Whop from "@whop/sdk";

const hasWhopConfig = process.env.WHOP_API_KEY && process.env.WHOP_APP_ID;

if (!hasWhopConfig) {
  console.warn("⚠️  Whop integration disabled: WHOP_API_KEY and WHOP_APP_ID not configured");
  console.warn("   App will run in standalone mode without Whop authentication");
} else {
  console.log("✅ Whop SDK initialized with:");
  console.log("   App ID:", process.env.WHOP_APP_ID);
  console.log("   API Key:", process.env.WHOP_API_KEY?.substring(0, 20) + "...");
  if (process.env.WHOP_WEBHOOK_SECRET) {
    console.log("   Webhook Secret: configured ✓");
  } else {
    console.log("   Webhook Secret: not configured (webhooks will fail)");
  }
  console.log("   This SDK is used for all operations (authentication, memberships, transfers, etc.)");
}

export const whopSdk = hasWhopConfig 
  ? new Whop({
      apiKey: process.env.WHOP_API_KEY,
      appID: process.env.WHOP_APP_ID,
      webhookKey: process.env.WHOP_WEBHOOK_SECRET 
        ? btoa(process.env.WHOP_WEBHOOK_SECRET)
        : undefined,
    })
  : null;

export const isWhopEnabled = hasWhopConfig;
