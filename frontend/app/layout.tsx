import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clearpath — Compliance exposure in one report",
  description:
    "Supplier sanctions, tariff exposure, and US regulatory requirements for physical products.",
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
