import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peerly",
  description:
    "Peerly helps students ask questions, compare answers, and learn with AI-assisted community support.",
  icons: {
    icon: "/Images/peerly_logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
