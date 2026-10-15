import type { Metadata, Viewport } from "next";
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
    <html lang="en" className={`${nunito.variable} ${baloo.variable} ${balooDa.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
