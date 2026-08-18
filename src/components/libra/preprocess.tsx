"use client"

import { useMemo, useState } from "react"
import {
  List,
  Scissors,
  Boxes,
  Gauge,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Inbox,
  Save,
  SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SortingRule as RegistryRule } from "@/lib/workflow-registry"
import { SortingRulesCard, newRule } from "@/components/sorting-rules-card"

export type ListedFile = {
  id: string
  path: string
  name: string
  size: number
}

export type LogType = "success" | "info" | "error"

const TEXTURE_SUFFIXES = ["BaseColor", "Emissive", "Normal", "ORM"] as const
type TextureKey = (typeof TEXTURE_SUFFIXES)[number]

export type AssetStatus = "valid" | "semi" | "invalid"

export type Asset = {
  id: string
  base: string
  usd: ListedFile
  textures: Partial<Record<TextureKey, ListedFile>>
  totalSize: number
  status: AssetStatus
}

export const SUMMARY: {
  status: AssetStatus
  label: string
  border: string
}[] = [
  {
    status: "valid",
    label: "Valid",
    border: "border-2 border-emerald-400/80 hover:border-emerald-400",
  },
  {
    status: "semi",
    label: "Semi Valid",
    border: "border-2 border-amber-400/80 hover:border-amber-400",
  },
  {
    status: "invalid",
    label: "Invalid",
    border: "border-2 border-red-500/80 hover:border-red-500",
  },
]

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

export function buildBatches(passable: Asset[], size: number) {
  const out: Asset[][] = []
  for (let i = 0; i < passable.length; i += size) out.push(passable.slice(i, i + size))
  return out
}

export function usePreprocessData(files: ListedFile[]) {
  const usdFiles = useMemo(
    () => files.filter((f) => /\.(usd|usda|usdc|usdz)$/i.test(f.name)),
    [files]
  )
  const pngFiles = useMemo(
    () => files.filter((f) => f.name.toLowerCase().endsWith(".png")),
    [files]
  )

  const pngByName = useMemo(() => {
    const m = new Map<string, ListedFile>()
    for (const f of pngFiles) m.set(f.name.toLowerCase(), f)
    return m
  }, [pngFiles])

  const assets = useMemo<Asset[]>(() => {
    return usdFiles.map((usd) => {
      const base = usd.name.replace(/\.(usd|usda|usdc|usdz)$/i, "")
      const textures: Partial<Record<TextureKey, ListedFile>> = {}
      for (const key of TEXTURE_SUFFIXES) {
        const t = pngByName.get(`${base.toLowerCase()}_${key.toLowerCase()}.png`)
        if (t) textures[key] = t
      }
      const present = Object.keys(textures).length
      const status: AssetStatus = present === 4 ? "valid" : present > 0 ? "semi" : "invalid"
      const totalSize = usd.size + Object.values(textures).reduce((sum, t) => sum + t.size, 0)
      return { id: usd.id, base, usd, textures, totalSize, status }
    })
  }, [usdFiles, pngByName])

  const counts = useMemo(
    () => ({
      valid: assets.filter((a) => a.status === "valid").length,
      semi: assets.filter((a) => a.status === "semi").length,
      invalid: assets.filter((a) => a.status === "invalid").length,
    }),
    [assets]
  )

  const passable = useMemo(
    () =>
      assets
        .filter((a) => a.status !== "invalid")
        .sort((a, b) => a.totalSize - b.totalSize),
    [assets]
  )

  return { usdFiles, pngFiles, assets, counts, passable }
}

function ModalShell({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  icon: typeof List
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          {subtitle && <span className="truncate text-[11px] text-muted-foreground">· {subtitle}</span>}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

function SplitList({
  title,
  count,
  items,
  className,
}: {
  title: string
  count: number
  items: ListedFile[]
  className: string
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted p-3">
      <p className={cn("mb-2 text-[10px] font-medium uppercase tracking-wider", className)}>
        {title} · {count}
      </p>
      <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60">None</p>
        ) : (
          items.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-foreground/70"
            >
              <span className="min-w-0 flex-1 truncate">{f.path}</span>
              <span className="shrink-0 text-muted-foreground/60">{formatBytes(f.size)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AssetRow({ asset }: { asset: Asset }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{asset.base}</p>
        <p className="truncate text-[10px] text-muted-foreground">{asset.usd.path}</p>
      </div>
      <div className="hidden gap-1.5 sm:flex">
        {TEXTURE_SUFFIXES.map((key) => (
          <span
            key={key}
            title={key}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px]",
              asset.textures[key]
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                : "border border-border bg-muted text-muted-foreground/60"
            )}
          >
            {key}
          </span>
        ))}
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(asset.totalSize)}</span>
    </div>
  )
}

export function AssetResultsModal({
  filter,
  assets,
  onClose,
}: {
  filter: "all" | AssetStatus
  assets: Asset[]
  onClose: () => void
}) {
  const groups = SUMMARY.filter((s) => filter === "all" || s.status === filter)
  const count = filter === "all" ? assets.length : assets.filter((a) => a.status === filter).length
  const label = filter === "all" ? "Asset Review" : `${SUMMARY.find((s) => s.status === filter)?.label} assets`
  return (
    <ModalShell title={label} subtitle={`${count} assets`} icon={Boxes} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const groupAssets = assets.filter((a) => a.status === g.status)
          return (
            <div key={g.status}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-medium text-foreground/80">{g.label}</span>
            <span className="text-[11px] text-muted-foreground">({groupAssets.length})</span>
          </div>
          {groupAssets.length === 0 ? (
            <p className="px-1 text-[11px] text-muted-foreground/60">None</p>
          ) : (
                <div className="space-y-1.5">
                  {groupAssets.map((a) => (
                    <AssetRow key={a.id} asset={a} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ModalShell>
  )
}

function BatchingBody({
  passable,
  savedSize,
  onSave,
}: {
  passable: Asset[]
  savedSize: string
  onSave: (size: string) => void
}) {
  const [draft, setDraft] = useState(savedSize)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const raw = parseInt(savedSize, 10)
  const size = Number.isFinite(raw) && raw > 0 ? raw : 0
  const batches = useMemo(() => buildBatches(passable, size), [passable, size])
  const totalSize = passable.reduce((sum, a) => sum + a.totalSize, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="batch-size" className="text-[11px] text-muted-foreground">
          Batching size
        </label>
        <input
          id="batch-size"
          type="number"
          min={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-secondary hover:text-foreground"
        >
          <Save className="size-3" />
          Save
        </button>
        <span className="text-[11px] text-muted-foreground">
          {passable.length} assets · {size > 0 ? `${batches.length} batches` : "—"} ·{" "}
          {formatBytes(totalSize)} total
        </span>
      </div>
      {size > 0 && batches.length > 0 && (
        <div className="space-y-1">
          {batches.map((batch, i) => {
            const open = !!expanded[i]
            const total = batch.reduce((s, a) => s + a.totalSize, 0)
            return (
              <div key={i} className="rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [i]: !open }))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  {open ? (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-[11px] font-medium text-foreground">Batch #{i + 1}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {batch.length} assets · {formatBytes(total)}
                  </span>
                </button>
                {open && (
                  <div className="flex flex-wrap gap-1 px-3 pb-2">
                    {batch.map((a) => (
                      <span
                        key={a.id}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {a.base}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SubCardModal({
  kind,
  files,
  usdFiles,
  pngFiles,
  passable,
  batchSize,
  onSaveBatchSize,
  onClose,
  workflowId,
  savedRules,
  onSaveRules,
}: {
  kind: "list" | "filesort" | "batching" | "rules"
  files: ListedFile[]
  usdFiles: ListedFile[]
  pngFiles: ListedFile[]
  passable: Asset[]
  batchSize: string
  onSaveBatchSize: (size: string) => void
  onClose: () => void
  workflowId?: string
  savedRules?: { listed: RegistryRule[]; unlisted?: RegistryRule }
  onSaveRules?: (listed: RegistryRule[], unlisted?: RegistryRule) => void
}) {
  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files])
  const grouped = useMemo(() => {
    const m = new Map<string, ListedFile[]>()
    for (const f of files) {
      const dir = f.path.split("/").slice(0, -1).join("/") || "/"
      const arr = m.get(dir) ?? []
      arr.push(f)
      m.set(dir, arr)
    }
    return [...m.entries()]
  }, [files])

  if (kind === "list") {
    return (
      <ModalShell
        title="List Files"
        subtitle={`${files.length} files · ${formatBytes(totalSize)}`}
        icon={List}
        onClose={onClose}
      >
      {files.length === 0 ? (
        <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <Inbox className="size-4" />
          <span>No files yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map(([dir, list]) => (
            <div key={dir}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {dir}
              </p>
              <div className="space-y-0.5">
                {list.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[11px] text-foreground/80 hover:bg-muted"
                  >
                    <FileText className="size-3 shrink-0 text-muted-foreground/50" />
                    <span className="min-w-0 flex-1 truncate">{f.path}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </ModalShell>
    )
  }

  if (kind === "filesort") {
    return (
      <ModalShell
        title="Filesort Splitting"
        subtitle={`${usdFiles.length} USD · ${pngFiles.length} PNG`}
        icon={Scissors}
        onClose={onClose}
      >
        <div className="grid grid-cols-2 gap-3">
          <SplitList
            title="USD"
            count={usdFiles.length}
            items={usdFiles}
            className="text-amber-600"
          />
          <SplitList title="PNG" count={pngFiles.length} items={pngFiles} className="text-sky-600" />
        </div>
      </ModalShell>
    )
  }

  if (kind === "rules") {
    return (
      <RulesModal
        workflowId={workflowId ?? ""}
        initial={savedRules}
        onSave={onSaveRules}
        onClose={onClose}
      />
    )
  }

  return (
    <ModalShell
      title="Batching"
      subtitle={`${passable.length} passable assets`}
      icon={Gauge}
      onClose={onClose}
    >
      <BatchingBody passable={passable} savedSize={batchSize} onSave={onSaveBatchSize} />
    </ModalShell>
  )
}

function RulesModal({
  workflowId,
  initial,
  onSave,
  onClose,
}: {
  workflowId: string
  initial?: { listed: RegistryRule[]; unlisted?: RegistryRule }
  onSave?: (listed: RegistryRule[], unlisted?: RegistryRule) => void
  onClose: () => void
}) {
  const [listed, setListed] = useState<RegistryRule[]>(() =>
    initial?.listed?.length ? initial.listed : [newRule()]
  )
  const [unlisted, setUnlisted] = useState<RegistryRule>(() =>
    initial?.unlisted ? initial.unlisted : newRule()
  )
  const [saving, setSaving] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <List className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">Sorting Rules</span>
          <span className="truncate text-[11px] text-muted-foreground">
            · {workflowId ? "editing" : "not saved"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <SortingRulesCard
            listed={listed}
            unlisted={unlisted}
            onListedChange={setListed}
            onUnlistedChange={setUnlisted}
          />
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] text-muted-foreground">
              Changes are saved to this workflow only
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSaving(true)
                const listedToSave = listed.filter(
                  (r) =>
                    r.directory.trim() !== "" &&
                    r.conditions.some((c) => c.value.trim() !== "")
                )
                const unlistedToSave =
                  unlisted.directory.trim() !== "" ? unlisted : undefined
                onSave?.(listedToSave, unlistedToSave)
                setTimeout(() => {
                  setSaving(false)
                  onClose()
                }, 300)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-secondary disabled:opacity-60"
            >
              <Save className="size-3" />
              {saving ? "Saving…" : "Save Rules"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
