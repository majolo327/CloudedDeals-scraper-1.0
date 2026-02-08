import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cloudeddeals.com";
const OG_TITLE = "CloudedDeals — Las Vegas Cannabis Deals";
const OG_DESCRIPTION =
  "Real-time cannabis deals scraped from 27 Las Vegas dispensaries. Top flower, vape, edible & concentrate deals updated daily.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: OG_TITLE,
  description: OG_DESCRIPTION,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: "CloudedDeals",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CloudedDeals",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
