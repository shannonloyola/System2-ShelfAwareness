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

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
});

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
        await resolveRole(session.user);
      } else {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await resolveRole(session.user);
      } else {
        setUser(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const resolveRole = async (sessionUser: User) => {
    const appMetaRole = sessionUser.app_metadata?.role as AppRole | undefined;
    if (appMetaRole) {
      setRole(appMetaRole);
      setIsLoading(false);
      return;
    }

    const userMetaRole = sessionUser.user_metadata?.role as AppRole | undefined;
    if (userMetaRole) {
      setRole(userMetaRole);
      setIsLoading(false);
      return;
    }

    await fetchRole(sessionUser.id, sessionUser.email ?? undefined);
  };

  const fetchRole = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (data && !error) {
        setRole(data.role as AppRole);
        return;
      }

      const params = new URLSearchParams();
      params.set("userId", userId);
      if (email) {
        params.set("email", email);
      }

      const response = await fetch(`${AUTH_SERVICE_URL}/auth/role?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Role lookup failed with status ${response.status}`);
      }

      const resolved = (await response.json()) as { role?: AppRole };
      if (resolved.role) {
        setRole(resolved.role);
        return;
      }

      setRole("b2b_customer");
    } catch (err) {
      console.error("Error fetching user role:", err);
      setRole("b2b_customer");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
