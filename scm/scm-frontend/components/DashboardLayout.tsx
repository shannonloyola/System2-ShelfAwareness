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
  section: string;
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      ...ROUTE_ACCESS["/dashboard"],
    ],
    section: "Overview",
  },
  {
    name: "Product Master",
    href: "/products",
    icon: Database,
    roles: [
      ...ROUTE_ACCESS["/products"],
    ],
    section: "Registry",
  },
  {
    name: "Procurement",
    href: "/procurement",
    icon: Package,
    roles: ROUTE_ACCESS["/procurement"],
    section: "Inbound Logistics",
  },
  {
    name: "PO List",
    href: "/po-list",
    icon: FileText,
    roles: ROUTE_ACCESS["/po-list"],
    section: "Inbound Logistics",
  },
  {
    name: "Warehouse",
    href: "/warehouse",
    icon: Warehouse,
    roles: ROUTE_ACCESS["/warehouse"],
    section: "Inbound Logistics",
  },
  {
    name: "Stock Management",
    href: "/stock",
    icon: BarChart3,
    roles: ROUTE_ACCESS["/stock"],
    section: "Inventory & QC",
  },
  {
    name: "Discrepancies",
    href: "/discrepancies",
    icon: ClipboardList,
    roles: ROUTE_ACCESS["/discrepancies"],
    section: "Inventory & QC",
  },
  {
    name: "Distribution",
    href: "/distribution",
    icon: TruckIcon,
    roles: ROUTE_ACCESS["/distribution"],
    section: "Outbound Logistics",
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
      <aside className="fixed left-0 top-0 bottom-0 z-20 hidden w-64 h-screen lg:flex lg:flex-col bg-[#1A2B47] text-white overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold tracking-tight">
            Shelf Awareness
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Medical Logistics
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {(() => {
            let lastSection = "";
            return visibleNav.map((item) => {
              const isActive = pathname === item.href;
              const showSectionHeader = item.section && item.section !== lastSection;
              if (showSectionHeader) {
                lastSection = item.section;
              }
              return (
                <div key={item.name} className="space-y-1">
                  {showSectionHeader && (
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-3 pt-4 pb-1">
                      {item.section}
                    </div>
                  )}
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-[#00A3AD] text-white shadow-md font-semibold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                </div>
              );
            });
          })()}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2 shrink-0 bg-[#1A2B47]">
          {/* User Profile */}
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold capitalize truncate"
                style={{ fontFamily: "Public Sans, sans-serif" }}
              >
                {role?.replace(/_/g, " ") ?? "User"}
              </p>
              <p
                className="text-[10px] text-white/50 truncate"
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
            className="relative z-10 w-full pointer-events-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            variant="outline"
            style={{ fontFamily: "Public Sans, sans-serif", height: '32px' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden lg:pl-64">
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
