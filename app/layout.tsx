import type { Metadata, Viewport } from "next";
import { ThemeSync } from "@/components/ts/theme-toggle";
import { THEME_SCRIPT } from "@/lib/client/theme";
import { baloo, balooDa, nunito } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "TuitionSetu",
  description: "Turn your class notes into WhatsApp updates for parents, checked before you send them.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme on <html> before React hydrates.
    <html lang="en" className={`${nunito.variable} ${baloo.variable} ${balooDa.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
