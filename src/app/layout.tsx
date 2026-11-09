import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Tharkoo — classifieds in your city", template: "%s | Tharkoo" },
  description: "Browse local listings by category and city. Post a free ad on Tharkoo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${sourceSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
