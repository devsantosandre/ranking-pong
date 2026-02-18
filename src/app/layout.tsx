import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  APP_DEFAULT_BROWSER_TITLE,
  APP_TITLE,
} from "@/lib/app-title";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#a421d2",
};

export const metadata: Metadata = {
  title: {
    default: APP_DEFAULT_BROWSER_TITLE,
    template: `${APP_TITLE} · %s`,
  },
  applicationName: APP_TITLE,
  description:
    "Aplicativo mobile-first de ranking interno de tênis de mesa com pontuação e notícias em tempo real.",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_TITLE,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
