"use client"

import { Layers } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="flex items-center gap-2.5 px-6 py-4 border-b border-border/40">
        <Layers className="size-5 text-foreground" />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Libra Pipeline
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Bulk processing pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Drop files or choose a folder to run bulk workflows.
        </p>
      </main>
    </div>
  )
}
