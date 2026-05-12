"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  TruckIcon,
  Bell,
  Database,
  BarChart3,
  ClipboardList,
  FileText,
  LogOut,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ROUTE_ACCESS, canAccessRoute } from "@/lib/rbac";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: AppRole[]; // which roles can see this item
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      ...ROUTE_ACCESS["/dashboard"],
    ],
  },
  {
    name: "Product Master",
    href: "/products",
    icon: Database,
    roles: [
      ...ROUTE_ACCESS["/products"],
    ],
  },
  {
    name: "Procurement",
    href: "/procurement",
    icon: Package,
    roles: ROUTE_ACCESS["/procurement"],
  },
  {
    name: "PO List",
    href: "/po-list",
    icon: FileText,
    roles: ROUTE_ACCESS["/po-list"],
  },
  {
    name: "Warehouse",
    href: "/warehouse",
    icon: Warehouse,
    roles: ROUTE_ACCESS["/warehouse"],
  },
  {
    name: "Discrepancies",
    href: "/discrepancies",
    icon: ClipboardList,
    roles: ROUTE_ACCESS["/discrepancies"],
  },
  {
    name: "Stock Management",
    href: "/stock",
    icon: BarChart3,
    roles: ROUTE_ACCESS["/stock"],
  },
  {
    name: "Distribution",
    href: "/distribution",
    icon: TruckIcon,
    roles: ROUTE_ACCESS["/distribution"],
  },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoading } = useAuth();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoading || !user || canAccessRoute(role, pathname)) {
      return;
    }

    const fallbackHref =
      navigation.find((item) => role && item.roles.includes(role))?.href ??
      "/dashboard";

    toast.error("Access denied", {
      description: "Your role does not have access to this page.",
    });
    router.replace(fallbackHref);
  }, [isLoading, pathname, role, router, user]);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    toast.success("Logged Out", {
      description: "You have been successfully logged out",
    });
    router.replace("/login");
  };

  // Show spinner while loading auth state
  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A3AD]" />
      </div>
    );
  }

  // Filter nav based on role
  const visibleNav = navigation.filter(
    (item) => role && item.roles.includes(role)
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar - Midnight Blue */}
      <aside className="relative z-20 hidden w-64 shrink-0 lg:flex lg:flex-col bg-[#1A2B47] text-white">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Shelf Awareness
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Medical Logistics
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-[#00A3AD] text-white shadow-lg"
                    : "text-white/90 hover:bg-white/10"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-white/10 space-y-3">
          {/* User Profile */}
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold capitalize truncate"
                style={{ fontFamily: "Public Sans, sans-serif" }}
              >
                {role?.replace(/_/g, " ") ?? "User"}
              </p>
              <p
                className="text-xs text-white/60 truncate"
                style={{ fontFamily: "Public Sans, sans-serif" }}
              >
                {user.email}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            type="button"
            onClick={handleLogout}
            className="relative z-10 w-full pointer-events-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-3 px-4 rounded-lg font-semibold"
            variant="outline"
            style={{ fontFamily: "Public Sans, sans-serif" }}
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[#1A2B47] text-white p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              Shelf Awareness
            </h1>
            <p className="text-xs text-white/70">
              Medical Logistics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="relative z-10 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#F8FAFC]">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden bg-white border-t border-[#111827]/10 flex items-center gap-1 px-2 py-3 shadow-lg safe-area-inset-bottom overflow-x-auto">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg min-w-[48px] min-h-[48px] justify-center transition-colors ${
                  isActive ? "text-[#00A3AD]" : "text-[#6B7280]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">
                  {item.name.split(" ")[0]}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
