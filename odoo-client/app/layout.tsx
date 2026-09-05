import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import type { CSSProperties } from "react";
import { themePresets } from "@/features/nexacrm/utils/theme-presets";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "PeoplePay360",
    template: "%s | PeoplePay360",
  },
  description: "Integrated human resource and payroll operations platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeStyle = Object.fromEntries(
    Object.entries(themePresets["modern-minimal"].styles.light).map(
      ([key, value]) => [`--${key}`, value],
    ),
  ) as CSSProperties;

  return (
    <html
      lang="en"
      data-theme-preset="modern-minimal"
      style={themeStyle}
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
