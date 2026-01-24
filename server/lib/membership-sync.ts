import { whopSdk, isWhopEnabled } from "./whop-sdk";
import { storage } from "../storage";
import { InsertStoredMember, MembershipStatus } from "@shared/schema";

const DEFAULT_COMMISSION_AMOUNT = 250; // $2.50 (50% of $5)

interface MembershipSyncResult {
  synced: number;
  newMembers: number;
  updatedMembers: number;
  commissionsProcessed: number;
  errors: string[];
}

function extractProfilePictureUrl(profilePicture: any): string | null {
  if (!profilePicture) return null;

  let profilePicUrl: string | null = null;
  if (typeof profilePicture === 'string') {
    profilePicUrl = profilePicture;
  } else if (typeof profilePicture === 'object') {
    profilePicUrl = profilePicture.url || profilePicture.image_url || null;
  }

  if (profilePicUrl && profilePicUrl.includes('/plain/')) {
    const lastPlainIndex = profilePicUrl.lastIndexOf('/plain/');
    const extractedUrl = profilePicUrl.substring(lastPlainIndex + 7);
    if (extractedUrl.startsWith('http')) {
      profilePicUrl = extractedUrl;
    }
  }

  return profilePicUrl;
}

/**
 * Sync memberships for an admin by:
 * 1. Fetching all memberships from WHOP_COMPANY_ID (owner's product)
 * 2. Filtering to only stored members for this admin
 * 3. Updating status of existing members
 * 4. Processing commissions for new active members
 */
export async function syncMembershipsForCompany(
  adminCompanyId: string,
  adminUserId: string,
  commissionAmount: number = DEFAULT_COMMISSION_AMOUNT
): Promise<MembershipSyncResult> {
  const result: MembershipSyncResult = {
    synced: 0,
    newMembers: 0,
    updatedMembers: 0,
    commissionsProcessed: 0,
    errors: [],
  };

  if (!isWhopEnabled || !whopSdk) {
    result.errors.push("Whop SDK not configured");
    return result;
  }

  // MULTI-TENANT: Fetch from OWNER's company, not admin's company
  const ownerCompanyId = process.env.WHOP_COMPANY_ID;
  if (!ownerCompanyId) {
    result.errors.push("WHOP_COMPANY_ID not configured");
    return result;
  }

  try {
    console.log(`[MembershipSync] Starting sync for admin ${adminUserId} (company: ${adminCompanyId})`);
    console.log(`[MembershipSync] Fetching memberships from owner company: ${ownerCompanyId}`);

    // Get stored members for this admin to know which memberships to track
    const storedMembers = await storage.getStoredMembersByAdmin(adminUserId);
    const storedMemberUserIds = new Set(storedMembers.map(m => m.userId));
    const storedMembershipIds = new Map(storedMembers.map(m => [m.membershipId, m]));

    console.log(`[MembershipSync] Admin has ${storedMembers.length} stored members`);

    // Fetch all memberships from WHOP_COMPANY_ID
    const allMemberships: any[] = [];
    for await (const membership of whopSdk.memberships.list({
      company_id: ownerCompanyId,
      first: 200,
    })) {
      allMemberships.push(membership);
    }

    console.log(`[MembershipSync] Fetched ${allMemberships.length} total memberships from owner company`);

    // Filter to only memberships that belong to this admin's stored members
    const adminMemberships = allMemberships.filter(m =>
      storedMembershipIds.has(m.id) || storedMemberUserIds.has(m.user?.id)
    );

    console.log(`[MembershipSync] Found ${adminMemberships.length} memberships for admin ${adminUserId}`);

    for (const membership of adminMemberships) {
      try {
        let profilePicUrl: string | null = null;
        let username = membership.user?.username || "unknown";
        let name = membership.user?.name || null;

        if (membership.user?.id && whopSdk) {
          try {
            const userDetails = await whopSdk.users.retrieve(membership.user.id);
            username = userDetails.username || username;
            name = userDetails.name || name;
            profilePicUrl = extractProfilePictureUrl(userDetails.profile_picture);
          } catch (userError) {
            console.warn(`[MembershipSync] Could not fetch user details for ${membership.user.id}`);
          }
        }

        const status = membership.status as MembershipStatus;
        const memberData: InsertStoredMember = {
          id: `member_${membership.id}_${Date.now()}`,
          membershipId: membership.id,
          userId: membership.user?.id || "unknown",
          username,
          name,
          profilePictureUrl: profilePicUrl,
          adminUserId,
          companyId: adminCompanyId,
          productId: membership.product?.id || "unknown",
          productTitle: membership.product?.title || "Unknown Product",
          planId: membership.plan?.id || process.env.WHOP_PLAN_ID || "unknown",
          status,
          renewalPeriodStart: membership.renewal_period_start ? new Date(membership.renewal_period_start) : null,
          renewalPeriodEnd: membership.renewal_period_end ? new Date(membership.renewal_period_end) : null,
          cancelAtPeriodEnd: membership.cancel_at_period_end || false,
          canceledAt: membership.canceled_at ? new Date(membership.canceled_at) : null,
          cancellationReason: membership.cancellation_reason || null,
          commissionProcessed: storedMembershipIds.get(membership.id)?.commissionProcessed || false,
        };

        const { isNew } = await storage.upsertStoredMember(memberData);

        result.synced++;
        if (isNew) {
          result.newMembers++;
          console.log(`[MembershipSync] New member detected: ${username} (${membership.id})`);

          if (["active", "trialing", "completed"].includes(status)) {
            await processCommissionForMember(membership.id, adminUserId, membership.user?.id, commissionAmount);
            result.commissionsProcessed++;
          }
        } else {
          result.updatedMembers++;
        }
      } catch (memberError) {
        const errorMsg = `Error processing membership ${membership.id}: ${memberError instanceof Error ? memberError.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[MembershipSync] ${errorMsg}`);
      }
    }

    console.log(`[MembershipSync] Sync complete: ${result.synced} synced, ${result.newMembers} new, ${result.updatedMembers} updated, ${result.commissionsProcessed} commissions`);

  } catch (error) {
    const errorMsg = `Error syncing memberships: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    console.error(`[MembershipSync] ${errorMsg}`);
  }

  return result;
}

async function processCommissionForMember(
  membershipId: string,
  adminUserId: string,
  customerUserId: string | undefined,
  commissionAmount: number
): Promise<boolean> {
  try {
    const existingMember = await storage.getStoredMemberByMembershipId(membershipId);
    if (existingMember?.commissionProcessed) {
      console.log(`[MembershipSync] Commission already processed for ${membershipId}`);
      return false;
    }

    const paymentId = `membership_${membershipId}`;
    const hasProcessed = await storage.hasProcessedPayment(paymentId, adminUserId);
    if (hasProcessed) {
      console.log(`[MembershipSync] Commission already recorded for ${membershipId}`);
      await storage.markMemberCommissionProcessed(membershipId);
      return false;
    }

    await storage.recordCommissionPayment({
      id: `comm_${membershipId}_${Date.now()}`,
      paymentId,
      adminUserId,
      amount: commissionAmount,
      commissionAmount,
      customerUserId: customerUserId || null,
      customerEmail: null,
    });

    await storage.markMemberCommissionProcessed(membershipId);

    console.log(`[MembershipSync] Commission of ${commissionAmount} added for admin ${adminUserId} from membership ${membershipId}`);
    return true;
  } catch (error) {
    console.error(`[MembershipSync] Error processing commission for ${membershipId}:`, error);
    return false;
  }
}

export async function syncAllAdminMemberships(commissionAmount: number = DEFAULT_COMMISSION_AMOUNT): Promise<Map<string, MembershipSyncResult>> {
  const results = new Map<string, MembershipSyncResult>();

  try {
    const admins = await storage.getAllAdmins();
    console.log(`[MembershipSync] Starting sync for ${admins.length} admins`);

    for (const admin of admins) {
      if (!admin.companyId) {
        console.log(`[MembershipSync] Skipping admin ${admin.userId} - no company ID`);
        continue;
      }

      const result = await syncMembershipsForCompany(admin.companyId, admin.userId, commissionAmount);
      results.set(admin.userId, result);
    }
  } catch (error) {
    console.error(`[MembershipSync] Error syncing all admin memberships:`, error);
  }

  return results;
}

let syncIntervalId: NodeJS.Timeout | null = null;

export function startMembershipSyncPolling(intervalMs: number = 5 * 60 * 1000): void {
  if (syncIntervalId) {
    console.log("[MembershipSync] Polling already running");
    return;
  }

  console.log(`[MembershipSync] Starting polling with interval ${intervalMs}ms`);

  syncAllAdminMemberships().catch(err => {
    console.error("[MembershipSync] Initial sync error:", err);
  });

  syncIntervalId = setInterval(() => {
    syncAllAdminMemberships().catch(err => {
      console.error("[MembershipSync] Scheduled sync error:", err);
    });
  }, intervalMs);
}

export function stopMembershipSyncPolling(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("[MembershipSync] Polling stopped");
  }
}
