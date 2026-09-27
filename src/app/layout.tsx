import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "CivicPulse: citizen voice to public investment", template: "%s · CivicPulse" },
  description:
    "An open-source Digital Public Good that turns multilingual citizen voice notes, texts and USSD messages into ranked, evidence-backed infrastructure priorities for BRICS cities.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#060a13", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
