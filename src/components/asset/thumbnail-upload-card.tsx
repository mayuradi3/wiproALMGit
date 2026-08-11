"use client"

import { useRef } from "react"
import { Upload, X, Image } from "lucide-react"

type ThumbnailUploadCardProps = {
  label: string
  sublabel?: string
  file: File | null
  onThumbnail: (file: File) => void
  onClear: () => void
}

export function ThumbnailUploadCard({
  label,
  sublabel,
  file,
  onThumbnail,
  onClear,
}: ThumbnailUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    onThumbnail(f)
  }

  const previewUrl = file ? URL.createObjectURL(file) : null

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

      {file ? (
        <div className="relative rounded-lg overflow-hidden border border-border/40 group">
          <img
            src={previewUrl || ""}
            alt="Thumbnail"
            className="w-full h-24 object-cover"
          />
          <button
            onClick={() => {
              onClear()
              if (inputRef.current) inputRef.current.value = ""
            }}
            className="absolute top-1.5 right-1.5 size-5 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 border border-dashed border-muted-foreground/20 rounded-lg px-3 py-3 text-xs text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-all duration-300 group"
        >
          <Upload className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span>Click to upload thumbnail</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
