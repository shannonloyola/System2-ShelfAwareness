import { createHttpError } from "../lib/http.js";
import {
  getAuthUserById,
  getCurrentAuthUser,
  getMyProfileRest,
  getProfileByIdRest,
} from "../lib/supabaseRest.js";

const SEED_USER_ROLES = {
  "owner@test.com": "owner_president",
  "finance@test.com": "finance_manager",
  "procurement@test.com": "procurement_manager",
  "logistics@test.com": "logistics_coordinator",
  "warehouse@test.com": "warehouse_manager",
  "qc@test.com": "qc_inspector",
  "sales@test.com": "sales_processor",
  "delivery@test.com": "delivery_person",
  "b2b@test.com": "b2b_customer",
  "supplier@test.com": "supplier",
};

const getSeedRoleByEmail = (email) => {
  if (typeof email !== "string") {
    return null;
  }

  return SEED_USER_ROLES[email.trim().toLowerCase()] ?? null;
};

export const validateUserSession = async (token) => {
  if (!token) {
    throw createHttpError(401, "Token is required");
  }

  console.log(`[AuthService] Validating session for token: ${token.substring(0, 8)}...`);

  // Simulation
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    valid: true,
    userId: "user_123",
    role: "admin",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
};

export const checkPermissions = async (userId, resource, action) => {
  return {
    userId,
    resource,
    action,
    allowed: true,
  };
};

export const getUserRole = async ({ userId, email, accessToken }) => {
  if (!userId && !email) {
    throw createHttpError(400, "userId or email is required");
  }

  let authUser = null;

  if (accessToken) {
    authUser = await getCurrentAuthUser(accessToken);
  }

  if (!authUser && userId) {
    authUser = await getAuthUserById(userId);
  }

  const metadataRole =
    authUser?.app_metadata?.role ??
    authUser?.user_metadata?.role ??
    null;
  const resolvedEmail = authUser?.email ?? email ?? null;

  if (metadataRole) {
    return {
      userId: authUser?.id ?? userId,
      email: resolvedEmail,
      role: metadataRole,
    };
  }

  const seedRole = getSeedRoleByEmail(resolvedEmail);
  if (seedRole) {
    return {
      userId: authUser?.id ?? userId ?? null,
      email: resolvedEmail,
      role: seedRole,
    };
  }

  const resolvedUserId = authUser?.id ?? userId ?? null;

  if (accessToken && resolvedUserId) {
    try {
      const profile = await getMyProfileRest(accessToken, resolvedUserId);

      if (profile?.role) {
        return {
          userId: resolvedUserId,
          email: resolvedEmail,
          role: profile.role,
        };
      }
    } catch (error) {
      console.warn("[AuthService] Falling back from profile lookup via user token:", error);
    }
  }

  if (userId) {
    try {
      const profile = await getProfileByIdRest(userId);

      if (profile?.role) {
        return {
          userId,
          email: resolvedEmail,
          role: profile.role,
        };
      }
    } catch (error) {
      console.warn("[AuthService] Falling back from profile lookup via service client:", error);
    }
  }

  if (authUser) {
    return {
      userId: authUser.id ?? userId ?? null,
      email: resolvedEmail,
      role: "b2b_customer",
    };
  }

  throw createHttpError(
    404,
    `User role not found for ${userId ? `userId ${userId}` : `email ${email}`}`,
  );
};
