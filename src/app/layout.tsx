import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  APP_DEFAULT_BROWSER_TITLE,
  APP_TITLE,
} from "@/lib/app-title";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Anti-flash: aplica o tema antes do primeiro paint (evita FOUC). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('arena-theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isPwa=matchMedia('(display-mode: standalone)').matches||(navigator.standalone===true);if(!isPwa)return;var m=document.querySelector('meta[name="viewport"]');if(m)m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
