import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Tharkoo, premium classifieds in India", template: "%s" },
  description: "Tharkoo, premium classifieds in India.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className="h-full">
      <body className={`${inter.className} flex min-h-full flex-col`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
