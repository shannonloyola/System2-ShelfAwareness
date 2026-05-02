"use client";

import { ReactNode } from "react";
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
  ScanBarcode,
  User,
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  { name: "Product Master", href: "/products", icon: Database },
  { name: "Procurement", href: "/procurement", icon: Package },
  { name: "PO List", href: "/po-list", icon: FileText },
  { name: "Warehouse", href: "/warehouse", icon: Warehouse },
  {
    name: "Discrepancies",
    href: "/discrepancies",
    icon: ClipboardList,
  },
  { name: "Stock Management", href: "/stock", icon: BarChart3 },
  {
    name: "Distribution",
    href: "/distribution",
    icon: TruckIcon,
  },
  {
    name: "Scan Shipment",
    href: "/scan-shipment",
    icon: ScanBarcode,
  },
];

export function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    toast.success("Logged Out", {
      description: "You have been successfully logged out",
    });
    setTimeout(() => {
      router.push("/login");
    }, 500);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar - Midnight Blue */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-[#1A2B47] text-white">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Shelf Awareness
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Medical Logistics
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
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

        <div className="p-4 border-t border-white/10 space-y-3">
          {/* User Profile */}
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p
                className="text-sm font-semibold"
                style={{
                  fontFamily: "Public Sans, sans-serif",
                }}
              >
                Admin User
              </p>
              <p
                className="text-xs text-white/60"
                style={{
                  fontFamily: "Public Sans, sans-serif",
                }}
              >
                admin@shelfaware.ph
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-3 px-4 rounded-lg font-semibold"
            variant="outline"
            style={{ fontFamily: "Public Sans, sans-serif" }}
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
            <button className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
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
          {navigation.map((item) => {
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
