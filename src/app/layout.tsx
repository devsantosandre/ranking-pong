import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  APP_DEFAULT_BROWSER_TITLE,
  APP_TITLE,
} from "@/lib/app-title";
import { productConfig } from "@/lib/product-config";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: productConfig.colors.themeColorPwa,
};

export const metadata: Metadata = {
  title: {
    default: APP_DEFAULT_BROWSER_TITLE,
    template: `${APP_TITLE} · %s`,
  },
  applicationName: APP_TITLE,
  description: productConfig.description,
  icons: {
    icon: productConfig.assets.favicon,
    apple: productConfig.assets.appleTouch,
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

// Injeta CSS vars do productConfig no :root para sobrescrever globals.css quando
// env vars de branding são fornecidas. Defaults do globals.css valem se vars omitidas.
const tenantCssOverrides = `
:root {
  --primary: ${productConfig.colors.primary};
  --background: ${productConfig.colors.background};
  --ring: ${productConfig.colors.primary};
  --chart-1: ${productConfig.colors.primary};
  --sidebar-primary: ${productConfig.colors.primary};
  --sidebar-ring: ${productConfig.colors.primary};
}
.dark {
  --primary: ${productConfig.colors.primaryDark};
  --background: ${productConfig.colors.backgroundDark};
  --ring: ${productConfig.colors.primaryDark};
  --chart-1: ${productConfig.colors.primaryDark};
  --sidebar-primary: ${productConfig.colors.primaryDark};
  --sidebar-ring: ${productConfig.colors.primaryDark};
}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Extensoes do navegador (Dark Reader, Polymer-like) podem injetar
            estilos no <head> antes da hidratacao do React. suppressHydrationWarning
            evita o warning desse style especifico. */}
        <style
          id="tenant-theme-overrides"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: tenantCssOverrides }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
