import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import "./globals.css";
import React from "react";
import LayoutClient from "../components/LayoutClient";

const orbitron = Orbitron({ subsets: ["latin"], weight: ["400", "500", "700", "900"] });

export const metadata: Metadata = {
  title: "ATMOSCHAIN | Environmental Intelligence",
  description: "AI-powered waste management, plasma gasification simulation, and carbon credit marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.className} antialiased min-h-screen selection:bg-[#00F2FF] selection:text-black overflow-hidden`}>
        <LayoutClient>
          {children}
        </LayoutClient>
      </body>
    </html>
  );
}
