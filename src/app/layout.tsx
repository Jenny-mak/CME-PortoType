import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
