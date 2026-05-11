"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type AppRole =
  | "owner_president"
  | "finance_manager"
  | "procurement_manager"
  | "logistics_coordinator"
  | "warehouse_manager"
  | "qc_inspector"
  | "sales_processor"
  | "delivery_person"
  | "b2b_customer"
  | "supplier";

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  isLoading: boolean;
}

const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_USER_ACCESS_SERVICE_URL || "http://localhost:4014";
const ROLE_LOOKUP_TIMEOUT_MS = 2500;
const ROLE_CACHE_PREFIX = "shelf-awareness-role:";

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
});

const getRoleCacheKey = (userId: string) =>
  `${ROLE_CACHE_PREFIX}${userId}`;

const readCachedRole = (userId: string): AppRole | null => {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(getRoleCacheKey(userId));
  return cached ? (cached as AppRole) : null;
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
    const appMetaRole = sessionUser.app_metadata?.role as AppRole | undefined;
    if (appMetaRole) {
      setRole(appMetaRole);
      writeCachedRole(sessionUser.id, appMetaRole);
      setIsLoading(false);
      return;
    }

    const userMetaRole = sessionUser.user_metadata?.role as AppRole | undefined;
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
    } else {
      setRole("b2b_customer");
      setIsLoading(false);
    }

    void fetchRole(sessionUser.id, sessionUser.email ?? undefined);
  };

  const fetchRole = async (userId: string, email?: string) => {
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
      if (data && !error && data.role) {
        const nextRole = data.role as AppRole;
        setRole(nextRole);
        writeCachedRole(userId, nextRole);
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

      const response = await fetch(`${AUTH_SERVICE_URL}/auth/role?${params.toString()}`, {
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Role lookup failed with status ${response.status}`);
      }

      const resolved = (await response.json()) as { role?: AppRole };
      if (resolved.role) {
        setRole(resolved.role);
        writeCachedRole(userId, resolved.role);
        return;
      }

      setRole("b2b_customer");
    } catch (err) {
      console.error("Error fetching user role:", err);
      setRole("b2b_customer");
      clearCachedRole(userId);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
