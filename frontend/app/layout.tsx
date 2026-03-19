import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppFooter } from "@/components/AppFooter";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TreeCRM",
  description: "TreeCRM frontend shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="app-shell">
            <main className="app-main">{children}</main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
