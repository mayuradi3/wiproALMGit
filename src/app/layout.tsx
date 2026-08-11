import type { Metadata } from "next"
import "./globals.css"
import { CursorProvider } from "@/components/cursor/cursor-provider"
import { BackgroundLayer } from "@/components/background-layer"

export const metadata: Metadata = {
  title: "Cerberus",
  description: "Workflow pipeline hub",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark h-full antialiased bg-background">
      <body className="min-h-dvh flex flex-col bg-transparent">
        <BackgroundLayer />
        <CursorProvider />
        {children}
      </body>
    </html>
  )
}
