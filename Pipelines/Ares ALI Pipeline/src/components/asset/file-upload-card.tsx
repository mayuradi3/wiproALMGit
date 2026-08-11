"use client"

import { useRef } from "react"
import { Upload, X, FileBox } from "lucide-react"

type FileUploadCardProps = {
  label: string
  sublabel?: string
  fileName: string | null
  onFile: (file: File) => void
  onClear: () => void
  accept: string
}

export function FileUploadCard({
  label,
  sublabel,
  fileName,
  onFile,
  onClear,
  accept,
}: FileUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onFile(file)
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
        <FileBox className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {fileName ? (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <FileBox className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{fileName}</span>
          <button
            onClick={() => {
              onClear()
              if (inputRef.current) inputRef.current.value = ""
            }}
            className="size-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 border border-dashed border-muted-foreground/20 rounded-lg px-3 py-3 text-xs text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-all duration-300 group"
        >
          <Upload className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span>Click to upload</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
