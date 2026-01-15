import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/Header";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Footer } from "@/components/layout/Footer";
import { InAppBrowserGuard } from "@/components/layout/InAppBrowserGuard"; // [New]

export const metadata: Metadata = {
  title: "Musashino Link",
  description: "武蔵野大学生専用マーケットプレイス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <Header />
          <main className="pt-16 min-h-[calc(100vh-100px)]">
            <InAppBrowserGuard>
              {children}
            </InAppBrowserGuard>
          </main>
          <Footer />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
