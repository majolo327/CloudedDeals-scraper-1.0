import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WebSiteJsonLd, OrganizationJsonLd } from "@/components/seo";
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
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0b14",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cloudeddeals.com";
const OG_TITLE = "Las Vegas Dispensary Deals Today | CloudedDeals";
const OG_DESCRIPTION =
  "Every deal from every Las Vegas dispensary, updated daily at 8 AM. Compare prices on flower, vapes, edibles & concentrates. No account needed.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: {
    google: "tO7sgcSBDMWLDg0hiCrOTm7McFGAuGsSc6Lv0ChsNrM",
  },
  title: {
    default: OG_TITLE,
    template: "%s | CloudedDeals",
  },
  description: OG_DESCRIPTION,
  keywords: [
    "las vegas dispensary deals",
    "vegas weed deals",
    "dispensary near the strip",
    "las vegas cannabis deals",
    "vegas vape deals",
    "cheap weed las vegas",
    "las vegas edible deals",
    "vegas dispensary",
    "cannabis deals today",
  ],
  authors: [{ name: "CloudedDeals" }],
  creator: "CloudedDeals",
  publisher: "CloudedDeals",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: "CloudedDeals",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "CloudedDeals — Every Deal. Every Dispensary. One Place.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@CloudedDeals",
    creator: "@CloudedDeals",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
        {process.env.NEXT_PUBLIC_GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA4_ID}');`}
            </Script>
          </>
        )}
        <WebSiteJsonLd />
        <OrganizationJsonLd />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
