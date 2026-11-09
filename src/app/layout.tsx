import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Escort service and Adult meetings in India - Tharkoo", template: "%s" },
  description: "Tharkoo adult classifieds in India. Call Girls, Massages, Male Escorts, Transsexual and Adult Meetings. Post your ad free.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full">
      <body className="flex min-h-full flex-col">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
