import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { SWRegister } from "@/components/register/sw-register";
import { ThemeApplier } from "@/components/providers/theme-provider";
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
      suppressHydrationWarning
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `@media(prefers-color-scheme:dark){html,body{background-color:#0c0a09!important;color:#fafaf9!important}}html.dark,html.dark body{background-color:#0c0a09!important;color:#fafaf9!important}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bevigo-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d){document.documentElement.classList.add('dark')}}catch(e){}})()`
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <ThemeApplier />
        <SWRegister />
      </body>
    </html>
  );
}
