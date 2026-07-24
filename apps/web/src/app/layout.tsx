import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/app/providers";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "TripRadar AI — Monitoramento inteligente de passagens aéreas",
    template: "%s · TripRadar AI",
  },
  description:
    "Monitore rotas, receba alertas quando o preço cair e saiba a hora certa de comprar, com IA explicável.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
