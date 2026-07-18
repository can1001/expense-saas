import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { KakaoSdkLoader } from "@/components/KakaoSdkLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,  // 폼 입력 시 iOS 자동 줌 방지
  viewportFit: 'cover', // 노치 디스플레이 대응
};

export const metadata: Metadata = {
  title: "지출결의서 관리 시스템",
  description: "교회 지출결의서를 간편하게 작성하고 관리하세요",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '지출결의서',
  },
  formatDetection: {
    telephone: false,  // 전화번호 자동 링크 방지
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* iOS 터치 하이라이트 제거 */}
        <meta name="format-detection" content="telephone=no" />
        {/* 테마 색상 */}
        <meta name="theme-color" content="#3B82F6" />
        <meta name="msapplication-TileColor" content="#3B82F6" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <KakaoSdkLoader />
      </body>
    </html>
  );
}
