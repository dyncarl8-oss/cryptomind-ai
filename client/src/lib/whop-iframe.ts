import { createSdk } from "@whop/iframe";

const appId = import.meta.env.VITE_WHOP_APP_ID;

if (!appId) {
  console.warn("VITE_WHOP_APP_ID environment variable is not set - Whop iframe features disabled");
}

export const whopIframeSdk = appId ? createSdk({
  appId: appId,
}) : null;

export const isWhopIframeEnabled = !!appId;
