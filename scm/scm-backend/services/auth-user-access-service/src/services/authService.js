import { createHttpError } from "../lib/http.js";
import { getPool } from "../lib/database.js";

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

export const getUserRole = async ({ userId, email }) => {
  if (!userId && !email) {
    throw createHttpError(400, "userId or email is required");
  }

  const pool = getPool();

  if (!pool) {
    throw createHttpError(500, "Database is not configured");
  }

  const conditions = [];
  const values = [];

  if (userId) {
    values.push(userId);
    conditions.push(`u.id = $${values.length}`);
  }

  if (email) {
    values.push(email);
    conditions.push(`lower(u.email) = lower($${values.length})`);
  }

  const query = `
    SELECT u.id, u.email, p.role
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE ${conditions.join(" OR ")}
    LIMIT 1
  `;

  const { rows } = await pool.query(query, values);
  const user = rows[0];

  if (!user) {
    throw createHttpError(404, "User role not found");
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role ?? "b2b_customer",
  };
};
