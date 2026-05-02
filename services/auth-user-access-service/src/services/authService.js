import { createHttpError } from "../lib/http.js";

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
