import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SiteShell, loadShell } from "@/components/SiteShell";
import { display, sans } from "@/styles/fonts";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#FFFDFB",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Tharkoo, premium classifieds in India", template: "%s" },
  description: "Premium classifieds across India. Verified people and trusted listings in your city.",
  icons: { icon: "/brand/logo-mark.svg" },
  other: { "color-scheme": "light" },
  openGraph: {
    siteName: "Tharkoo",
    locale: "en_IN",
    images: ["/brand/og-default.png"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/brand/og-default.png"] },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const shell = await loadShell();
  const path = (await headers()).get("x-pathname") || "/";
  const admin = path === "/admin" || path.startsWith("/admin/");
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-bg text-text font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteShell shell={shell} pathname={path} admin={admin}>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
