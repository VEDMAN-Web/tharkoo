import type { Metadata, Viewport } from "next";
import { SiteShell, loadShell } from "@/components/SiteShell";
import { SelectMenuEnhancer } from "@/components/ui/SelectMenuEnhancer";
import { display, sans } from "@/styles/fonts";
import { Plus_Jakarta_Sans } from "next/font/google";
import { canonical } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import "./globals.css";
import "../styles/motion.css";

export const revalidate = 60;

/** H7.1: the New design font. Only the New design uses it (.tkn scope). */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#FFFDFB",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Tharkoo, premium classifieds in India", template: "%s" },
  description: "Premium classifieds across India. Verified people and trusted listings in your city.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "color-scheme": "light" },
  openGraph: {
    siteName: "Tharkoo",
    locale: "en_IN",
    images: [{ url: canonical("/brand/og-default.png"), width: 1200, height: 630, alt: "Tharkoo" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: [canonical("/brand/og-default.png")] },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!process.env.MONGODB_URI) {
    const { connection } = await import("next/server");
    await connection();
  }
  const shell = await loadShell();
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable} ${jakarta.variable}`}>
      <body className="bg-bg text-text font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteShell shell={shell}>{children}</SiteShell>
        <SelectMenuEnhancer />
      </body>
    </html>
  );
}
