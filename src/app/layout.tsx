import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Free classified ads and Adult meetings in India - Tharkoo", template: "%s" },
  description:
    "Tharkoo #1 Adult Classified site in India. Browse our categories for getting a sex meeting. Independent Girls, Massages, Male Escorts, Transsexual and Gay Dating. Can not find what you're looking for? POST YOUR AD absolutely FREE!",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full">
      <body className={`${inter.className} flex min-h-full flex-col`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
