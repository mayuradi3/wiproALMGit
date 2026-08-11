import { Package, Download, Play, Loader2, AlertCircle } from "lucide-react"

type ExportBarProps = {
  hasModel: boolean
  hasTextures: boolean
  hasThumbnail: boolean
  hasZip: boolean
  modelError: string | null
  onExport: () => void
  onPlay: () => void
  running: boolean
  assetName: string
}

export function ExportBar({
  hasModel,
  hasTextures,
  hasThumbnail,
  hasZip,
  modelError,
  onExport,
  onPlay,
  running,
  assetName,
}: ExportBarProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-t border-border/40 bg-black">   
      <Package className="size-4 text-muted-foreground" />
      <div className="flex-1 flex items-center gap-4">
        <span className="text-xs text-muted-foreground">{assetName}</span>
        <div className="flex items-center gap-2">
          <StatusDot active={hasModel} label="Model" />
          <StatusDot active={hasTextures} label="Textures" />
          <StatusDot active={hasThumbnail} label="Thumbnail" />
          <StatusDot active={hasZip} label="ZIP" />
        </div>
        {modelError && (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="size-3" />
            <span className="truncate max-w-[200px]">{modelError}</span>
          </div>
        )}
      </div>
      <button
        onClick={onPlay}
        disabled={running || !hasModel || !hasTextures}
        className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 text-white hover:bg-emerald-500"
      >
        {running ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3.5 ml-px" />
        )}
        {running ? "Processing..." : "Run"}
      </button>
      <button
        onClick={onExport}
        disabled={!hasZip}
        className="flex items-center gap-2 h-8 px-4 rounded-full text-[13px] font-medium transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-foreground text-background hover:bg-foreground/80"
      >
        <Download className="size-3.5" />
        Export ZIP
      </button>
    </div>
  )
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`size-1.5 rounded-full transition-colors duration-300 ${
          active ? "bg-emerald-500" : "bg-muted-foreground/30"
        }`}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
