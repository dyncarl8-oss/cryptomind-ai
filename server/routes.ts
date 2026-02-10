import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generatePrediction } from "./prediction";
import { generateTransparentPrediction } from "./transparent-prediction";
import { type TradingPair, tradingPairs, messageSchema, MembershipStatus } from "@shared/schema";
import { verifyWhopToken, checkExperienceAccess, checkCompanyAccess, getResourceIdFromRequest, resolveCompanyIdFromExperience, checkIfUserIsOwner } from "./lib/auth";
import { isWhopEnabled, whopSdk } from "./lib/whop-sdk";
import { sendUnlimitedAccessClickedNotification, sendWithdrawalRequestNotification } from "./lib/resend-email";
import { syncMembershipsForCompany, syncAllAdminMemberships, startMembershipSyncPolling } from "./lib/membership-sync";
import { z } from "zod";

// Helper function to get company ID from environment or database
async function getCompanyId(): Promise<string | undefined> {
  // Try environment variable first
  if (process.env.WHOP_COMPANY_ID) {
    return process.env.WHOP_COMPANY_ID;
  }

  // Fallback: get from any registered admin in the database
  try {
    const admins = await storage.getAllAdmins();
    if (admins.length > 0 && admins[0].companyId) {
      console.log(`[CompanyID] Using company ID from admin records: ${admins[0].companyId}`);
      return admins[0].companyId;
    }
  } catch (error) {
    console.error("[CompanyID] Error fetching admins:", error);
  }

  return undefined;
}

interface ClientMessage {
  type: "user_message" | "select_pair" | "history" | "new_session" | "ai_thinking_complete";
  content?: string;
  pair?: TradingPair;
  timeframe?: string;
  userId?: string;
}

interface ServerMessage {
  type: "bot_message" | "typing" | "prediction" | "insufficient_credits" | "credits_update" | "analysis_stage";
  content: string;
  prediction?: {
    pair: TradingPair;
    direction: "UP" | "DOWN" | "NEUTRAL";
    confidence: number;
    duration: string;
    analysis?: string;
  };
  credits?: number;
  stage?: "data_collection" | "technical_calculation" | "signal_aggregation" | "ai_thinking" | "final_verdict";
  progress?: number;
  status?: "pending" | "in_progress" | "complete";
  duration?: number;
  data?: any;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.get("/api/auth/verify", async (req, res) => {
    const user = await verifyWhopToken(req);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({ user });
  });

  app.get("/api/auth/me", async (req, res) => {
    // In development mode without Whop, return mock user data
    if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
      return res.json({
        id: "dev_user",
        username: "developer",
        name: "Developer",
        profile_pic_url: null,
      });
    }

    // If Whop is not enabled, return null
    if (!isWhopEnabled) {
      return res.json(null);
    }

    try {
      // Verify the user token first
      const user = await verifyWhopToken(req);

      // In development, if no user token, return mock data
      if (!user && process.env.NODE_ENV === "development") {
        return res.json({
          id: "dev_user",
          username: "developer",
          name: "Developer",
          profile_pic_url: null,
        });
      }

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if whopSdk is available
      if (!whopSdk) {
        return res.status(500).json({ error: "Whop SDK not initialized" });
      }

      // Fetch user details from Whop
      const userDetails = await whopSdk.users.retrieve(user.userId);

      // Extract profile picture URL from Whop API response
      // Whop can return profile_picture in different formats, so we handle multiple cases
      let profilePicUrl: string | null = null;

      if (userDetails.profile_picture) {
        if (typeof userDetails.profile_picture === 'string') {
          profilePicUrl = userDetails.profile_picture;
        } else if (typeof userDetails.profile_picture === 'object') {
          const picObj = userDetails.profile_picture as any;
          profilePicUrl = picObj.url || picObj.image_url || null;
        }
      }

      // Whop sometimes returns nested CDN URLs - extract the innermost URL
      if (profilePicUrl && profilePicUrl.includes('/plain/')) {
        const lastPlainIndex = profilePicUrl.lastIndexOf('/plain/');
        const extractedUrl = profilePicUrl.substring(lastPlainIndex + 7);
        if (extractedUrl.startsWith('http')) {
          profilePicUrl = extractedUrl;
        }
      }

      // Save/update user in database
      await storage.upsertUser({
        id: userDetails.id,
        username: userDetails.username,
        name: userDetails.name || userDetails.username,
        profilePictureUrl: profilePicUrl,
      });

      return res.json({
        id: userDetails.id,
        username: userDetails.username,
        name: userDetails.name || userDetails.username,
        profile_pic_url: profilePicUrl,
        companyId: user.companyId,
        experienceId: user.experienceId,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      // In development, return mock data on error
      if (process.env.NODE_ENV === "development") {
        return res.json({
          id: "dev_user",
          username: "developer",
          name: "Developer",
          profile_pic_url: null,
        });
      }
      return res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.post("/api/auth/check-access", async (req, res) => {
    const { experienceId } = req.body;

    // If Whop is not enabled, allow access in standalone mode
    if (!isWhopEnabled) {
      return res.json({
        hasAccess: true,
        accessLevel: "customer",
      });
    }

    // If no experienceId is provided, allow access (root route)
    if (!experienceId) {
      return res.json({
        hasAccess: true,
        accessLevel: "customer",
      });
    }

    // Verify the Whop token
    const user = await verifyWhopToken(req);

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized - valid Whop authentication required. Please access this app through Whop."
      });
    }

    // Verify user has access to the experience
    const access = await checkExperienceAccess(user.userId, experienceId);

    return res.json({
      hasAccess: access.hasAccess,
      accessLevel: access.accessLevel,
    });
  });

  app.get("/api/credits", async (req, res) => {
    try {
      let userId = "dev_user";

      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      let userCredits = await storage.getUserCredits(userId);

      if (!userCredits) {
        await storage.setUserCredits(userId, 3);
        userCredits = await storage.getUserCredits(userId);
      }

      // If user has unlimited access and Whop is enabled, verify the membership is still valid
      if (userCredits?.hasUnlimitedAccess && isWhopEnabled && whopSdk) {
        const companyId = await getCompanyId();

        if (companyId) {
          try {
            // Use Memberships API to check if user has a valid membership status
            // Valid statuses: active, trialing, past_due, completed (one-time purchase)
            // Invalid statuses: canceled, expired, left - these users should NOT have access
            const validMemberships: any[] = [];
            for await (const membership of whopSdk.memberships.list({
              company_id: companyId,
              user_ids: [userId],
              statuses: ["active", "trialing", "past_due", "completed"]
            })) {
              // Only include memberships that are not canceled
              // When user "leaves", the membership gets canceled_at set or status changes to "canceled"
              if (!membership.canceled_at) {
                validMemberships.push(membership);
              } else {
                console.log(`[Credits] Membership ${membership.id} was canceled at: ${membership.canceled_at}`);
              }
            }

            // If no valid membership found, revoke unlimited access
            if (validMemberships.length === 0) {
              console.log(`[Credits] User ${userId} has no valid membership (may have left/canceled), revoking unlimited access`);
              await storage.revokeUnlimitedAccess(userId);
              userCredits = await storage.getUserCredits(userId);
            } else {
              console.log(`[Credits] User ${userId} has ${validMemberships.length} valid membership(s), status: ${validMemberships[0]?.status}`);
            }
          } catch (error) {
            console.error("[Credits] Error checking membership status:", error);
            // Continue with current credits on error to avoid disrupting user experience
          }
        }
      }

      return res.json(userCredits);
    } catch (error) {
      console.error("Error fetching credits:", error);
      return res.status(500).json({ error: "Failed to fetch credits" });
    }
  });

  app.get("/api/credits/plan-id", async (req, res) => {
    const planId = process.env.WHOP_PLAN_ID;
    if (!planId) {
      return res.status(500).json({ error: "Plan ID not configured" });
    }
    return res.json({ planId });
  });

  app.get("/api/subscription/manage-url", async (req, res) => {
    try {
      if (!isWhopEnabled || !whopSdk) {
        return res.status(404).json({ error: "Whop integration not enabled" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log(`[Manage URL] Fetching subscription manage URL for user: ${user.userId}`);

      // Get company ID (from env or database)
      const companyId = await getCompanyId();
      if (!companyId) {
        console.error("[Manage URL] Company ID not found - cannot fetch memberships");
        return res.status(500).json({ error: "Company ID not configured" });
      }

      console.log(`[Manage URL] Using company ID: ${companyId}`);

      // List all valid memberships for this user (including completed for one-time purchases)
      // Use Memberships API here since we need the manage_url field which Members API doesn't provide
      const memberships = [];
      for await (const membership of whopSdk.memberships.list({
        company_id: companyId,
        user_ids: [user.userId],
        statuses: ["active", "trialing", "past_due", "completed"]
      })) {
        // Only include memberships that haven't been canceled
        if (!membership.canceled_at) {
          memberships.push(membership);
        }
      }

      console.log(`[Manage URL] Found ${memberships.length} valid memberships`);

      // Get the first active membership (should only be one)
      const activeMembership = memberships[0];

      if (!activeMembership || !activeMembership.manage_url) {
        console.log(`[Manage URL] No active subscription found for user: ${user.userId}`);
        return res.status(404).json({ error: "No active subscription found" });
      }

      console.log(`[Manage URL] Returning manage URL: ${activeMembership.manage_url}`);
      return res.json({
        manageUrl: activeMembership.manage_url,
        status: activeMembership.status
      });
    } catch (error) {
      console.error("Error fetching subscription manage URL:", error);
      return res.status(500).json({ error: "Failed to fetch subscription details" });
    }
  });

  app.post("/api/credits/checkout-config", async (req, res) => {
    try {
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Whop integration not enabled" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const planId = process.env.WHOP_PLAN_ID;
      if (!planId) {
        return res.status(500).json({ error: "Plan ID not configured" });
      }

      console.log(`[Checkout Config] Creating checkout configuration for user ${user.userId}`);

      // Multi-tenant context resolution
      const { companyId: resolvedCompanyId, experienceId: resolvedExperienceId } = getResourceIdFromRequest(req, user);

      console.log(`[Checkout Config] Resolved context: companyId=${resolvedCompanyId}, experienceId=${resolvedExperienceId}`);

      // Multi-tenant: Find which admin this user belongs to
      let referringAdminUserId: string | null = null;
      let referringCompanyId: string | null = null;

      // Method 1: Try to get admin from resolved company ID
      if (resolvedCompanyId) {
        const admin = await storage.getAdminByCompanyId(resolvedCompanyId);
        if (admin) {
          referringAdminUserId = admin.userId;
          referringCompanyId = resolvedCompanyId;
          console.log(`[Checkout Config] Found admin from company context: ${admin.userId}`);
        }
      }

      // Method 2: Try to resolve from experience ID if company didn't work
      if (!referringAdminUserId && resolvedExperienceId) {
        try {
          const companyIdFromExp = await resolveCompanyIdFromExperience(resolvedExperienceId);
          if (companyIdFromExp) {
            const admin = await storage.getAdminByCompanyId(companyIdFromExp);
            if (admin) {
              referringAdminUserId = admin.userId;
              referringCompanyId = companyIdFromExp;
              console.log(`[Checkout Config] Found admin from experience resolution: ${admin.userId}`);
            }
          }
        } catch (e) {
          console.warn(`[Checkout Config] Could not resolve company from experience ${resolvedExperienceId}`);
        }
      }

      if (!referringAdminUserId) {
        console.warn(`[Checkout Config] ⚠️  No admin found for user ${user.userId} - commission will not be attributed`);
      }

      // Create checkout configuration with admin attribution metadata
      const checkoutConfig = await whopSdk.checkoutConfigurations.create({
        plan_id: planId,
        metadata: {
          user_id: user.userId,
          subscription_type: "unlimited_access",
          referring_admin_user_id: referringAdminUserId || "",
          referring_company_id: referringCompanyId || "",
        },
      });

      console.log(`[Checkout Config] Created configuration:`, {
        id: checkoutConfig.id,
        planId: planId,
        userId: user.userId,
        referringAdminUserId,
        referringCompanyId,
      });

      return res.json({
        checkoutConfigId: checkoutConfig.id,
        planId: planId,
        referringAdminUserId,
      });
    } catch (error) {
      console.error("Error creating checkout configuration:", error);
      return res.status(500).json({ error: "Failed to create checkout configuration" });
    }
  });

  app.post("/api/credits/process-payment", async (req, res) => {
    try {
      console.log("[Process Payment] Starting direct payment processing (no webhook dependency)");

      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Whop integration not enabled" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      console.log(`[Process Payment] Processing payment ${paymentId} for user ${user.userId}`);

      // ================================================================
      // STEP 1: Verify payment with Whop API
      // ================================================================
      let payment: any;
      try {
        payment = await whopSdk.payments.retrieve(paymentId);
        console.log(`[Process Payment] Payment retrieved from Whop API:`, {
          id: payment.id,
          status: payment.status,
          amount: payment.final_amount || payment.subtotal || payment.amount || 0,
          metadata: payment.metadata,
        });
      } catch (error) {
        console.error(`[Process Payment] Failed to retrieve payment from Whop:`, error);
        return res.status(400).json({ error: "Invalid payment ID or payment not found" });
      }

      // Verify payment is successful
      if (payment.status !== "paid") {
        console.warn(`[Process Payment] Payment ${paymentId} status is not 'paid': ${payment.status}`);
        return res.status(400).json({ error: `Payment status is ${payment.status}, not paid` });
      }

      // ================================================================
      // STEP 2: Extract customer and company info
      // ================================================================
      const customerUserId = payment.user?.id || user.userId;
      const customerEmail = payment.user?.email;
      const customerUsername = payment.user?.username || user.userId;

      console.log(`[Process Payment] Customer: ${customerEmail || customerUserId}`);

      // ================================================================
      // STEP 3: Find admin for commission attribution from METADATA
      // ================================================================
      // MULTI-TENANT: The referring admin is stored in payment metadata during checkout
      // Multiple fallback strategies to ensure commission attribution
      let admin = null;
      let referringAdminUserId = payment.metadata?.referring_admin_user_id;
      let referringCompanyId = payment.metadata?.referring_company_id;

      // Method 1: Try metadata from checkout config
      if (referringAdminUserId) {
        admin = await storage.getAdminByUserId(referringAdminUserId);
        if (admin) {
          console.log(`[Process Payment] ✓ Found referring admin from metadata: ${admin.userId}`);
        } else {
          console.warn(`[Process Payment] ⚠️  Admin from metadata (${referringAdminUserId}) not found in database`);
        }
      }

      // Method 2: Try user's company context from JWT
      if (!admin && user.companyId) {
        admin = await storage.getAdminByCompanyId(user.companyId);
        if (admin) {
          referringAdminUserId = admin.userId;
          referringCompanyId = user.companyId;
          console.log(`[Process Payment] ✓ Found admin from user JWT context: ${admin.userId}`);
        }
      }

      // Method 3: Try experience resolution
      if (!admin && user.experienceId) {
        try {
          const companyIdFromExp = await resolveCompanyIdFromExperience(user.experienceId);
          if (companyIdFromExp) {
            admin = await storage.getAdminByCompanyId(companyIdFromExp);
            if (admin) {
              referringAdminUserId = admin.userId;
              referringCompanyId = companyIdFromExp;
              console.log(`[Process Payment] ✓ Found admin from experience: ${admin.userId}`);
            }
          }
        } catch (e) {
          console.warn(`[Process Payment] Could not resolve company from experience`);
        }
      }

      // Method 4: Check if this user already exists as a stored member for an admin (direct lookup)
      if (!admin) {
        const existingMember = await storage.getStoredMemberByUserId(customerUserId);
        if (existingMember) {
          admin = await storage.getAdminByUserId(existingMember.adminUserId);
          if (admin) {
            referringAdminUserId = admin.userId;
            referringCompanyId = existingMember.companyId;
            console.log(`[Process Payment] ✓ Found admin from existing member record: ${admin.userId}`);
          }
        }
      }

      if (!admin) {
        console.warn(`[Process Payment] ⚠️  No referring admin found through any method`);
      }

      // ================================================================
      // STEP 4: Idempotency check - Check if ANY processing already happened
      // ================================================================
      const alreadyProcessed = await storage.hasProcessedPayment(payment.id);
      if (alreadyProcessed) {
        console.log(`[Process Payment] Payment ${payment.id} already processed`);

        const userCredits = await storage.getUserCredits(customerUserId);
        const hasAccess = userCredits?.hasUnlimitedAccess || false;

        let commissionRecorded = false;
        if (admin) {
          commissionRecorded = await storage.hasProcessedPayment(payment.id, admin.userId);
        }

        return res.json({
          success: true,
          message: "Payment already processed",
          accessGranted: hasAccess,
          commissionRecorded,
        });
      }

      // ================================================================
      // STEP 5: Grant unlimited access to customer
      // ================================================================
      try {
        await storage.grantUnlimitedAccess(customerUserId);
        console.log(`[Process Payment] ✅ Unlimited access granted to customer: ${customerEmail || customerUserId}`);
      } catch (error) {
        console.error(`[Process Payment] ❌ Failed to grant unlimited access:`, error);
        return res.status(500).json({
          error: "Failed to grant access",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }

      // ================================================================
      // STEP 6: Store member in database for multi-tenant tracking
      // ================================================================
      // ALWAYS store member record, even if admin is unknown (for future reconciliation)
      const planId = process.env.WHOP_PLAN_ID || "unknown";
      const ownerCompanyId = process.env.WHOP_COMPANY_ID || "unknown";

      try {
        let userDetails: any = null;
        try {
          userDetails = await whopSdk.users.retrieve(customerUserId);
        } catch (e) {
          console.warn(`[Process Payment] Could not fetch user details for ${customerUserId}`);
        }

        let profilePicUrl: string | null = null;
        if (userDetails?.profile_picture) {
          if (typeof userDetails.profile_picture === 'string') {
            profilePicUrl = userDetails.profile_picture;
          } else if (typeof userDetails.profile_picture === 'object') {
            profilePicUrl = userDetails.profile_picture.url || userDetails.profile_picture.image_url || null;
          }
        }

        // Use placeholder values if admin not found - allows future reconciliation
        const memberAdminId = admin?.userId || "pending_attribution";
        const memberCompanyId = referringCompanyId || ownerCompanyId;

        const memberData = {
          id: `member_${payment.id}_${Date.now()}`,
          membershipId: payment.membership_id || `pay_${payment.id}`,
          userId: customerUserId,
          username: userDetails?.username || customerUsername,
          name: userDetails?.name || null,
          profilePictureUrl: profilePicUrl,
          adminUserId: memberAdminId,
          companyId: memberCompanyId,
          productId: payment.product?.id || "unlimited_access",
          productTitle: payment.product?.title || "Unlimited Access",
          planId: planId,
          status: "active" as const,
          renewalPeriodStart: payment.renewal_period_start ? new Date(payment.renewal_period_start) : new Date(),
          renewalPeriodEnd: payment.renewal_period_end ? new Date(payment.renewal_period_end) : null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          cancellationReason: null,
          commissionProcessed: admin !== null,
        };

        await storage.upsertStoredMember(memberData);
        if (admin) {
          console.log(`[Process Payment] ✅ Member stored: ${customerUsername} attributed to admin ${admin.userId}`);
        } else {
          console.log(`[Process Payment] ✅ Member stored with pending attribution: ${customerUsername}`);
        }
      } catch (error) {
        console.error(`[Process Payment] ⚠️ Failed to store member (non-critical):`, error);
      }

      // ================================================================
      // STEP 7: Record commission payment
      // ================================================================
      const SUBSCRIPTION_PRICE_CENTS = 500;   // $5.00
      const COMMISSION_CENTS = 250;           // $2.50 (50% of $5.00)

      const markerAdminId = admin?.userId || "system_no_admin";
      const markerCommissionId = `comm_${payment.id}_${markerAdminId}`;

      try {
        await storage.recordCommissionPayment({
          id: markerCommissionId,
          paymentId: payment.id,
          adminUserId: markerAdminId,
          amount: SUBSCRIPTION_PRICE_CENTS,
          commissionAmount: admin ? COMMISSION_CENTS : 0,
          customerUserId: customerUserId,
          customerEmail: customerEmail || null,
        });

        if (admin) {
          console.log(`[Process Payment] ✅ Commission recorded: $${COMMISSION_CENTS / 100} for admin ${admin.userId}`);
        } else {
          console.log(`[Process Payment] ⚠️  Payment marked as processed (no admin for commission)`);
        }
      } catch (error) {
        console.error(`[Process Payment] ❌ Failed to record commission:`, error);
        return res.json({
          success: true,
          message: "Access granted but commission tracking failed",
          accessGranted: true,
          commissionRecorded: false,
        });
      }

      console.log(`[Process Payment] ✅ COMPLETE - Customer has access${admin ? ', admin earned commission' : ''}`);
      return res.json({
        success: true,
        message: "Payment processed successfully",
        accessGranted: true,
        commissionRecorded: admin !== null,
      });
    } catch (error) {
      console.error("[Process Payment] Error:", error);
      return res.status(500).json({ error: "Failed to process payment" });
    }
  });

  app.post("/api/credits/purchase", async (req, res) => {
    try {
      // LEGACY ENDPOINT - Only for dev mode when Whop is not enabled
      // When Whop is enabled, fulfillment happens via webhook only
      if (isWhopEnabled) {
        return res.status(410).json({
          error: "This endpoint is disabled when Whop is enabled. Payment fulfillment happens via webhook."
        });
      }

      const { success } = req.body;
      const userId = "dev_user";

      if (success) {
        // Grant unlimited access for dev mode testing
        await storage.grantUnlimitedAccess(userId);
        const updatedCredits = await storage.getUserCredits(userId);
        return res.json({
          success: true,
          credits: updatedCredits
        });
      } else {
        return res.json({
          success: false,
          error: "Payment failed"
        });
      }
    } catch (error) {
      console.error("Error processing purchase:", error);
      return res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  app.post("/api/notifications/unlimited-access-clicked", async (req, res) => {
    try {
      console.log("[Notification] Unlimited access button clicked - sending email notification");

      let userId = "unknown";
      let username = "Unknown User";
      let userEmail: string | undefined;

      // Try to get user information from Whop if available
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (user) {
          userId = user.userId;

          // Try to fetch user details for username and email
          if (whopSdk) {
            try {
              const userDetails = await whopSdk.users.retrieve(user.userId);
              username = userDetails.username || userDetails.name || user.userId;
              userEmail = (userDetails as any).email;
            } catch (error) {
              console.warn("[Notification] Could not fetch user details:", error);
            }
          }
        }
      } else if (process.env.NODE_ENV === "development") {
        userId = "dev_user";
        username = "Developer (Dev Mode)";
      }

      // Send email notification
      const emailSent = await sendUnlimitedAccessClickedNotification({
        userId,
        username,
        userEmail,
        timestamp: new Date().toISOString(),
      });

      if (emailSent) {
        console.log("[Notification] Email notification sent successfully");
        return res.json({ success: true, notified: true });
      } else {
        console.warn("[Notification] Email notification was not sent (service may not be configured)");
        return res.json({ success: true, notified: false });
      }
    } catch (error) {
      console.error("[Notification] Error sending notification:", error);
      // Return success anyway - notifications should not block the user experience
      return res.json({ success: true, notified: false });
    }
  });

  // Admin routes
  app.post("/api/admin/check", async (req, res) => {
    try {
      const { resourceId } = req.body;

      // In dev mode without Whop, default to admin for testing
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        const isDevAdmin = process.env.DEV_ADMIN !== "false";
        return res.json({ isAdmin: isDevAdmin });
      }

      // If Whop is not enabled in production, return error
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({
          error: "Authentication service unavailable",
          details: "WHOP_API_KEY and WHOP_APP_ID must be configured"
        });
      }

      const user = await verifyWhopToken(req);

      // In development, if no user token, use dev defaults
      if (!user && process.env.NODE_ENV === "development") {
        const isDevAdmin = process.env.DEV_ADMIN !== "false";
        return res.json({ isAdmin: isDevAdmin });
      }

      if (!user) {
        return res.status(401).json({ error: "Unauthorized - invalid or missing token" });
      }

      // If no resourceId provided or it's 'default', return false
      // Admin controls should only show when viewing a specific company/experience
      if (!resourceId || resourceId === 'default') {
        return res.json({ isAdmin: false });
      }

      // Use the provided resourceId for access check (don't use JWT-derived company)
      let checkResourceId = resourceId;
      let companyId: string | undefined;

      if (!checkResourceId) {
        return res.status(500).json({
          error: "Resource ID not configured",
          details: "Resource ID must be provided or available in environment"
        });
      }

      // Check access using the resource ID (works for both experience and company IDs)
      // IMPORTANT: Resolve companyId from checkResourceId, not from user's JWT token
      let access;
      if (checkResourceId.startsWith('exp_')) {
        access = await checkExperienceAccess(user.userId, checkResourceId);
        // Resolve company ID from the experience being checked
        console.log(`[Whop] Resolving company ID from experience: ${checkResourceId}`);
        try {
          companyId = await resolveCompanyIdFromExperience(checkResourceId);
        } catch (error) {
          console.error(`[Whop] Failed to resolve company from experience ${checkResourceId}:`, error);
          // If we can't resolve the company, deny admin access
          return res.json({ isAdmin: false });
        }
      } else if (checkResourceId.startsWith('biz_')) {
        access = await checkCompanyAccess(user.userId, checkResourceId);
        // The resource ID is already a company ID
        companyId = checkResourceId;
      } else {
        // Try as experience first, then company
        access = await checkExperienceAccess(user.userId, checkResourceId);
        // Try to resolve company from this resource
        try {
          companyId = await resolveCompanyIdFromExperience(checkResourceId);
        } catch {
          // If it fails, assume it's a company ID
          companyId = checkResourceId;
        }
      }

      // Check if user has access to the resource (member or admin)
      if (!access.hasAccess) {
        console.log(`[Whop] User ${user.userId} does not have access to resource ${checkResourceId}`);
        return res.json({ isAdmin: false });
      }

      // Verify company ID is available
      if (!companyId) {
        console.error(`[Whop] Could not determine company ID for resource ${checkResourceId}`);
        return res.json({ isAdmin: false });
      }

      // ONLY company owners can access admin dashboard
      // Moderators, admins, and other roles are treated as regular members
      const ownerCheck = await checkIfUserIsOwner(user.userId, companyId);

      // If Whop API failed, fall back to cached admin status to avoid locking out owners
      if (ownerCheck.error) {
        console.warn(`[Whop] Owner check failed for user ${user.userId}, checking cached status`);
        const cachedAdminStatus = await storage.isAdminForCompany(user.userId, companyId);

        if (cachedAdminStatus) {
          // User was previously verified as owner, trust the cached status during outage
          console.log(`[Whop] Using cached admin status (true) for user ${user.userId} during API failure`);
          return res.json({ isAdmin: true });
        } else {
          // New owner or unknown status - cannot verify without API
          // Return service unavailable instead of denying access
          console.error(`[Whop] Cannot verify owner status for user ${user.userId} - no cached data and API unavailable`);
          return res.status(503).json({
            error: "Owner verification service temporarily unavailable",
            details: "Unable to verify owner status. Please try again later."
          });
        }
      }

      // Auto-register owner if they have owner access - store company ID for future requests
      if (ownerCheck.isOwner) {
        console.log(`[Whop] Registering owner ${user.userId} with company: ${companyId}`);
        await storage.registerAdmin(user.userId, companyId);
        return res.json({ isAdmin: true });
      }

      // User is explicitly not an owner (they're a member, moderator, admin, etc.)
      // Remove cached admin status if it exists (handles owner demotion)
      const wasAdminForCompany = await storage.isAdminForCompany(user.userId, companyId);
      const hasAnyAdminRecord = await storage.getAdminByUserId(user.userId);

      if (wasAdminForCompany || hasAnyAdminRecord) {
        // Remove admin record (handles both company-specific and legacy records)
        console.log(`[Whop] User ${user.userId} is not owner of company ${companyId} - removing any cached admin status`);
        await storage.removeAdmin(user.userId, companyId);
      }

      return res.json({ isAdmin: false });
    } catch (error) {
      console.error("[Admin] Error checking status:", error instanceof Error ? error.message : "Unknown error");
      return res.status(500).json({
        error: "Failed to check admin status",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Environment configuration check endpoint
  app.get("/api/admin/config-check", async (req, res) => {
    try {
      const config = {
        whopApiKey: !!process.env.WHOP_API_KEY,
        whopAppId: !!process.env.WHOP_APP_ID,
        viteWhopAppId: !!process.env.VITE_WHOP_APP_ID,
        whopCompanyId: !!process.env.WHOP_COMPANY_ID,
        whopPlanId: !!process.env.WHOP_PLAN_ID,
        adminUserId: !!process.env.ADMIN_USER_ID,
        geminiApiKey: !!process.env.GEMINI_API_KEY,
        isWhopEnabled,
        environment: process.env.NODE_ENV || "development",
      };

      const missingRequired = [];
      const missingOptional = [];

      // Required for basic Whop functionality and admin detection
      if (!config.whopApiKey) missingRequired.push("WHOP_API_KEY");
      if (!config.whopAppId) missingRequired.push("WHOP_APP_ID");
      if (!config.viteWhopAppId) missingRequired.push("VITE_WHOP_APP_ID");
      if (!config.whopCompanyId) missingRequired.push("WHOP_COMPANY_ID");

      // Optional - only needed for specific features
      if (!config.whopPlanId) missingOptional.push("WHOP_PLAN_ID (needed for subscription management)");
      if (!config.adminUserId) missingOptional.push("ADMIN_USER_ID (needed for commission tracking)");
      if (!config.geminiApiKey) missingOptional.push("GEMINI_API_KEY (needed for AI predictions)");

      let message = "";
      if (missingRequired.length > 0) {
        message = `Missing required environment variables: ${missingRequired.join(", ")}. `;
      }
      if (missingOptional.length > 0) {
        message += `Optional: ${missingOptional.join(", ")}. `;
      }
      if (missingRequired.length === 0 && missingOptional.length === 0) {
        message = "All environment variables are configured!";
      }
      message += "See replit.md for setup instructions.";

      return res.json({
        config,
        missingRequired,
        missingOptional,
        isFullyConfigured: missingRequired.length === 0,
        message
      });
    } catch (error) {
      console.error("Error checking configuration:", error);
      return res.status(500).json({ error: "Failed to check configuration" });
    }
  });

  app.get("/api/admin/balance", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        // In dev mode, return total balance across all admins
        const balance = await storage.getTotalAdminBalance();
        return res.json(balance);
      }

      // If Whop is not enabled in production, return error
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Authentication service unavailable" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user is an admin
      const admin = await storage.getAdminByUserId(user.userId);
      if (!admin) {
        return res.status(403).json({ error: "Access denied - not an admin" });
      }

      // Multi-tenant: Return only this admin's own balance
      const balance = await storage.getAdminBalance(user.userId);
      return res.json(balance);
    } catch (error) {
      console.error("Error fetching admin balance:", error);
      return res.status(500).json({ error: "Failed to fetch admin balance" });
    }
  });

  app.get("/api/admin/commissions", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        // In dev mode, return all commissions across all admins
        const limit = parseInt(req.query.limit as string) || 50;
        const commissions = await storage.getAllCommissionPayments(limit);
        return res.json(commissions);
      }

      // If Whop is not enabled in production, return error
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Authentication service unavailable" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user is an admin
      const admin = await storage.getAdminByUserId(user.userId);
      if (!admin) {
        return res.status(403).json({ error: "Access denied - not an admin" });
      }

      // Multi-tenant: Return only this admin's own commissions
      const limit = parseInt(req.query.limit as string) || 50;
      const commissions = await storage.getCommissionPayments(user.userId, limit);
      return res.json(commissions);
    } catch (error) {
      console.error("Error fetching commissions:", error);
      return res.status(500).json({ error: "Failed to fetch commissions" });
    }
  });

  app.get("/api/admin/memberships", async (req, res) => {
    try {
      // Development mode: return mock memberships
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        return res.json({
          data: [
            {
              id: "mem_dev_1",
              status: "active",
              created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              renewal_period_start: new Date().toISOString(),
              renewal_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              cancel_at_period_end: false,
              user: {
                id: "user_dev_1",
                username: "demo_user",
                name: "Demo User",
                profile_pic_url: null
              },
              product: {
                id: "prod_dev_1",
                title: "Premium Access"
              },
              plan: {
                id: "plan_dev_1"
              }
            },
            {
              id: "mem_dev_2",
              status: "trialing",
              created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              renewal_period_start: new Date().toISOString(),
              renewal_period_end: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
              cancel_at_period_end: false,
              user: {
                id: "user_dev_2",
                username: "trial_user",
                name: "Trial User",
                profile_pic_url: null
              },
              product: {
                id: "prod_dev_1",
                title: "Premium Access"
              },
              plan: {
                id: "plan_dev_1"
              }
            }
          ],
          page_info: {
            has_next_page: false,
            has_previous_page: false
          }
        });
      }

      // Production mode: fetch from Whop
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Whop SDK not configured" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify the user is an admin (any admin can see all memberships)
      const admin = await storage.getAdminByUserId(user.userId);
      if (!admin) {
        console.error(`[Whop] Access denied: User ${user.userId} is not an admin`);
        return res.status(403).json({
          error: "Access denied",
          details: "You do not have admin access"
        });
      }

      console.log(`[Whop] Access verified: User ${user.userId} is an admin - fetching their company memberships`);

      // Multi-tenant: Fetch memberships from OWNER's company (WHOP_COMPANY_ID)
      // Then filter to only show members that belong to THIS admin
      const ownerCompanyId = process.env.WHOP_COMPANY_ID;
      if (!ownerCompanyId) {
        console.error(`[Whop] WHOP_COMPANY_ID not configured`);
        return res.status(500).json({
          error: "Company not configured",
          details: "WHOP_COMPANY_ID environment variable is not set"
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;

      try {
        console.log(`[Whop] Fetching memberships from owner company (${ownerCompanyId}) for admin ${user.userId}`);

        // STEP 1: Get stored members for THIS admin (multi-tenant filter)
        const storedMembers = await storage.getStoredMembersByAdmin(user.userId, ["active", "trialing", "completed"]);
        const storedMemberUserIds = new Set(storedMembers.map(m => m.userId));
        const storedMembershipIds = new Set(storedMembers.map(m => m.membershipId));

        console.log(`[Whop] Admin ${user.userId} has ${storedMembers.length} stored members`);

        // STEP 2: Fetch all active memberships from WHOP_COMPANY_ID (owner's product)
        const allMemberships: any[] = [];
        for await (const membership of whopSdk.memberships.list({
          company_id: ownerCompanyId,
          first: 200,
          statuses: ["active", "trialing", "completed"]
        })) {
          // Only include CryptoMind AI product memberships
          const productTitle = membership.product?.title || "";
          const isCryptoMindProduct = productTitle.toLowerCase().includes("cryptomind");

          if (!membership.canceled_at && isCryptoMindProduct) {
            allMemberships.push(membership);
          }
        }

        console.log(`[Whop] Found ${allMemberships.length} total active CryptoMind AI memberships in owner's company`);

        // STEP 3: Filter to only memberships that belong to THIS admin's stored members
        const memberships = allMemberships.filter(m =>
          storedMembershipIds.has(m.id) || storedMemberUserIds.has(m.user?.id)
        ).slice(0, limit);

        console.log(`[Whop] Successfully fetched ${memberships.length} active memberships`);

        // Enrich membership data with user profile pictures
        const enrichedMemberships = await Promise.all(
          memberships.map(async (membership) => {
            if (membership.user?.id && whopSdk) {
              try {
                const userDetails = await whopSdk.users.retrieve(membership.user.id);

                // Extract profile picture URL
                let profilePicUrl: string | null = null;
                if (userDetails.profile_picture) {
                  if (typeof userDetails.profile_picture === 'string') {
                    profilePicUrl = userDetails.profile_picture;
                  } else if (typeof userDetails.profile_picture === 'object') {
                    const picObj = userDetails.profile_picture as any;
                    profilePicUrl = picObj.url || picObj.image_url || null;
                  }
                }

                // Whop sometimes returns nested CDN URLs - extract the innermost URL
                if (profilePicUrl && profilePicUrl.includes('/plain/')) {
                  const lastPlainIndex = profilePicUrl.lastIndexOf('/plain/');
                  const extractedUrl = profilePicUrl.substring(lastPlainIndex + 7);
                  if (extractedUrl.startsWith('http')) {
                    profilePicUrl = extractedUrl;
                  }
                }

                // Return enriched membership with profile picture
                return {
                  ...membership,
                  user: {
                    ...membership.user,
                    profile_pic_url: profilePicUrl
                  }
                };
              } catch (error) {
                console.error(`[Whop] Failed to fetch user details for ${membership.user.id}:`, error);
                return membership;
              }
            }
            return membership;
          })
        );

        console.log(`[Whop] Sample enriched membership data:`, enrichedMemberships.length > 0 ? JSON.stringify(enrichedMemberships[0], null, 2) : 'No memberships');

        return res.json({
          data: enrichedMemberships,
          page_info: {
            has_next_page: memberships.length >= limit,
            has_previous_page: false
          }
        });
      } catch (whopError: any) {
        console.error("[Whop] Error fetching memberships:");
        console.error("[Whop] Error:", JSON.stringify(whopError, null, 2));
        if (whopError.body) {
          console.error("[Whop] Error body:", JSON.stringify(whopError.body, null, 2));
        }

        return res.status(500).json({
          error: "Failed to fetch memberships from Whop",
          details: whopError instanceof Error ? whopError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error fetching memberships:", error);
      return res.status(500).json({ error: "Failed to fetch memberships" });
    }
  });

  app.get("/api/admin/stored-members", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        const members = await storage.getAllStoredMembers(50);
        return res.json({
          data: members.map(m => ({
            id: m.id,
            membershipId: m.membershipId,
            status: m.status,
            created_at: m.createdAt.toISOString(),
            updated_at: m.updatedAt.toISOString(),
            renewal_period_start: m.renewalPeriodStart?.toISOString() || null,
            renewal_period_end: m.renewalPeriodEnd?.toISOString() || null,
            cancel_at_period_end: m.cancelAtPeriodEnd,
            user: {
              id: m.userId,
              username: m.username,
              name: m.name,
              profile_pic_url: m.profilePictureUrl
            },
            product: {
              id: m.productId,
              title: m.productTitle
            },
            plan: {
              id: m.planId
            }
          })),
          total: members.length
        });
      }

      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Whop SDK not configured" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const admin = await storage.getAdminByUserId(user.userId);
      if (!admin) {
        return res.status(403).json({
          error: "Access denied",
          details: "You do not have admin access"
        });
      }

      const statusFilter = req.query.status as string | undefined;
      let statuses: MembershipStatus[] | undefined;
      if (statusFilter) {
        statuses = statusFilter.split(',') as MembershipStatus[];
      }

      const allMembers = await storage.getStoredMembersByAdmin(user.userId, statuses);

      // Filter to only show CryptoMind AI product members
      const members = allMembers.filter(m =>
        m.productTitle?.toLowerCase().includes("cryptomind")
      );

      return res.json({
        data: members.map(m => ({
          id: m.id,
          membershipId: m.membershipId,
          status: m.status,
          created_at: m.createdAt.toISOString(),
          updated_at: m.updatedAt.toISOString(),
          renewal_period_start: m.renewalPeriodStart?.toISOString() || null,
          renewal_period_end: m.renewalPeriodEnd?.toISOString() || null,
          cancel_at_period_end: m.cancelAtPeriodEnd,
          canceled_at: m.canceledAt?.toISOString() || null,
          cancellation_reason: m.cancellationReason,
          commission_processed: m.commissionProcessed,
          user: {
            id: m.userId,
            username: m.username,
            name: m.name,
            profile_pic_url: m.profilePictureUrl
          },
          product: {
            id: m.productId,
            title: m.productTitle
          },
          plan: {
            id: m.planId
          }
        })),
        total: members.length
      });
    } catch (error) {
      console.error("Error fetching stored members:", error);
      return res.status(500).json({ error: "Failed to fetch stored members" });
    }
  });

  app.post("/api/admin/sync-memberships", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        return res.json({
          success: true,
          message: "Sync not available in development mode without Whop",
          results: {}
        });
      }

      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Whop SDK not configured" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const admin = await storage.getAdminByUserId(user.userId);
      if (!admin) {
        return res.status(403).json({ error: "Not authorized as admin" });
      }

      if (!admin.companyId) {
        return res.status(400).json({ error: "Admin has no company ID configured" });
      }

      const commissionAmount = parseInt(req.body.commissionAmount as string) || 1000;
      const result = await syncMembershipsForCompany(admin.companyId, user.userId, commissionAmount);

      return res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error("Error syncing memberships:", error);
      return res.status(500).json({ error: "Failed to sync memberships" });
    }
  });

  app.post("/api/admin/withdraw", async (req, res) => {
    try {
      let userId = "dev_user";
      let username = "developer";
      let name = "Developer";

      // Development mode: simulate withdrawal request
      if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
          return res.status(400).json({ error: "Invalid withdrawal amount" });
        }

        // Use total balance in dev mode (shared balance across all admins)
        const balance = await storage.getTotalAdminBalance();
        if (amount > balance.balance) {
          return res.status(400).json({ error: "Insufficient balance" });
        }

        const withdrawalId = `withdraw_dev_${Date.now()}`;
        await storage.recordWithdrawal({
          id: withdrawalId,
          adminUserId: userId,
          amount,
          status: "completed",
        });

        // Send email notification
        await sendWithdrawalRequestNotification({
          withdrawalId,
          adminUserId: userId,
          adminUsername: username,
          adminName: name,
          amount,
          timestamp: new Date().toISOString(),
        });

        return res.json({
          success: true,
          withdrawalId,
          message: "Withdrawal request received! Funds will be sent to you shortly."
        });
      }

      // Production mode: require Whop authentication
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({
          error: "Authentication service unavailable",
          details: "Whop authentication must be configured for withdrawal requests"
        });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      userId = user.userId;

      // Fetch user details for email notification
      try {
        const userDetails = await whopSdk.users.retrieve(userId);
        username = userDetails.username;
        name = userDetails.name || userDetails.username;
      } catch (error) {
        console.error("[Withdrawal] Could not fetch user details:", error);
        // Continue with userId as fallback
        username = userId;
        name = userId;
      }

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount" });
      }

      // Multi-tenant: Check if admin has sufficient balance (their own balance only)
      const balance = await storage.getAdminBalance(userId);
      if (amount > balance.balance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      console.log(`[Withdrawal] Processing withdrawal request of ${amount / 100} USD for user ${userId}`);

      // Create withdrawal record and deduct balance immediately
      const withdrawalId = `withdraw_${Date.now()}`;
      await storage.recordWithdrawal({
        id: withdrawalId,
        adminUserId: userId,
        amount,
        status: "completed",
      });

      console.log(`[Withdrawal] Balance deducted: ${amount / 100} USD`);

      // Send email notification to admin (best-effort, don't fail if email fails)
      try {
        const emailSent = await sendWithdrawalRequestNotification({
          withdrawalId,
          adminUserId: userId,
          adminUsername: username,
          adminName: name,
          amount,
          timestamp: new Date().toISOString(),
        });

        if (emailSent) {
          console.log(`[Withdrawal] Email notification sent for withdrawal ${withdrawalId}`);
        } else {
          console.warn(`[Withdrawal] Email notification failed for withdrawal ${withdrawalId}`);
        }
      } catch (emailError) {
        console.error(`[Withdrawal] Error sending email notification for withdrawal ${withdrawalId}:`, emailError);
        // Continue - withdrawal is still recorded even if email fails
      }

      return res.json({
        success: true,
        withdrawalId,
        message: "Withdrawal request received! Funds will be sent to you shortly."
      });
    } catch (error) {
      console.error("Error processing withdrawal request:", error);
      return res.status(500).json({ error: "Failed to process withdrawal request" });
    }
  });

  app.post("/api/admin/withdrawal/update-status", async (req, res) => {
    try {
      let userId = "dev_user";

      // In production, verify admin authentication
      if (isWhopEnabled && whopSdk) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;

        // Verify user is an admin
        const admin = await storage.getAdminByUserId(userId);
        if (!admin) {
          return res.status(403).json({ error: "Not authorized as admin" });
        }
      }

      const { withdrawalId, status } = req.body;

      if (!withdrawalId) {
        return res.status(400).json({ error: "Withdrawal ID is required" });
      }

      if (!status || !['completed', 'failed', 'pending'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'completed', 'failed', or 'pending'" });
      }

      console.log(`[Withdrawal] Updating withdrawal ${withdrawalId} status to ${status}`);

      // Update withdrawal status
      await storage.updateWithdrawalStatus(withdrawalId, status);

      return res.json({
        success: true,
        withdrawalId,
        status,
        message: `Withdrawal status updated to ${status}`
      });
    } catch (error) {
      console.error("Error updating withdrawal status:", error);
      return res.status(500).json({ error: "Failed to update withdrawal status" });
    }
  });

  app.post("/api/admin/reconcile-payments", async (req, res) => {
    try {
      if (!isWhopEnabled || !whopSdk) {
        return res.status(503).json({ error: "Whop SDK not configured" });
      }

      let userId = "dev_user";
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;

        // Verify user is an admin
        const admin = await storage.getAdminByUserId(userId);
        if (!admin) {
          return res.status(403).json({ error: "Not authorized as admin" });
        }
      }

      console.log("[Reconciliation] Starting payment reconciliation...");

      // Get company ID from environment or admin
      const companyId = process.env.WHOP_COMPANY_ID;
      if (!companyId) {
        return res.status(500).json({
          error: "Company ID not configured",
          details: "WHOP_COMPANY_ID environment variable is required for reconciliation"
        });
      }

      let paymentsChecked = 0;
      let commissionsBackfilled = 0;
      const errors: string[] = [];

      try {
        // Fetch all payments from Whop using async iterator (handles pagination automatically)
        console.log(`[Reconciliation] Fetching payments from Whop...`);

        for await (const payment of whopSdk.payments.list({
          company_id: companyId,
        })) {
          paymentsChecked++;

          // Only process succeeded payments
          if (payment.status !== 'paid') {
            continue;
          }

          // Get all admins
          const admins = await storage.getAllAdmins();
          if (admins.length === 0) {
            continue;
          }

          // Calculate commission amount (amounts are in cents)
          const amount = (payment as any).final_amount || (payment as any).subtotal || 0;
          const totalCommission = Math.floor(amount / 2);

          // Extract customer user ID
          const customerUserId = (payment as any).user_id || (payment as any).user?.id;

          // Process each admin separately with per-admin idempotency
          for (const admin of admins) {
            // Check if we've already processed this payment for THIS specific admin
            const alreadyProcessedForAdmin = await storage.hasProcessedPayment(payment.id, admin.userId);
            if (alreadyProcessedForAdmin) {
              console.log(`[Reconciliation] Payment ${payment.id} already processed for admin ${admin.userId}, skipping`);
              continue; // Skip this admin, already credited
            }

            console.log(`[Reconciliation] Found unprocessed payment: ${payment.id} for admin ${admin.userId}`);

            // Calculate commission for this admin
            const adminCommission = Math.floor((totalCommission * admin.commissionShare) / 100);

            // Record commission with deterministic ID for idempotency
            const commissionId = `comm_${payment.id}_${admin.userId}`;

            try {
              await storage.recordCommissionPayment({
                id: commissionId,
                paymentId: payment.id,
                adminUserId: admin.userId,
                amount: amount,
                commissionAmount: adminCommission,
                customerUserId: customerUserId || null,
                customerEmail: null,
              });

              console.log(`[Reconciliation] Backfilled commission: $${adminCommission / 100} for admin ${admin.userId}`);
              commissionsBackfilled++;
            } catch (error) {
              console.error(`[Reconciliation] Failed to record commission for admin ${admin.userId}:`, error);
              errors.push(`Payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

          // Safety limit to prevent processing too many payments in one go
          if (paymentsChecked >= 1000) {
            console.warn("[Reconciliation] Reached safety limit (1000 payments), stopping");
            break;
          }
        }

        console.log(`[Reconciliation] Complete. Checked ${paymentsChecked} payments, backfilled ${commissionsBackfilled} commissions`);

        return res.json({
          success: true,
          paymentsChecked,
          commissionsBackfilled,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (whopError: any) {
        console.error("[Reconciliation] Error fetching payments from Whop:", whopError);
        return res.status(500).json({
          error: "Failed to fetch payments from Whop",
          details: whopError instanceof Error ? whopError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error during reconciliation:", error);
      return res.status(500).json({ error: "Failed to reconcile payments" });
    }
  });

  app.post("/api/admin/adjust-balance", async (req, res) => {
    try {
      let userId = "dev_user";

      // In production, verify the requester is actually an admin
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;

        // Verify user is an admin
        const admin = await storage.getAdminByUserId(userId);
        if (!admin) {
          return res.status(403).json({ error: "Not authorized as admin" });
        }
      }

      const { targetUserId, amount, reason } = req.body;

      if (!targetUserId || typeof amount !== 'number') {
        return res.status(400).json({ error: "Invalid parameters. Required: targetUserId, amount" });
      }

      // Verify target user is an admin
      const targetAdmin = await storage.getAdminByUserId(targetUserId);
      if (!targetAdmin) {
        return res.status(404).json({ error: "Target user is not an admin" });
      }

      // Adjust the balance with audit trail
      await storage.adjustAdminBalance(targetUserId, amount, userId, reason);

      console.log(`[Balance Adjustment] Admin ${userId} adjusted balance for ${targetUserId} by $${amount / 100}. Reason: ${reason || 'N/A'}`);

      // Get updated balance
      const updatedBalance = await storage.getAdminBalance(targetUserId);

      return res.json({
        success: true,
        message: `Balance adjusted by $${amount / 100}`,
        newBalance: updatedBalance.balance,
      });
    } catch (error) {
      console.error("Error adjusting balance:", error);
      return res.status(500).json({ error: "Failed to adjust balance" });
    }
  });

  // Webhook endpoint for payment.succeeded
  app.post("/api/webhooks/payment", async (req, res) => {
    try {
      if (!isWhopEnabled || !whopSdk) {
        console.log("[Webhook] Whop not enabled, ignoring webhook");
        return res.status(200).send("OK");
      }

      // Validate webhook signature using raw body
      const requestBodyText = (req as any).rawBody
        ? (req as any).rawBody.toString('utf8')
        : JSON.stringify(req.body);
      const headers = req.headers as Record<string, string>;

      let webhookData;

      // Check if signature headers are present (real webhook vs test webhook)
      const hasSignature = headers['webhook-signature'] && headers['webhook-timestamp'];

      if (hasSignature) {
        // Validate signature for real webhooks
        try {
          webhookData = whopSdk.webhooks.unwrap(requestBodyText, { headers });
          console.log("[Webhook] Signature validated successfully");
        } catch (error) {
          console.error("[Webhook] Invalid webhook signature:", error);
          return res.status(401).json({ error: "Invalid webhook signature" });
        }
      } else {
        // Allow test webhooks without signature (from Whop developer dashboard)
        console.log("[Webhook] No signature headers - processing as test webhook");
        try {
          webhookData = JSON.parse(requestBodyText);
        } catch (error) {
          console.error("[Webhook] Invalid JSON payload:", error);
          return res.status(400).json({ error: "Invalid JSON payload" });
        }
      }

      // ====== DETAILED DEBUG LOGGING ======
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📥 WEBHOOK RECEIVED - Full Debug Info:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // Whop uses "action" for test webhooks and "type" for real webhooks
      const eventType = webhookData.type || webhookData.action;
      console.log("🔹 Event Type:", eventType || "MISSING TYPE!");
      console.log("🔹 Full Payload:", JSON.stringify(webhookData, null, 2));

      // Check if this would process commissions
      const isPaymentSucceeded = eventType === "payment.succeeded";
      console.log("🔹 Would Process Commissions:", isPaymentSucceeded ? "✅ YES" : "❌ NO");

      if (isPaymentSucceeded) {
        const payment = webhookData.data;

        if (!payment || payment === null) {
          console.log("⚠️  TEST WEBHOOK DETECTED - No payment data provided by Whop");
          console.log("ℹ️  Real webhooks will have payment data and will process commissions");
        } else {
          console.log("💰 Payment Details:");
          console.log("   - Payment ID:", payment.id || "MISSING");
          console.log("   - Amount:", payment.final_amount || payment.subtotal || payment.amount || 0);
          console.log("   - User:", payment.user?.email || "No user data");
        }

        // Check registered admins
        const registeredAdmins = await storage.getAllAdmins();
        console.log("👥 Registered Admins:", registeredAdmins.length);
        if (registeredAdmins.length > 0) {
          registeredAdmins.forEach(admin => {
            console.log(`   - Admin: ${admin.userId} (${admin.commissionShare}% share)`);
          });
        } else {
          console.log("   ⚠️ NO ADMINS REGISTERED - Will use ADMIN_USER_ID env var or skip");
        }
      } else {
        console.log("ℹ️  To test commission processing, use event type: 'payment.succeeded'");
        console.log("ℹ️  Current event type:", eventType || "undefined");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      // ====== END DEBUG LOGGING ======

      // Handle payment.succeeded event (support both "type" and "action" fields)
      if (eventType === "payment.succeeded") {
        const payment = webhookData.data;

        // Skip if test webhook with no data
        if (!payment || payment === null) {
          console.log("[Webhook] Test webhook received with no payment data - skipping commission processing");
          console.log("ℹ️  Real payment webhooks will have payment data and will process automatically");
          return res.status(200).send("OK");
        }

        console.log("[Webhook] Payment succeeded:", payment.id);

        // ================================================================
        // MULTI-TENANT COMMISSION LOGIC
        // ================================================================
        // IMPORTANT: Each admin should ONLY receive commissions for THEIR OWN members
        // This is a multi-tenant system - we must match the payment to the correct admin
        // 
        // Subscription Price: $35.00 (3500 cents) - FIXED PRICE
        // Commission: 50% = $17.50 (1750 cents)
        // ================================================================

        // Extract customer info for validation
        const customerUserId = payment.user?.id;
        const customerEmail = payment.user?.email;
        const customerUsername = payment.user?.username;

        // Validate required fields
        if (!customerUserId) {
          console.error("[Webhook] ❌ Payment has no customer user ID - cannot process");
          console.error("[Webhook] Payment data:", JSON.stringify(payment, null, 2));
          return res.status(200).send("OK");
        }

        console.log(`[Webhook] Customer: ${customerEmail || customerUserId}`);
        console.log(`[Webhook] Payment metadata:`, JSON.stringify(payment.metadata, null, 2));

        // ================================================================
        // GRANT UNLIMITED ACCESS TO CUSTOMER (Whop Best Practice)
        // ================================================================
        try {
          await storage.grantUnlimitedAccess(customerUserId);
          console.log(`[Webhook] ✅ Unlimited access granted to customer: ${customerEmail || customerUserId}`);
        } catch (error) {
          console.error(`[Webhook] ❌ Failed to grant unlimited access to customer:`, error);
          return res.status(500).json({ error: "Failed to grant customer access" });
        }

        // ================================================================
        // FIND ADMIN FOR COMMISSION ATTRIBUTION FROM METADATA
        // ================================================================
        // MULTI-TENANT: The referring admin is stored in checkout metadata
        // Multiple fallback strategies to ensure commission attribution
        let admin = null;
        let referringAdminUserId = payment.metadata?.referring_admin_user_id;
        let referringCompanyId = payment.metadata?.referring_company_id;

        // Method 1: Try metadata from checkout config
        if (referringAdminUserId) {
          admin = await storage.getAdminByUserId(referringAdminUserId);
          if (admin) {
            console.log(`[Webhook] ✓ Found referring admin from metadata: ${admin.userId}`);
          } else {
            console.warn(`[Webhook] ⚠️  Admin from metadata (${referringAdminUserId}) not found in database`);
          }
        }

        // Method 2: Check if this user already exists as a stored member for an admin (direct lookup)
        if (!admin) {
          const existingMember = await storage.getStoredMemberByUserId(customerUserId);
          if (existingMember) {
            admin = await storage.getAdminByUserId(existingMember.adminUserId);
            if (admin) {
              referringAdminUserId = admin.userId;
              referringCompanyId = existingMember.companyId;
              console.log(`[Webhook] ✓ Found admin from existing member record: ${admin.userId}`);
            }
          }
        }

        // ================================================================
        // STORE MEMBER FOR MULTI-TENANT TRACKING (ALWAYS - even if admin unknown)
        // ================================================================
        const planId = process.env.WHOP_PLAN_ID || "unknown";
        const ownerCompanyId = process.env.WHOP_COMPANY_ID || "unknown";

        try {
          let userDetails: any = null;
          if (whopSdk) {
            try {
              userDetails = await whopSdk.users.retrieve(customerUserId);
            } catch (e) {
              console.warn(`[Webhook] Could not fetch user details for ${customerUserId}`);
            }
          }

          let profilePicUrl: string | null = null;
          if (userDetails?.profile_picture) {
            if (typeof userDetails.profile_picture === 'string') {
              profilePicUrl = userDetails.profile_picture;
            } else if (typeof userDetails.profile_picture === 'object') {
              profilePicUrl = userDetails.profile_picture.url || userDetails.profile_picture.image_url || null;
            }
          }

          // Use placeholder values if admin not found - allows future reconciliation
          const memberAdminId = admin?.userId || "pending_attribution";
          const memberCompanyId = referringCompanyId || ownerCompanyId;

          const memberData = {
            id: `member_${payment.id}_${Date.now()}`,
            membershipId: payment.membership_id || `pay_${payment.id}`,
            userId: customerUserId,
            username: userDetails?.username || customerUsername || customerUserId,
            name: userDetails?.name || null,
            profilePictureUrl: profilePicUrl,
            adminUserId: memberAdminId,
            companyId: memberCompanyId,
            productId: payment.product?.id || "unlimited_access",
            productTitle: payment.product?.title || "Unlimited Access",
            planId: planId,
            status: "active" as const,
            renewalPeriodStart: payment.renewal_period_start ? new Date(payment.renewal_period_start) : new Date(),
            renewalPeriodEnd: payment.renewal_period_end ? new Date(payment.renewal_period_end) : null,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            cancellationReason: null,
            commissionProcessed: admin !== null,
          };

          await storage.upsertStoredMember(memberData);
          if (admin) {
            console.log(`[Webhook] ✅ Member stored: ${memberData.username} attributed to admin ${admin.userId}`);
          } else {
            console.log(`[Webhook] ✅ Member stored with pending attribution: ${memberData.username}`);
          }
        } catch (error) {
          console.error(`[Webhook] ⚠️ Failed to store member (non-critical):`, error);
        }

        // If no admin found, we've stored the member for future reconciliation but can't process commission
        if (!admin) {
          console.warn(`[Webhook] ⚠️  No referring admin found through any method`);
          console.warn("[Webhook] Customer has unlimited access, member stored, but no commission will be recorded");
          return res.status(200).send("OK");
        }

        // ================================================================
        // IDEMPOTENCY CHECK - Must happen BEFORE commission processing
        // ================================================================
        // Check if this specific admin has already been credited for this payment
        const alreadyProcessed = await storage.hasProcessedPayment(payment.id, admin.userId);
        if (alreadyProcessed) {
          console.log(`[Webhook] Payment ${payment.id} already processed for admin ${admin.userId}`);
          console.log(`[Webhook] Customer access already granted, commission already recorded`);
          return res.status(200).send("OK");
        }

        // ================================================================
        // FIXED PRICING ENFORCEMENT
        // ================================================================
        // Subscription Price: $35.00 = 3500 cents (ALWAYS)
        // Commission: 50% = $17.50 = 1750 cents (ALWAYS)
        // 
        // SECURITY: We DO NOT trust the payment amount from the webhook payload
        // We always use our fixed constants regardless of what Whop sends
        // ================================================================
        const SUBSCRIPTION_PRICE_CENTS = 3500;  // Fixed: $35.00
        const COMMISSION_CENTS = 1750;           // Fixed: $17.50 (50% of $35.00)

        // Read incoming payment amount for logging only - DO NOT USE for commission calculation
        const incomingPaymentAmount = (payment as any).final_amount || (payment as any).subtotal || (payment as any).amount || 0;

        // Log if incoming amount differs from our fixed price (for debugging)
        if (incomingPaymentAmount !== SUBSCRIPTION_PRICE_CENTS) {
          console.warn(`[Webhook] ⚠️  Incoming payment amount ($${incomingPaymentAmount / 100}) doesn't match fixed price $35.00`);
          console.warn(`[Webhook] ENFORCING fixed price - commission will be $17.50 regardless of incoming amount`);
        }

        console.log(`[Webhook] Incoming amount: $${incomingPaymentAmount / 100}, Enforced amount: $${SUBSCRIPTION_PRICE_CENTS / 100}`);
        console.log(`[Webhook] Commission (fixed 50%): $${COMMISSION_CENTS / 100}`);

        // ================================================================
        // COMMISSION TRACKING
        // ================================================================
        // Record the fixed $2.50 commission for this admin
        // Access was already granted above following Whop best practices

        // Record commission payment with deterministic ID for idempotency
        const commissionId = `comm_${payment.id}_${admin.userId}`;

        try {
          await storage.recordCommissionPayment({
            id: commissionId,
            paymentId: payment.id,
            adminUserId: admin.userId,
            amount: SUBSCRIPTION_PRICE_CENTS,      // FIXED: Always $35.00
            commissionAmount: COMMISSION_CENTS,     // FIXED: Always $17.50
            customerUserId: customerUserId,
            customerEmail: customerEmail || null,
          });

          console.log(`[Webhook] ✓ Commission recorded: $${COMMISSION_CENTS / 100} for admin ${admin.userId}`);
        } catch (error) {
          console.error(`[Webhook] ❌ Failed to record commission for admin ${admin.userId}:`, error);
          // Return 500 so Whop retries the webhook
          return res.status(500).json({ error: "Failed to record commission" });
        }

        // ================================================================
        // SUCCESS - Commission tracked for admin
        // ================================================================
        console.log(`[Webhook] ✅ COMPLETE - Admin earned $${COMMISSION_CENTS / 100} commission`);
        console.log(`[Webhook] ✓ Multi-tenant subscription processing successful!`);
      }

      return res.status(200).send("OK");
    } catch (error) {
      console.error("[Webhook] Error processing webhook:", error);
      return res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  app.post("/api/chat/sessions", async (req, res) => {
    try {
      let userId = "dev_user";

      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      // Validate request body (no payload expected for new sessions, reject unexpected fields)
      const createSchema = z.object({}).strict();
      const validation = createSchema.safeParse(req.body || {});
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const sessionId = await storage.createChatSession(userId);
      return res.json({ sessionId });
    } catch (error) {
      console.error("Error creating chat session:", error);
      return res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  app.get("/api/chat/sessions", async (req, res) => {
    try {
      let userId = "dev_user";

      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const sessions = await storage.getUserChatSessions(userId, limit);
      return res.json(sessions);
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      return res.status(500).json({ error: "Failed to fetch chat sessions" });
    }
  });

  app.get("/api/chat/sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getChatSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      let userId = "dev_user";
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      return res.json(session);
    } catch (error) {
      console.error("Error fetching chat session:", error);
      return res.status(500).json({ error: "Failed to fetch chat session" });
    }
  });

  app.put("/api/chat/sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getChatSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      let userId = "dev_user";
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Create a schema that accepts ISO string timestamps and converts them
      const updateMessageSchema = messageSchema.extend({
        timestamp: z.string().transform((str) => new Date(str)),
      });

      const updateSchema = z.object({
        messages: z.array(updateMessageSchema),
        tradingPair: z.string().optional(),
        timeframe: z.string().optional(),
        analysisStages: z.array(z.any()).optional(),
      });

      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const { messages, tradingPair, timeframe, analysisStages } = validation.data;
      await storage.updateChatSession(id, messages, tradingPair, timeframe, analysisStages);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error updating chat session:", error);
      return res.status(500).json({ error: "Failed to update chat session" });
    }
  });

  app.delete("/api/chat/sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getChatSession(id);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      let userId = "dev_user";
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteChatSession(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat session:", error);
      return res.status(500).json({ error: "Failed to delete chat session" });
    }
  });

  // WebSocket server on distinct path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected');

    // Store prediction history for this session
    const predictionHistory: Array<{
      pair: TradingPair;
      direction: "UP" | "DOWN" | "NEUTRAL";
      confidence: number;
      timestamp: Date;
    }> = [];

    // Store resolver for ai_thinking_complete acknowledgment
    let aiThinkingCompleteResolver: (() => void) | null = null;
    let analysisInProgress = false;

    function createAiThinkingCompletePromise(): Promise<void> {
      return new Promise<void>((resolve) => {
        aiThinkingCompleteResolver = resolve;
      });
    }

    // Don't send welcome message automatically on connection
    // User will see the welcome when they click "New Session" or on first visit

    ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());

        if (message.type === 'select_pair' && message.pair) {
          const userId = message.userId || "dev_user";
          const timeframe = message.timeframe || "M1";
          handlePairSelection(ws, message.pair, predictionHistory, userId, createAiThinkingCompletePromise, () => analysisInProgress, (val) => { analysisInProgress = val; }, timeframe);
        } else if (message.type === 'user_message' && message.content) {
          const userId = message.userId || "dev_user";
          handleUserMessage(ws, message.content, predictionHistory, userId, createAiThinkingCompletePromise, () => analysisInProgress, (val) => { analysisInProgress = val; });
        } else if (message.type === 'history') {
          handleHistory(ws, predictionHistory);
        } else if (message.type === 'new_session') {
          handleNewSession(ws, predictionHistory);
        } else if (message.type === 'ai_thinking_complete') {
          if (aiThinkingCompleteResolver) {
            aiThinkingCompleteResolver();
            aiThinkingCompleteResolver = null;
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  async function handlePairSelection(
    ws: WebSocket,
    pair: TradingPair,
    history: Array<any>,
    userId: string,
    createAiThinkingCompletePromise: () => Promise<void>,
    isAnalysisInProgress?: () => boolean,
    setAnalysisInProgress?: (value: boolean) => void,
    timeframe?: string
  ) {
    if (ws.readyState !== WebSocket.OPEN) return;

    if (isAnalysisInProgress && isAnalysisInProgress()) {
      return;
    }

    if (setAnalysisInProgress) {
      setAnalysisInProgress(true);
    }

    try {
      let userCredits = await storage.getUserCredits(userId);

      if (!userCredits) {
        await storage.setUserCredits(userId, 3);
        userCredits = await storage.getUserCredits(userId);
      }

      if (!userCredits) {
        console.error("Failed to initialize user credits");
        return;
      }

      // Check if user has credits (but don't deduct yet - only check)
      if (!userCredits.hasUnlimitedAccess) {
        if (userCredits.credits <= 0) {
          const insufficientMsg: ServerMessage = {
            type: "insufficient_credits",
            content: "You've run out of analysis credits! Purchase more to continue analyzing crypto pairs.",
            credits: 0,
          };
          ws.send(JSON.stringify(insufficientMsg));
          return;
        }
      }

      // Show typing indicator
      const typingMsg: ServerMessage = {
        type: "typing",
        content: "",
      };
      ws.send(JSON.stringify(typingMsg));

      await new Promise(resolve => setTimeout(resolve, 600));

      if (ws.readyState !== WebSocket.OPEN) return;

      // Generate transparent prediction with real-time stage updates
      const aiCompletePromise = createAiThinkingCompletePromise();
      const prediction = await generateTransparentPrediction(pair, ws, () => aiCompletePromise, timeframe || "M1");

      if (ws.readyState !== WebSocket.OPEN) return;

      // Only deduct credits if we got an actionable prediction (UP or DOWN, not NEUTRAL)
      const isActionablePrediction = prediction.direction !== "NEUTRAL";

      if (isActionablePrediction && !userCredits.hasUnlimitedAccess) {
        const success = await storage.decrementUserCredits(userId);

        if (!success) {
          // This shouldn't happen since we checked earlier, but handle it just in case
          const insufficientMsg: ServerMessage = {
            type: "insufficient_credits",
            content: "You've run out of analysis credits! Purchase more to continue analyzing crypto pairs.",
            credits: 0,
          };
          ws.send(JSON.stringify(insufficientMsg));
          return;
        }
      }

      // Store in history
      history.push({
        pair: prediction.pair,
        direction: prediction.direction,
        confidence: prediction.confidence,
        timestamp: new Date(),
      });

      // Send prediction with comprehensive analysis
      const predictionMsg: ServerMessage = {
        type: "prediction",
        content: prediction.analysis || `Analysis complete for ${pair}`,
        prediction,
      };
      ws.send(JSON.stringify(predictionMsg));

      // Send updated credits count
      const updatedCredits = await storage.getUserCredits(userId);
      if (updatedCredits) {
        const creditsUpdateMsg: ServerMessage = {
          type: "credits_update",
          content: "",
          credits: updatedCredits.credits,
        };
        ws.send(JSON.stringify(creditsUpdateMsg));
      }

      // Inform user about credit status based on prediction type
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;

        let followUpContent: string;

        if (!isActionablePrediction) {
          // NEUTRAL prediction - no credits consumed
          followUpContent = "No credits consumed for this analysis. Market conditions didn't meet our confidence threshold. Try another pair!";
        } else {
          // Actionable prediction - credits were deducted
          followUpContent = "Want another prediction? Pick a different pair below.";
        }

        const followUpMsg: ServerMessage = {
          type: "bot_message",
          content: followUpContent,
        };
        ws.send(JSON.stringify(followUpMsg));
      }, 1000);
    } catch (error) {
      console.error("Error generating prediction:", error);

      if (ws.readyState !== WebSocket.OPEN) return;

      const errorMsg: ServerMessage = {
        type: "bot_message",
        content: "Market data service is temporarily unavailable. Please try again in a moment.",
      };
      ws.send(JSON.stringify(errorMsg));
    } finally {
      if (setAnalysisInProgress) {
        setAnalysisInProgress(false);
      }
    }
  }

  function handleUserMessage(
    ws: WebSocket,
    content: string,
    history: Array<any>,
    userId: string,
    createAiThinkingCompletePromise: () => Promise<void>,
    isAnalysisInProgress?: () => boolean,
    setAnalysisInProgress?: (value: boolean) => void
  ) {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Check for /history command
    if (content.toLowerCase() === "/history") {
      handleHistory(ws, history);
      return;
    }

    // Try to match trading pair (crypto or forex)
    const upperContent = content.toUpperCase().replace(/\s/g, "");
    const matchedPair = tradingPairs.find(
      (pair) => upperContent.includes(pair.replace("/", ""))
    );

    if (matchedPair) {
      handlePairSelection(ws, matchedPair, history, userId, createAiThinkingCompletePromise, isAnalysisInProgress, setAnalysisInProgress);
    } else {
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const helpMsg: ServerMessage = {
          type: "bot_message",
          content: "I can help you with crypto and forex predictions! Try selecting a pair like BTC/USDT, EUR/USD, or use the quick select buttons below.",
        };
        ws.send(JSON.stringify(helpMsg));
      }, 500);
    }
  }

  function handleHistory(ws: WebSocket, history: Array<any>) {
    if (ws.readyState !== WebSocket.OPEN) return;

    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) return;

      if (history.length === 0) {
        const noHistoryMsg: ServerMessage = {
          type: "bot_message",
          content: "No prediction history yet. Try selecting a crypto pair to get started!",
        };
        ws.send(JSON.stringify(noHistoryMsg));
        return;
      }

      const recent = history.slice(-5);
      let historyText = `Last ${recent.length} Predictions:\n\n`;
      recent.forEach((pred, idx) => {
        const directionLabel = pred.direction === "NEUTRAL" ? "NEUTRAL" : pred.direction;
        historyText += `${idx + 1}. ${pred.pair} - ${directionLabel} (${pred.confidence}%)\n`;
      });

      const historyMsg: ServerMessage = {
        type: "bot_message",
        content: historyText,
      };
      ws.send(JSON.stringify(historyMsg));
    }, 500);
  }

  function handleNewSession(ws: WebSocket, history: Array<any>) {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Clear prediction history
    history.length = 0;

    // Send welcome message
    const welcomeMsg: ServerMessage = {
      type: "bot_message",
      content: "Welcome to CryptoMind AI! I provide real-time crypto and forex predictions powered by AI analysis. Simply pick a trading pair below to get started.",
    };
    ws.send(JSON.stringify(welcomeMsg));
  }

  return httpServer;
}
