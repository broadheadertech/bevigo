import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { SWRegister } from "@/components/register/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bevi&go POS",
  description: "Coffee-native point-of-sale system",
  manifest: "/manifest.json",
  themeColor: "#92400e",
  appleWebApp: {
    capable: true,
    title: "bevi&go POS",
  },
  icons: {
    apple: "/icons/icon.svg",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <SWRegister />
      </body>
    </html>
  );
}
