import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coffee House Menu",
  description: "Browse our coffee menu",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
