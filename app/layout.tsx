import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import { getPublicAppUrl } from "@/lib/env";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const publicAppUrl = getPublicAppUrl();

export const metadata: Metadata = {
  title: {
    default: "Light Control Dashboard",
    template: "%s | Light Control Dashboard",
  },
  description:
    "A Next.js relay dashboard and HTTP API for controlling an ESP32 from Vercel.",
  ...(publicAppUrl ? { metadataBase: new URL(publicAppUrl) } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
