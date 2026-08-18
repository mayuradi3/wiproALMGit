import type { Metadata } from "next"
import "./globals.css"
import { IBM_Plex_Sans, Zen_Dots } from "next/font/google"
import { CursorProvider } from "@/components/cursor/cursor-provider"
import { AmbientBackground } from "@/components/ambient-background"
import { BackgroundLayer } from "@/components/background-layer"
import { Analytics } from '@vercel/analytics/next'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
})

const zenDots = Zen_Dots({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-zen-dots",
})

export const metadata: Metadata = {
  title: "ALM",
  description: "Workflow pipeline hub",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`light h-full antialiased bg-transparent ${ibmPlexSans.variable} ${zenDots.variable}`}>
      <body className="min-h-dvh flex flex-col bg-transparent">
        <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
          <AmbientBackground
            baseColor="#ffffff"
            color1="rgba(177, 200, 214, 0.35)"
            color2="rgba(229, 229, 230, 0.35)"
            color3="rgba(95, 96, 100, 0.25)"
            blurAmount={80}
            speedMultiplier={0.8}
            overlayOpacity={0.08}
            colorDuration={14}
          />
        </div>
        <BackgroundLayer />
        <CursorProvider />
        <div className="relative z-10 flex flex-col min-h-dvh">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  )
}
