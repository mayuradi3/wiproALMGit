import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asset Library Importer",
  description: "Import and manage your asset libraries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
