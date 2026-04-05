import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clearpath — Compliance & supply chain sentinel",
  description:
    "Sanctions screening, regulatory guidance, Chroma-backed supply profiles, and what-if simulation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
