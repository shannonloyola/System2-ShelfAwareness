import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function DashboardAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
