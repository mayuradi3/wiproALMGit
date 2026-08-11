"use client"

import { useRef } from "react"
import { Upload, X } from "lucide-react"

type TextureSlotProps = {
  label: string
  hint?: string
  file: File | null
  onFile: (file: File) => void
  onClear: () => void
}

export function TextureSlot({ label, hint, file, onFile, onClear }: TextureSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    onFile(f)
  }

  return (
    <div className="rounded-lg bg-card border border-border/40 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>

      {file ? (
        <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
          <span className="text-[11px] text-foreground truncate flex-1">{file.name}</span>
          <button
            onClick={onClear}
            className="size-3.5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <X className="size-2" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 border border-dashed border-muted-foreground/20 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-all duration-300 group"
        >
          <Upload className="size-3 transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span>Upload</span>
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={handleChange} className="hidden" />
    </div>
  )
}
