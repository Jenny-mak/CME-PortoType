import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM",
  description: "Commercial banking CRM workspace for clients, contacts, loans, and campaigns.",
  other: {
    "content-language": "en",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-mode="day" suppressHydrationWarning>
      <body className={`${sans.variable} ${sans.className}`}>{children}</body>
    </html>
  );
}
