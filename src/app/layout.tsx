import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarot Table · v2",
  description: "A tactile, three-dimensional tarot table for personal readings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
