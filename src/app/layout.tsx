import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TAROT",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav>
          <ul>
            <li>
              <Link href="/">All cards</Link>
            </li>
            <li>
              <Link href="/major">Major</Link>
            </li>
            <li>
              <Link href="/minor">Minor</Link>
            </li>
          </ul>
        </nav>
        <div>{children}</div>
      </body>
    </html>
  );
}
