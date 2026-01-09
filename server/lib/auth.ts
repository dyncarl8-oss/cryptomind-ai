import { Request } from "express";
import { whopSdk, isWhopEnabled } from "./whop-sdk";

export interface WhopUser {
  userId: string;
  experienceId?: string;
  companyId?: string;
  resourceId?: string;
  resourceType?: string;
}

export async function verifyWhopToken(req: Request): Promise<WhopUser | null> {
  if (!isWhopEnabled || !whopSdk) {
    return null;
  }

  try {
    const token = req.headers["x-whop-user-token"] as string;
    
    if (!token) {
      return null;
    }

    const { userId } = await whopSdk.verifyUserToken(token);
    
    // Decode the JWT to get the full payload (including resource info)
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        // Extract resource information from JWT
        const resourceId = payload.resource_id;
        const resourceType = payload.resource_type;
        
        let experienceId: string | undefined;
        let companyId: string | undefined;
        
        // Determine experienceId or companyId based on resourceType
        if (resourceType === 'experience' && resourceId) {
          experienceId = resourceId;
        } else if (resourceType === 'company' && resourceId) {
          companyId = resourceId;
        }
        
        return {
          userId,
          experienceId,
          companyId,
          resourceId,
          resourceType,
        };
      } catch (decodeError) {
        // JWT decode failed, return basic user info
      }
    }
    
    return {
      userId,
    };
  } catch (error) {
    console.error("[Whop Auth] Failed to verify token:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

export function getResourceIdFromRequest(req: Request, user?: WhopUser | null, options?: { allowEnvFallback?: boolean }): { companyId?: string; experienceId?: string } {
  // Prioritize resource info from the verified JWT token
  if (user?.experienceId || user?.companyId) {
    return {
      experienceId: user.experienceId,
      companyId: user.companyId,
    };
  }
  
  // Fallback to headers, query params, and path params
  let companyId = (req.headers["x-whop-company-id"] as string) || 
                  (req.query.companyId as string) ||
                  (req.params.companyId as string) ||
                  undefined;
  
  // Only use env variable fallback if explicitly allowed (for backward compatibility in non-admin routes)
  // NEVER use this for admin/multi-tenant routes as it creates security vulnerabilities
  if (!companyId && options?.allowEnvFallback) {
    companyId = process.env.WHOP_COMPANY_ID;
  }
  
  let experienceId = (req.headers["x-whop-experience-id"] as string) || 
                     (req.query.experienceId as string) ||
                     (req.params.experienceId as string) ||
                     undefined;
  
  if (!experienceId && options?.allowEnvFallback) {
    experienceId = process.env.WHOP_EXPERIENCE_ID;
  }
  
  return { companyId, experienceId };
}

export async function checkExperienceAccess(
  userId: string,
  experienceId: string
): Promise<{ hasAccess: boolean; accessLevel?: "customer" | "admin" }> {
  if (!isWhopEnabled || !whopSdk) {
    console.warn("Whop SDK not configured - allowing access in standalone mode");
    return { hasAccess: true, accessLevel: "customer" };
  }

  try {
    const access = await whopSdk.users.checkAccess(experienceId, { id: userId });
    
    return {
      hasAccess: access.has_access,
      accessLevel: access.access_level as "customer" | "admin",
    };
  } catch (error) {
    console.error("Error checking experience access:", error);
    return { hasAccess: false };
  }
}

export async function checkCompanyAccess(
  userId: string,
  companyId: string
): Promise<{ hasAccess: boolean; accessLevel?: "customer" | "admin" }> {
  if (!isWhopEnabled || !whopSdk) {
    console.warn("Whop SDK not configured - allowing access in standalone mode");
    return { hasAccess: true, accessLevel: "admin" };
  }

  try {
    const access = await whopSdk.users.checkAccess(companyId, { id: userId });
    
    return {
      hasAccess: access.has_access,
      accessLevel: access.access_level as "customer" | "admin",
    };
  } catch (error) {
    console.error("Error checking company access:", error);
    return { hasAccess: false };
  }
}

export async function resolveCompanyIdFromExperience(experienceId: string): Promise<string | undefined> {
  if (!isWhopEnabled || !whopSdk) {
    return undefined;
  }

  try {
    console.log(`[Whop] Fetching experience: ${experienceId}`);
    const experience = await whopSdk.experiences.retrieve(experienceId);
    
    console.log(`[Whop] Experience API response:`, JSON.stringify(experience, null, 2));
    
    const companyId = typeof experience.company === 'string' ? experience.company : experience.company.id;
    console.log(`[Whop] Resolved company_id: ${companyId}`);
    return companyId;
  } catch (error: any) {
    console.error(`[Whop] Error fetching experience ${experienceId}:`);
    console.error(`[Whop] Error details:`, JSON.stringify(error, null, 2));
    if (error.body) {
      console.error(`[Whop] Error body:`, JSON.stringify(error.body, null, 2));
    }
    return undefined;
  }
}

export async function checkIfUserIsOwner(
  userId: string,
  companyId: string
): Promise<{ isOwner: boolean; error?: boolean }> {
  if (!isWhopEnabled || !whopSdk) {
    console.warn("Whop SDK not configured - cannot verify owner status");
    return { isOwner: false, error: true };
  }

  try {
    console.log(`[Whop] Checking if user ${userId} is owner of company ${companyId}`);
    
    // Whop SDK list methods return async iterators that yield individual records
    const authorizedUsersIterator = whopSdk.authorizedUsers.list({
      company_id: companyId,
      user_id: userId,
    });
    
    // Iterate through authorized user records
    for await (const authorizedUser of authorizedUsersIterator) {
      // Defensive: handle both nested user object and direct user_id
      const authUserId = authorizedUser.user?.id || (authorizedUser as any).user_id;
      
      if (authUserId === userId) {
        const isOwner = authorizedUser.role === "owner";
        console.log(`[Whop] User ${userId} role in company ${companyId}: ${authorizedUser.role} (owner: ${isOwner})`);
        // Explicit result: user found with specific role
        return { isOwner };
      }
    }
    
    // Iterator completed successfully with no matching user
    // This is an explicit negative: user is not an authorized user OR has been demoted
    console.log(`[Whop] User ${userId} is not an owner of company ${companyId}`);
    return { isOwner: false };
  } catch (error) {
    console.error(`[Whop] Error checking owner status for user ${userId} in company ${companyId}:`, error);
    // Only flag error on actual API failures (exceptions)
    // Return error flag so caller can fall back to cached admin status
    return { isOwner: false, error: true };
  }
}
