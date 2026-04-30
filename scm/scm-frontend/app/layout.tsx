import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "Pharma Distribution Management System",
  description: "Pharmaceutical supply chain and distribution portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
