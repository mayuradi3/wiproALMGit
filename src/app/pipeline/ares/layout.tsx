export default function AresLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="relative z-10 min-h-dvh">
      {children}
    </div>
  )
}

export const dynamic = "force-static"
