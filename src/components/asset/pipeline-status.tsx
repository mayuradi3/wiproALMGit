"use client"

import { CheckCircle2, Circle, Loader2 } from "lucide-react"

export type PipelineStep = "model" | "textures" | "thumbnail" | "bgremoval" | "fittoscreen" | "normalize" | "complete"

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: "model", label: "Model loaded & processed" },
  { key: "textures", label: "Textures applied" },
  { key: "thumbnail", label: "Thumbnail captured (256x256)" },
  { key: "bgremoval", label: "Background removed" },
  { key: "fittoscreen", label: "Fit to screen" },
  { key: "normalize", label: "Normalize scale (1, 1, 1)" },
  { key: "complete", label: "Pipeline complete" },
]

type PipelineStatusProps = {
  current: PipelineStep | null
}

export function PipelineStatus({ current }: PipelineStatusProps) {
  const idx = current ? STEPS.findIndex((s) => s.key === current) : -1

  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 flex flex-col gap-3 animate-in fade-in duration-300">
      <h3 className="text-sm font-medium text-foreground">Pipeline Status</h3>
      <div className="flex flex-col gap-2">
        {STEPS.map((step, i) => {
          const done = current !== null && i <= idx
          const active = current !== null && i === idx

          return (
            <div
              key={step.key}
              className={`flex items-center gap-2.5 text-xs transition-all duration-300 ${
                done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground/50"
              }`}
            >
              {done && i < idx ? (
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              ) : active && i < STEPS.length - 1 ? (
                <Loader2 className="size-3.5 text-emerald-500 shrink-0 animate-spin" />
              ) : current === "complete" && i === idx ? (
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="size-3.5 shrink-0" />
              )}
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
