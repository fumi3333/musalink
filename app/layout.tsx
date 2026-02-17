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
import { OnboardingModal } from "@/components/auth/OnboardingModal";

export const metadata: Metadata = {
  title: "Musalink | 武蔵野大学生専用の教科書・フリマアプリ",
  description: "教科書、電子機器、家具をキャンパス内で売買しよう。学内取引だから送料0円。いつもの教室や食堂で、お昼休みに受け渡し。もう、高い送料や知らない人との取引に悩む必要はありません。",
  openGraph: {
    title: "Musalink | キャンパス内で手渡し、送料0円。",
    description: "武蔵野/有明キャンパスで直接受け渡し。メルカリよりも送料分（約500円〜）お得に、教科書や古着を売買できます。",
    type: "website",
    locale: "ja_JP",
    siteName: "Musalink",
  },
  twitter: {
    card: "summary_large_image",
    title: "Musalink | キャンパス内で手渡し、送料0円。",
    description: "武蔵野/有明キャンパスで直接受け渡し。送料分お得に教科書やアイテムをゲットしよう。",
  },
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
          <OnboardingModal />
          <Footer />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
