"use client"

import { useRef, useState } from "react"
import { Upload, X, Image } from "lucide-react"

type TextureUploadCardProps = {
  label: string
  sublabel?: string
  files: File[]
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
}

export function TextureUploadCard({
  label,
  sublabel,
  files,
  onAdd,
  onRemove,
}: TextureUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(e.target.files || [])
    if (added.length === 0) return
    onAdd(added)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">{label}</h3>
          {sublabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
          )}
        </div>
        <Image className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="relative size-12 rounded-lg overflow-hidden border border-border/40 group"
            >
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 size-4 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 border border-dashed border-muted-foreground/20 rounded-lg px-3 py-3 text-xs text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-all duration-300 group"
      >
        <Upload className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
        <span>Click to upload textures</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
