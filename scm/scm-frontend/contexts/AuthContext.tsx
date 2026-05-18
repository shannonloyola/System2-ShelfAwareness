"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { normalizeAppRole, type AppRole } from "@/lib/rbac";
import { authUserAccessServiceUrl } from "@/utils/supabase/info";
export type { AppRole } from "@/lib/rbac";

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  isLoading: boolean;
  loginAsMockAdmin: (email?: string) => void;
}

const AUTH_SERVICE_URL = authUserAccessServiceUrl;
const ROLE_LOOKUP_TIMEOUT_MS = 8000;
const ROLE_CACHE_PREFIX = "shelf-awareness-role:";

const SEED_USER_ROLES: Record<string, AppRole> = {
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
  "admin@shelfawareness.com": "owner_president",
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  loginAsMockAdmin: () => {},
});

const getRoleCacheKey = (userId: string) =>
  `${ROLE_CACHE_PREFIX}${userId}`;

const readCachedRole = (userId: string): AppRole | null => {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(getRoleCacheKey(userId));
  return normalizeAppRole(cached);
};

const writeCachedRole = (userId: string, role: AppRole) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getRoleCacheKey(userId), role);
};

const clearCachedRole = (userId?: string | null) => {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(getRoleCacheKey(userId));
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      setIsLoading(true);
      if (typeof window !== "undefined" && window.localStorage.getItem("mock_admin") === "true") {
        const savedEmail = window.localStorage.getItem("mock_admin_email") || "admin@shelfawareness.com";
        setUser({
          id: "e10f5640-8a6e-4433-8f18-f3d17142f4ff",
          email: savedEmail,
          user_metadata: { role: "owner_president", full_name: "Administrator" },
          app_metadata: { role: "owner_president" },
        } as any);
        setRole("owner_president");
        setIsLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        resolveRole(session.user);
      } else {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        resolveRole(session.user);
      } else {
        clearCachedRole(user?.id);
        setUser(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const resolveRole = (sessionUser: User) => {
    const email = sessionUser.email?.trim().toLowerCase();
    if (email && SEED_USER_ROLES[email]) {
      const staticRole = SEED_USER_ROLES[email];
      setRole(staticRole);
      writeCachedRole(sessionUser.id, staticRole);
      setIsLoading(false);
      return;
    }

    const appMetaRole = normalizeAppRole(sessionUser.app_metadata?.role);
    if (appMetaRole) {
      setRole(appMetaRole);
      writeCachedRole(sessionUser.id, appMetaRole);
      setIsLoading(false);
      return;
    }

    const userMetaRole = normalizeAppRole(sessionUser.user_metadata?.role);
    if (userMetaRole) {
      setRole(userMetaRole);
      writeCachedRole(sessionUser.id, userMetaRole);
      setIsLoading(false);
      return;
    }

    const cachedRole = readCachedRole(sessionUser.id);
    if (cachedRole) {
      setRole(cachedRole);
      setIsLoading(false);
      void fetchRole(sessionUser.id, sessionUser.email ?? undefined);
    } else {
      setRole(null);
      void fetchRole(sessionUser.id, sessionUser.email ?? undefined, true);
    }
  };

  const fetchRole = async (
    userId: string,
    email?: string,
    keepLoading = false,
  ) => {
    if (keepLoading) {
      setIsLoading(true);
    }

    try {
      const profileLookup = supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      const timeoutGuard = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Role lookup timed out"));
        }, ROLE_LOOKUP_TIMEOUT_MS);
      });

      const profileResult = await Promise.race([
        profileLookup,
        timeoutGuard,
      ]);

      const { data, error } = profileResult as Awaited<typeof profileLookup>;
      const profileRole = normalizeAppRole(data?.role);
      if (data && !error && profileRole) {
        const nextRole = profileRole;
        setRole(nextRole);
        writeCachedRole(userId, nextRole);
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("userId", userId);
      if (email) {
        params.set("email", email);
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, ROLE_LOOKUP_TIMEOUT_MS);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(`${AUTH_SERVICE_URL}/auth/role?${params.toString()}`, {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Role lookup failed with status ${response.status}`);
      }

      const resolved = (await response.json()) as { role?: string };
      const serviceRole = normalizeAppRole(resolved.role);
      if (serviceRole) {
        setRole(serviceRole);
        writeCachedRole(userId, serviceRole);
        setIsLoading(false);
        return;
      }

      throw new Error("Role lookup returned no mapped role");
    } catch (err) {
      console.error("Error fetching user role:", err);
      const cachedRole = readCachedRole(userId);
      setRole(cachedRole);
      if (!cachedRole) {
        clearCachedRole(userId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsMockAdmin = (email: string = "admin@shelfawareness.com") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mock_admin", "true");
      window.localStorage.setItem("mock_admin_email", email);
    }
    setUser({
      id: "e10f5640-8a6e-4433-8f18-f3d17142f4ff",
      email: email,
      user_metadata: { role: "owner_president", full_name: "Administrator" },
      app_metadata: { role: "owner_president" },
    } as any);
    setRole("owner_president");
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, loginAsMockAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
