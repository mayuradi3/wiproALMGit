"use client"

import { useState, useRef, useEffect, useMemo, Suspense, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  Folder,
  ScanLine,
  CalendarClock,
  Cpu,
  FileCode,
  Package,
  ScrollText,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Download,
  FolderUp,
  File as FileIcon,
  Loader2,
  Archive,
  SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import JSZip from "jszip"
import { ThreeViewer, type Textures, type ThreeViewerHandle } from "@/components/asset/three-viewer"
import { cropTo256x256, fitToScreen } from "@/lib/image-utils"
import { normalizeUsdScale, isUsdaFile } from "@/lib/usd-normalize"
import { getWorkflow, updateWorkflowRules } from "@/app/actions"
import {
  SubCardModal,
  AssetResultsModal,
  usePreprocessData,
  SUMMARY,
  buildBatches,
  formatBytes,
  type ListedFile,
  type Asset,
} from "@/components/libra/preprocess"
import type { SortingRule } from "@/lib/workflow-registry"

type LogEntry = {
  id: string
  message: string
  type: "success" | "info" | "error"
  timestamp: string
}

type StageStatus = "idle" | "running" | "done" | "error"

const PREPROCESS_FUNCS = ["List Files", "Filesort Splitting", "Asset Creation", "Batching"]
const PREPROCESS_MS = 300
const INIT_MS = 120
const RENDER_SETTLE_MS = 120
const THUMB_MS = 120
const BUNDLE_MS = 120
const EXTRACT_MS = 120
const DIR_STEP_MS = 80
const ZIP_BUILD_MS = 200

const springTransition = { type: "spring", stiffness: 400, damping: 25 } as const
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springTransition },
}
const fadePulseVariants = {
  initial: { opacity: 0.55, scale: 1 },
  animate: { opacity: [0.55, 0.85, 0.55], scale: [1, 1.01, 1], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const } },
}

function EmptyQueues() {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.35 }}
      transition={{ duration: 0.5 }}
      className="p-1 text-[9px] text-muted-foreground/50"
    >
      Empty
    </motion.p>
  )
}

function BatchRow({
  index,
  batch,
  done,
}: {
  index: number
  batch: Asset[]
  done?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={springTransition}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1",
        done ? "bg-emerald-500/10" : "bg-white"
      )}
    >
      <span className="shrink-0 text-[9px] text-muted-foreground/60">#{index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground/90">
        {batch.length} assets
      </span>
      <span className="shrink-0 text-[9px] text-muted-foreground/60">
        {formatBytes(batch.reduce((s, a) => s + a.totalSize, 0))}
      </span>
    </motion.div>
  )
}

function QueueSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{title}</span>
        <span className="text-[9px] text-muted-foreground/60">{count}</span>
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5"
      >
        {children}
      </motion.div>
    </div>
  )
}

const STAGES = [
  { id: "preprocess", label: "Preprocess", icon: ScanLine, desc: "Normalize and prepare input assets" },
  { id: "scheduling", label: "Scheduling", icon: CalendarClock, desc: "Queue and order processing jobs" },
  { id: "execution", label: "Execution", icon: Cpu, desc: "Run each asset through Ares and build thumbnails" },
  { id: "compile", label: "Compile", icon: FileCode, desc: "Bundle and extract outputs" },
  { id: "export", label: "Export", icon: Package, desc: "Move outputs and generate archives" },
]

const TEXTURE_KEYS = ["BaseColor", "Emissive", "Normal", "ORM"] as const

type BatchGroup = {
  name: string
  assets: Asset[]
}

type DirEntry = {
  id: string
  kind: "usd" | "texture" | "thumbnail"
  name: string
  fileId: string
  relPath: string[]
  groupName: string
  blob?: Blob
}

type TreeNode = {
  name: string
  type: "folder" | "file"
  children: Record<string, TreeNode>
}

function matchesCondition(name: string, condition: { regexType: string; value: string }): boolean {
  const base = name.toLowerCase()
  const value = condition.value.trim().toLowerCase()
  switch (condition.regexType) {
    case "contains":
      return base.includes(value)
    case "starts with":
      return base.startsWith(value)
    case "ends with":
      return base.endsWith(value)
    case "equals":
      return base === value
    case "regex":
      try {
        return new RegExp(condition.value).test(name)
      } catch {
        return false
      }
    default:
      return false
  }
}

function matchesRule(name: string, rule: SortingRule): boolean {
  return rule.conditions.some((c) => matchesCondition(name, c))
}

function buildSortedGroups(assets: Asset[], listed: SortingRule[], unlisted?: SortingRule): BatchGroup[] {
  const groups: BatchGroup[] = listed.map((r) => ({ name: r.directory.trim(), assets: [] }))
  const fallback: BatchGroup = { name: unlisted?.directory.trim() || "misc", assets: [] }
  for (const asset of assets) {
    const idx = listed.findIndex((r) => matchesRule(asset.base, r))
    if (idx >= 0) {
      groups[idx].assets.push(asset)
    } else {
      fallback.assets.push(asset)
    }
  }
  const out = groups.filter((g) => g.assets.length > 0)
  if (fallback.assets.length > 0) out.push(fallback)
  return out
}

function buildExtractedEntries(asset: Asset, groupName: string, thumbBlob?: Blob): DirEntry[] {
  const entries: DirEntry[] = [
    { id: makeId(), kind: "usd", name: asset.usd.name, fileId: asset.usd.id, relPath: [], groupName },
  ]
  for (const key of TEXTURE_KEYS) {
    const t = asset.textures[key]
    if (t) {
      entries.push({
        id: makeId(),
        kind: "texture",
        name: t.name,
        fileId: t.id,
        relPath: ["Textures"],
        groupName,
      })
    }
  }
  entries.push({
    id: makeId(),
    kind: "thumbnail",
    name: `${asset.usd.name}.png`,
    fileId: "",
    relPath: [".thumbs", "256x256"],
    groupName,
    blob: thumbBlob,
  })
  return entries
}

function DirTree({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Object.values(node.children).map((child) => (
        <div key={child.name}>
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: depth * 10 }}
          >
            {child.type === "folder" ? (
              <Folder className="size-2.5 shrink-0 text-amber-500/80" />
            ) : (
              <FileIcon className="size-2.5 shrink-0 text-muted-foreground/60" />
            )}
            <span
              className={cn(
                "truncate",
                child.type === "folder" ? "text-muted-foreground/70" : "text-muted-foreground/80"
              )}
            >
              {child.name}
            </span>
          </div>
          {child.type === "folder" && <DirTree node={child} depth={depth + 1} />}
        </div>
      ))}
    </div>
  )
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type StageCardProps = {
  index: number
  status: StageStatus
  icon: typeof ScanLine
  label: string
  desc: string
  className?: string
  onClick?: () => void
  body?: React.ReactNode
}

function StageCard({ index, status, icon: Icon, label, desc, className, onClick, body }: StageCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 12px 40px -12px rgba(33,31,84,0.10)" }}
      whileTap={{ scale: 0.985 }}
      transition={springTransition}
      className={cn(
        "group flex flex-col gap-2.5 overflow-hidden rounded-2xl border bg-white p-3.5 backdrop-blur-xl transition-all duration-200 hover:border-border hover:bg-muted",
        onClick && "data-cursor-hover",
          status === "running"
            ? "border-emerald-500/40 bg-emerald-500/5"
            : status === "done"
              ? "border-emerald-500/30"
              : "border-border",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-muted-foreground/90 transition-colors duration-300 group-hover:text-foreground" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{label}</p>
          <p className="text-[10px] text-muted-foreground/70">Stage {index + 1} of 5</p>
        </div>
        <span
          className={cn(
            "ml-auto size-2 shrink-0 rounded-full transition-colors duration-300",
              status === "running"
                ? "bg-emerald-500"
                : status === "done"
                  ? "bg-emerald-500"
                  : status === "error"
                    ? "bg-red-500"
                    : "bg-muted-foreground/50"
          )}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/70">{desc}</p>
      {body ?? (
        <div className="flex min-h-[100px] flex-1 items-center justify-center rounded-xl bg-muted" />
      )}
    </motion.div>
  )
}

function LibraPipeline() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workflowId = searchParams.get("id") ?? ""
  const [assetName, setAssetName] = useState("Libra")
  const [workflow, setWorkflow] = useState<
    { id: string; name: string; sorting?: "Sorted" | "Unsorted"; listed?: SortingRule[]; unlisted?: SortingRule } | null
  >(null)

  useEffect(() => {
    if (!workflowId) return
    getWorkflow(workflowId).then((w) => {
      if (!w) return
      setWorkflow({
        id: w.id,
        name: w.name,
        sorting: w.sorting,
        listed: w.listed,
        unlisted: w.unlisted,
      })
      setAssetName(w.name)
    })
  }, [workflowId])

  const isSorted = workflow?.sorting === "Sorted"


  const [logs, setLogs] = useState<LogEntry[]>([])
  const [statuses, setStatuses] = useState<Record<string, StageStatus>>({})
  const [fnStatuses, setFnStatuses] = useState<Record<string, StageStatus>>({})
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [files, setFiles] = useState<ListedFile[]>([])
  const [subCard, setSubCard] = useState<"list" | "filesort" | "batching" | "rules" | null>(null)
  const [rulesDirty, setRulesDirty] = useState(false)
  const [resultsFilter, setResultsFilter] = useState<"all" | Asset["status"] | null>(null)
  const { usdFiles, pngFiles, assets, counts, passable } = usePreprocessData(files)
  const [batchSize, setBatchSize] = useState("100")
  const sortedGroups = useMemo(() => {
    if (!isSorted || !workflow?.listed) return []
    return buildSortedGroups(passable, workflow.listed, workflow.unlisted)
  }, [passable, workflow, isSorted])
  const batches = useMemo(() => {
    if (isSorted) {
      return sortedGroups.map((g) => g.assets)
    }
    const raw = parseInt(batchSize, 10)
    const size = Number.isFinite(raw) && raw > 0 ? raw : 0
    return size > 0 ? buildBatches(passable, size) : []
  }, [passable, batchSize, sortedGroups, isSorted])
  const [queues, setQueues] = useState<{
    ready: Asset[][]
    running: Asset[]
    finished: Asset[][]
    runningAssetId: string | null
  } | null>(null)
  const readyQueue = queues?.ready ?? batches
  const runningQueue = queues?.running ?? []
  const finishedQueue = queues?.finished ?? []
  const runningAssetId = queues?.runningAssetId ?? null
  const [currentStep, setCurrentStep] = useState<
    "initializer" | "ares" | "thumbnail" | "normalize" | "bundler" | "extractor" | null
  >(null)
  const [normalizedAssets, setNormalizedAssets] = useState<string[]>([])
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(null)
  const [bundledAssets, setBundledAssets] = useState<string[]>([])
  const [extracted, setExtracted] = useState<DirEntry[]>([])
  const [moved, setMoved] = useState<DirEntry[]>([])
  const [zipping, setZipping] = useState(false)
  const [zip, setZip] = useState<{ url: string; name: string } | null>(null)
  const [currentThumb, setCurrentThumb] = useState<{ base: string } | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [directorReady, setDirectorReady] = useState(false)
  const currentAsset = assets.find((a) => a.id === currentAssetId)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const pausedRef = useRef(false)
  const gateRef = useRef<() => void>(() => {})
  const runIdRef = useRef(0)
  const fileMapRef = useRef<Record<string, File>>({})
  const thumbUrlRef = useRef<string | null>(null)
  const zipRef = useRef<string | null>(null)
  const viewerRef = useRef<ThreeViewerHandle>(null)
  const modelReadyRef = useRef(false)
  const modelErrorRef = useRef<string | null>(null)
  const texturesReadyRef = useRef(false)
  const thumbBlobRef = useRef<Blob | null>(null)
  const modelUrlRef = useRef<string | null>(null)
  const texUrlRefs = useRef<string[]>([])
  const [viewerModel, setViewerModel] = useState<{ url: string; name: string } | null>(null)
  const [viewerTextures, setViewerTextures] = useState<Textures>({})

  useEffect(() => {
    return () => {
      if (thumbUrlRef.current) URL.revokeObjectURL(thumbUrlRef.current)
      if (zipRef.current) URL.revokeObjectURL(zipRef.current)
    }
  }, [])

  const moveTree = useMemo(() => {
    const root: TreeNode = { name: "", type: "folder", children: {} }
    for (const e of moved) {
      let node = root
      const path = [e.groupName, ...e.relPath]
      for (const dir of path) {
        if (!node.children[dir]) {
          node.children[dir] = { name: dir, type: "folder", children: {} }
        }
        node = node.children[dir]
      }
      if (!node.children[e.name]) {
        node.children[e.name] = { name: e.name, type: "file", children: {} }
      }
    }
    return root
  }, [moved])

  function addLog(msg: string, t: LogEntry["type"] = "info") {
    setLogs((p) => [
      ...p,
      { id: makeId(), message: msg, type: t, timestamp: new Date().toLocaleTimeString() },
    ])
  }

  function handleSaveBatchSize(size: string) {
    setBatchSize(size)
    addLog(`Batching: size saved to ${size}`, "success")
  }

  async function handleSaveRules(listed: SortingRule[], unlisted?: SortingRule) {
    if (!workflowId) {
      addLog("Rules: no workflow ID, cannot save", "error")
      return
    }
    const ok = await updateWorkflowRules(workflowId, listed, unlisted)
    if (ok) {
      setWorkflow((prev) => (prev ? { ...prev, listed, unlisted, sorting: "Sorted" } : prev))
      setRulesDirty(false)
      addLog("Rules: sorting rules saved", "success")
    } else {
      addLog("Rules: failed to save sorting rules", "error")
    }
  }

  function waitIfPaused() {
    if (!pausedRef.current) return Promise.resolve()
    return new Promise<void>((resolve) => {
      gateRef.current = resolve
    })
  }

  function waitForReady(
    ref: React.MutableRefObject<boolean>,
    errorRef: React.MutableRefObject<string | null>,
    label: string,
    timeoutMs = 60000
  ): Promise<boolean> {
    if (ref.current) return Promise.resolve(true)
    if (errorRef.current) {
      addLog(`${label} failed: ${errorRef.current}`, "error")
      return Promise.resolve(false)
    }
    return new Promise<boolean>((resolve) => {
      const start = Date.now()
      const iv = setInterval(() => {
        if (ref.current) {
          clearInterval(iv)
          resolve(true)
        } else if (errorRef.current) {
          clearInterval(iv)
          addLog(`${label} failed: ${errorRef.current}`, "error")
          resolve(false)
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv)
          addLog(`${label} timed out after ${timeoutMs / 1000}s`, "error")
          resolve(false)
        }
      }, 50)
    })
  }

  function loadAssetIntoViewer(asset: Asset) {
    if (modelUrlRef.current) {
      URL.revokeObjectURL(modelUrlRef.current)
      modelUrlRef.current = null
    }
    for (const u of texUrlRefs.current) URL.revokeObjectURL(u)
    texUrlRefs.current = []

    const modelFile = fileMapRef.current[asset.usd.id]
    if (!modelFile) return

    const mUrl = URL.createObjectURL(modelFile)
    modelUrlRef.current = mUrl

    const tex: Textures = {}
    const urlList: string[] = []
    for (const key of TEXTURE_KEYS) {
      const t = asset.textures[key]
      if (!t) continue
      const file = fileMapRef.current[t.id]
      if (!file) continue
      const u = URL.createObjectURL(file)
      urlList.push(u)
      if (key === "BaseColor") tex.baseColor = u
      else if (key === "Emissive") tex.emissive = u
      else if (key === "Normal") tex.normal = u
      else tex.orm = u
    }
    texUrlRefs.current = urlList

    modelReadyRef.current = false
    modelErrorRef.current = null
    texturesReadyRef.current = false
    setViewerModel({ url: mUrl, name: asset.usd.name })
    setViewerTextures(tex)
  }

  async function runPipeline() {
    const runId = ++runIdRef.current
    pausedRef.current = false
    setPaused(false)
    setRunning(true)
    setLogs([])
    setStatuses({})
    setFnStatuses({})
    setQueues({ ready: batches.map((b) => [...b]), running: [], finished: [], runningAssetId: null })
    setCurrentAssetId(null)
    setCurrentStep(null)
    setBundledAssets([])
    setNormalizedAssets([])
    setExtracted([])
    setMoved([])
    setZipping(false)
    setCurrentThumb(null)
    if (thumbUrlRef.current) {
      URL.revokeObjectURL(thumbUrlRef.current)
      thumbUrlRef.current = null
    }
    setThumbUrl(null)
    thumbBlobRef.current = null
    if (modelUrlRef.current) {
      URL.revokeObjectURL(modelUrlRef.current)
      modelUrlRef.current = null
    }
    for (const u of texUrlRefs.current) URL.revokeObjectURL(u)
    texUrlRefs.current = []
    setViewerModel(null)
    setViewerTextures({})
    if (zipRef.current) {
      URL.revokeObjectURL(zipRef.current)
      zipRef.current = null
    }
    setZip(null)

    setStatuses((s) => ({ ...s, preprocess: "running" }))
    addLog("Preprocess: started", "info")
    for (const fn of PREPROCESS_FUNCS) {
      if (runIdRef.current !== runId ) return
      setFnStatuses((s) => ({ ...s, [fn]: "running" }))
      addLog(`${fn}: running`, "info")
      await sleep(PREPROCESS_MS)
      await waitIfPaused()
      if (runIdRef.current !== runId ) return
      setFnStatuses((s) => ({ ...s, [fn]: "done" }))
      addLog(`${fn}: complete`, "success")
    }
    if (runIdRef.current !== runId ) return
    setStatuses((s) => ({ ...s, preprocess: "done" }))
    addLog("Preprocess: complete", "success")

    setStatuses((s) => ({ ...s, scheduling: "running", execution: "running" }))
    addLog("Scheduling: started", "info")

    setDirectorReady(false)
    setStatuses((s) => ({ ...s, compile: "running" }))
    addLog("Director: creating directory structure", "info")
    const dirs = isSorted
      ? (() => {
          const out: string[] = []
          sortedGroups.forEach((g) => {
            out.push(`${g.name}/`)
            out.push(`${g.name}/.thumbs/`)
            out.push(`${g.name}/.thumbs/256x256/`)
          })
          return out
        })()
      : [
          `${assetName}/`,
          `${assetName}/.thumbs/`,
          `${assetName}/.thumbs/256x256/`,
        ]
    for (const dir of dirs) {
      if (runIdRef.current !== runId ) return
      const target = isSorted ? dir.replace(/\/$/, "") : assetName
      addLog(`Director: created ${target}/`, "info")
      await sleep(DIR_STEP_MS)
      await waitIfPaused()
    }
    if (runIdRef.current !== runId ) return
    setDirectorReady(true)
    addLog("Director: structure ready", "success")

    const ready = batches.map((b) => [...b])
    const finished: Asset[][] = []
    const movedLocal: DirEntry[] = []
    for (let b = 0; b < ready.length; b++) {
      if (runIdRef.current !== runId ) return
      const batch = ready[b]
      let batchExtracted: DirEntry[] = []
      setBundledAssets([])
      setExtracted([])
      setQueues((q) => (q ? { ...q, ready: ready.slice(b + 1), running: batch } : q))
      addLog(`Scheduling: batch ${b + 1} to running queue`, "info")
      for (const asset of batch) {
        if (runIdRef.current !== runId ) return

        setCurrentStep("initializer")
        setCurrentAssetId(asset.id)
        setQueues((q) => (q ? { ...q, runningAssetId: asset.id } : q))
        addLog(`Asset Initializer: ${asset.base} passed to Ares`, "info")
        await sleep(INIT_MS)
        await waitIfPaused()
        if (runIdRef.current !== runId ) return

        setCurrentStep("ares")
        addLog(`Ares: rendering ${asset.base} from 3D view`, "info")
        loadAssetIntoViewer(asset)
        const modelOk = await waitForReady(modelReadyRef, modelErrorRef, "Model load", 20000)
        let texOk = false
        if (modelOk) {
          texOk = await waitForReady(texturesReadyRef, modelErrorRef, "Texture apply", 20000)
        }
        if (runIdRef.current !== runId ) return
        if (modelOk && texOk) {
          await sleep(RENDER_SETTLE_MS)
          await waitIfPaused()
          if (runIdRef.current !== runId ) return
          addLog(`Ares: ${asset.base} rendered at 4K`, "success")
        } else {
          addLog(
            `Ares: ${asset.base} 3D render skipped (${modelOk ? "textures" : "model"} failed), using texture fallback`,
            "error"
          )
        }

        setCurrentStep("thumbnail")
        const thumbName = `${asset.usd.name}.png`
        addLog(`Thumbnail Processor: capturing ${thumbName}`, "info")
        await sleep(THUMB_MS)
        await waitIfPaused()
        if (runIdRef.current !== runId ) return
        let rawScreenshot: Blob | null = null
        if (modelReadyRef.current && texturesReadyRef.current) {
          try {
            rawScreenshot = (await viewerRef.current?.captureScreenshot()) ?? null
          } catch (err: unknown) {
            addLog(
              `Thumbnail Processor: ${err instanceof Error ? err.message : String(err)}`,
              "error"
            )
          }
        } else {
          addLog(`Thumbnail Processor: 3D render unavailable, using BaseColor fallback`, "info")
        }
        if (!rawScreenshot && asset.textures.BaseColor) {
          const fallbackFile = fileMapRef.current[asset.textures.BaseColor.id]
          if (fallbackFile) {
            rawScreenshot = fallbackFile
            addLog(`Thumbnail Processor: falling back to BaseColor for ${thumbName}`, "info")
          }
        }
        if (runIdRef.current !== runId ) return

        let finalThumb: Blob | null = null
        if (rawScreenshot) {
          try {
            addLog(`Thumbnail Processor: removing background for ${thumbName}`, "info")
            const clean = await viewerRef.current?.captureCleanScreenshot()
            if (clean) {
              const clean256 = await cropTo256x256(clean)
              addLog(`Thumbnail Processor: background removed`, "success")
              addLog(`Thumbnail Processor: fitting ${thumbName} to screen (0.001 margin)`, "info")
              finalThumb = await fitToScreen(clean256, 0.001)
              addLog(`Thumbnail Processor: fit to screen complete`, "success")
            }
          } catch (err: unknown) {
            addLog(
              `Thumbnail Processor: clean render failed (${err instanceof Error ? err.message : String(err)}), using original`,
              "error"
            )
          }
          if (!finalThumb) {
            finalThumb = rawScreenshot instanceof File ? rawScreenshot : await cropTo256x256(rawScreenshot)
          }
          thumbBlobRef.current = finalThumb!
          setThumbUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            thumbUrlRef.current = URL.createObjectURL(finalThumb!)
            return thumbUrlRef.current
          })
          setCurrentThumb({ base: thumbName })
          addLog(`Thumbnail Processor: ${thumbName} generated`, "success")
        } else {
          addLog("Thumbnail Processor: screenshot failed", "error")
        }

        setCurrentStep("normalize")
        addLog(`Normalizer: ensuring ${asset.usd.name} has uniform scale/units`, "info")
        const usdFile = fileMapRef.current[asset.usd.id]
        if (usdFile && isUsdaFile(usdFile.name)) {
          try {
            const normalizedBlob = await normalizeUsdScale(usdFile)
            if (normalizedBlob !== usdFile) {
              const normalizedFile = new File([normalizedBlob], usdFile.name, { type: usdFile.type })
              Object.defineProperty(normalizedFile, "webkitRelativePath", {
                value: usdFile.webkitRelativePath,
                writable: false,
                configurable: false,
              })
              fileMapRef.current[asset.usd.id] = normalizedFile
              addLog(`Normalizer: ${asset.usd.name} scale/units set to (1, 1, 1)`, "success")
            } else {
              addLog(`Normalizer: ${asset.usd.name} already uniform or binary USD skipped`, "info")
            }
          } catch (err: unknown) {
            addLog(
              `Normalizer: failed for ${asset.usd.name} (${err instanceof Error ? err.message : String(err)})`,
              "error"
            )
          }
        } else {
          addLog(`Normalizer: ${asset.usd.name} is binary USD; scale normalization skipped`, "info")
        }
        setNormalizedAssets((p) => [...p, asset.base])
        await sleep(BUNDLE_MS)
        await waitIfPaused()
        if (runIdRef.current !== runId ) return

        setCurrentStep("bundler")
        addLog(`Bundler: bundling ${asset.base} (usd + textures + thumbnail)`, "info")
        await sleep(BUNDLE_MS)
        await waitIfPaused()
        if (runIdRef.current !== runId ) return
        setBundledAssets((p) => [...p, asset.base])
        addLog(`Bundler: ${asset.base} bundled`, "success")

        setCurrentStep("extractor")
        addLog(`Extractor: extracting ${asset.base}`, "info")
        await sleep(EXTRACT_MS)
        await waitIfPaused()
        if (runIdRef.current !== runId ) return
        const entries = buildExtractedEntries(asset, isSorted ? sortedGroups[b]?.name ?? assetName : assetName, thumbBlobRef.current ?? undefined)
        batchExtracted = batchExtracted.concat(entries)
        setExtracted([...batchExtracted])
        addLog(`Extractor: ${entries.length} file(s) extracted`, "success")
      }
      finished.push(batch)
      setCurrentAssetId(null)
      setCurrentStep(null)
      setQueues((q) => (q ? { ...q, runningAssetId: null, running: [], finished: [...finished] } : q))
      setBundledAssets([])
      setExtracted([])
      if (batchExtracted.length > 0) {
        movedLocal.push(...batchExtracted)
        setMoved([...movedLocal])
        const target = isSorted ? sortedGroups[b]?.name ?? assetName : assetName
        addLog(`Move: ${batchExtracted.length} file(s) placed in ${target}/`, "success")
      }
      setCurrentThumb(null)
      if (thumbUrlRef.current) {
        URL.revokeObjectURL(thumbUrlRef.current)
        thumbUrlRef.current = null
      }
      setThumbUrl(null)
      addLog(`Scheduling: batch ${b + 1} complete`, "success")
    }
    if (runIdRef.current !== runId ) return
    setStatuses((s) => ({
      ...s,
      scheduling: "done",
      execution: "done",
      compile: "done",
    }))
    addLog("Scheduling: complete", "success")
    addLog("Execution: complete", "success")
    addLog("Compile: complete", "success")

    setStatuses((s) => ({ ...s, export: "running" }))
    setZipping(true)
    addLog("Download: generating zip archive", "info")
    await sleep(ZIP_BUILD_MS)
    await waitIfPaused()
    if (runIdRef.current !== runId ) return
    const zip = new JSZip()
    for (const m of movedLocal) {
      const path = [m.groupName, ...m.relPath, m.name].join("/")
      if (m.blob) {
        zip.file(path, m.blob)
      } else {
        const file = fileMapRef.current[m.fileId]
        if (file) zip.file(path, file)
      }
    }
    const blob = await zip.generateAsync({ type: "blob" })
    if (runIdRef.current !== runId ) return
    const url = URL.createObjectURL(blob)
    zipRef.current = url
    setZip({ url, name: `${assetName}.zip` })
    setZipping(false)
    setStatuses((s) => ({ ...s, export: "done" }))
    addLog(`Download: ${assetName}.zip ready`, "success")

    addLog("Pipeline finished", "success")
    setRunning(false)
    setPaused(false)
  }

  function toggleRun() {
    if (running && paused) {
      pausedRef.current = false
      setPaused(false)
      gateRef.current()
    } else if (running) {
      pausedRef.current = true
      setPaused(true)
    } else if (batches.length === 0) {
      addLog("No processable assets found — upload a directory with .usd/.usda files and matching _BaseColor/_Emissive/_Normal/_ORM textures", "error")
    } else {
      runPipeline()
    }
  }

  function resetPipelineFiles() {
    setQueues(null)
    setCurrentAssetId(null)
    setCurrentStep(null)
    setBundledAssets([])
    setExtracted([])
    setMoved([])
    setZipping(false)
    setCurrentThumb(null)
    setDirectorReady(false)
    thumbBlobRef.current = null
    if (modelUrlRef.current) {
      URL.revokeObjectURL(modelUrlRef.current)
      modelUrlRef.current = null
    }
    for (const u of texUrlRefs.current) URL.revokeObjectURL(u)
    texUrlRefs.current = []
    setViewerModel(null)
    setViewerTextures({})
    if (thumbUrlRef.current) {
      URL.revokeObjectURL(thumbUrlRef.current)
      thumbUrlRef.current = null
    }
    setThumbUrl(null)
    if (zipRef.current) {
      URL.revokeObjectURL(zipRef.current)
      zipRef.current = null
    }
    setZip(null)
  }

  function loadFiles(fileList: File[] | FileList | null, rootName?: string) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const fm: Record<string, File> = {}
    const listed: ListedFile[] = files.map((f) => {
      const id = makeId()
      fm[id] = f
      return {
        id,
        path: f.webkitRelativePath || f.name,
        name: f.name,
        size: f.size,
      }
    })
    fileMapRef.current = fm
    setFiles(listed)
    resetPipelineFiles()
    const folderName = rootName || listed[0]?.path.split("/")[0] || "folder"
    addLog(`Directory selected: ${folderName}`, "success")
    addLog(`${listed.length} file(s) detected`, "info")
  }

  function handleDirectory(e: ChangeEvent<HTMLInputElement>) {
    loadFiles(e.target.files)
    e.target.value = ""
  }

  function downloadZip() {
    if (!zip) return
    const a = document.createElement("a")
    a.href = zip.url
    a.download = zip.name
    a.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="relative z-10 flex flex-col h-dvh overflow-hidden bg-background"
    >
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 shrink-0 bg-background">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <motion.button
            type="button"
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={springTransition}
            className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          >
            <ArrowLeft className="size-3.5" />
          </motion.button>
          <Folder className="size-3.5 text-foreground shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">{assetName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            onClick={toggleRun}
            aria-label={running && !paused ? "Pause workflow" : "Run workflow"}
            title={running && !paused ? "Pause" : "Run"}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            transition={springTransition}
            className="flex items-center justify-center p-1 text-foreground transition-transform duration-200 hover:text-foreground"
          >
            {running && !paused ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 ml-px" />
            )}
          </motion.button>
          <motion.button
            type="button"
            onClick={downloadZip}
            aria-label="Download final archive"
            title={zip ? "Download final archive" : "Available after the pipeline completes"}
            disabled={zip === null}
            whileHover={zip ? { scale: 1.2 } : undefined}
            whileTap={zip ? { scale: 0.85 } : undefined}
            transition={springTransition}
            className={cn(
              "flex items-center justify-center p-1 transition-all duration-200",
              zip
                ? "text-foreground hover:text-foreground"
                : "text-muted-foreground/40"
            )}
          >
            <Download className="size-4" />
          </motion.button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="flex flex-1 min-h-0 items-start gap-4 overflow-hidden px-4 py-4"
          >
          {STAGES.map((stage, i) => {
            const sizeCls = "h-full min-w-0 flex-1 basis-0 max-w-[260px]"
            if (i === 0) {
              return (
                <motion.div
                  key={stage.id}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex h-full min-w-0 flex-1 basis-0 max-w-[260px] flex-col gap-2.5"
                >
                  <motion.button
                    type="button"
                    onClick={() => dirInputRef.current?.click()}
                    whileHover={{ scale: 1.02, borderColor: "rgba(33,31,84,0.20)" }}
                    whileTap={{ scale: 0.97 }}
                    transition={springTransition}
                    className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white text-[11px] font-medium text-muted-foreground/90 transition-all duration-200 hover:bg-muted hover:text-foreground"
                  >
                    <FolderUp className="size-3.5" />
                    Upload Directory
                  </motion.button>
                  <input
                    ref={dirInputRef}
                    type="file"
                    className="sr-only"
                    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
                    onChange={handleDirectory}
                    // @ts-expect-error - webkitdirectory is not in React's HTML types
                    webkitdirectory=""
                  />
                  <StageCard
                    className="min-h-0 flex-1"
                    index={i}
                    status={statuses[stage.id] ?? "idle"}
                    icon={stage.icon}
                    label={stage.label}
                    desc={stage.desc}
                    body={
                      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl bg-muted p-2">
                        {isSorted && (
                          <motion.button
                            type="button"
                            onClick={() => setSubCard("rules")}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            transition={springTransition}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors duration-200",
            rulesDirty
                ? "bg-amber-400/10 text-amber-700 hover:bg-amber-400/15"
                : "text-muted-foreground/70 hover:bg-muted"
                            )}
                          >
                            <SlidersHorizontal className="size-3 shrink-0" />
                            <span className="truncate">Edit Sorting Rules</span>
                          </motion.button>
                        )}
                        {PREPROCESS_FUNCS.map((fn) => (
                          <motion.button
                            key={fn}
                            type="button"
                            onClick={() => {
                              if (fn === "List Files") setSubCard("list")
                              else if (fn === "Filesort Splitting") setSubCard("filesort")
                              else if (fn === "Asset Creation") setResultsFilter("all")
                              else setSubCard("batching")
                            }}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.96 }}
                            transition={springTransition}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors duration-200",
                                fnStatuses[fn] === "running"
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : fnStatuses[fn] === "done"
                                    ? "text-muted-foreground/80 hover:bg-muted"
                                    : "text-muted-foreground/60 hover:bg-muted"
                            )}
                          >
                            <motion.span
                              initial={false}
                              animate={fnStatuses[fn] === "running" ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                              className={cn(
                                "size-1.5 shrink-0 rounded-full transition-colors duration-300",
                                fnStatuses[fn] === "running"
                                  ? "bg-emerald-500"
                                  : fnStatuses[fn] === "done"
                                    ? "bg-emerald-500/70"
                                    : "bg-muted-foreground/40"
                              )}
                            />
                            <span className="truncate">{fn}</span>
                          </motion.button>
                        ))}
                        <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                              {isSorted ? "Groups" : "Batches"}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60">{batches.length}</span>
                          </div>
                          <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5"
                          >
                            {batches.length === 0 ? (
                              <motion.p
                                variants={fadePulseVariants}
                                initial="initial"
                                animate="animate"
                                className="p-1 text-[9px] text-muted-foreground/50"
                              >
                                No {isSorted ? "groups" : "batches"} yet
                              </motion.p>
                            ) : (
                              batches.map((b, i) => (
                                <motion.div
                                  key={i}
                                  variants={itemVariants}
                                  className="flex items-center gap-1.5 rounded-md bg-white px-1.5 py-1"
                                >
                                  <span className="shrink-0 text-[9px] text-muted-foreground/60">#{i + 1}</span>
                                  <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground/90">
                                    {isSorted ? sortedGroups[i]?.name : `${b.length} assets`}
                                  </span>
                                  <span className="shrink-0 text-[9px] text-muted-foreground/60">
                                    {isSorted
                                      ? `${b.length} assets`
                                      : formatBytes(b.reduce((s, a) => s + a.totalSize, 0))}
                                  </span>
                                </motion.div>
                              ))
                            )}
                          </motion.div>
                        </div>
                      </div>
                    }
                  />
                  <motion.div variants={itemVariants} className="grid shrink-0 grid-cols-3 gap-2">
                    {SUMMARY.map((s) => (
                      <motion.button
                        key={s.status}
                        type="button"
                        onClick={() => setResultsFilter(s.status)}
                        whileHover={{ y: -3, scale: 1.03, boxShadow: "0 10px 30px -10px rgba(33,31,84,0.10)" }}
                        whileTap={{ scale: 0.96 }}
                        transition={springTransition}
                        className={cn(
                          "flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 bg-white backdrop-blur-xl transition-all duration-200",
                          s.border
                        )}
                      >
                        <span className="text-base font-semibold text-foreground">
                          {counts[s.status]}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              )
            }
            return (
              <StageCard
                key={stage.id}
                className={sizeCls}
                index={i}
                status={statuses[stage.id] ?? "idle"}
                icon={stage.icon}
                label={stage.label}
                desc={stage.desc}
                body={
                  stage.id === "scheduling" ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl bg-muted p-2">
                      <QueueSection title="Ready Queue" count={readyQueue.length}>
                        {readyQueue.length === 0 ? (
                          <EmptyQueues />
                        ) : (
                          readyQueue.map((batch, bi) => (
                            <BatchRow key={bi} index={bi} batch={batch} />
                          ))
                        )}
                      </QueueSection>
                      <QueueSection title="Running Queue" count={runningQueue.length ? 1 : 0}>
                        {runningQueue.length === 0 ? (
                          <EmptyQueues />
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-1.5 py-1">
                              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                              <span className="min-w-0 flex-1 truncate text-[9px] text-emerald-700">
                                {runningQueue.length} assets
                              </span>
                            </div>
                            {runningQueue.map((a) => (
                              <motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={springTransition}
                                className={cn(
                                  "truncate rounded-md px-1.5 py-0.5 text-[9px]",
                                  runningAssetId === a.id
                                    ? "bg-emerald-500/10 text-emerald-700"
                                    : "text-muted-foreground/70"
                                )}
                              >
                                {a.base}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </QueueSection>
                      <QueueSection title="Finished" count={finishedQueue.length}>
                        {finishedQueue.length === 0 ? (
                          <EmptyQueues />
                        ) : (
                          finishedQueue.map((batch, bi) => (
                            <BatchRow key={bi} index={bi} batch={batch} done />
                          ))
                        )}
                      </QueueSection>
                    </div>
                  ) : stage.id === "execution" ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl bg-muted p-2">
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Asset Initializer
                        </div>
                        <motion.div
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5"
                        >
                          {runningQueue.length === 0 ? (
                            <motion.p
                              variants={fadePulseVariants}
                              initial="initial"
                              animate="animate"
                              className="p-1 text-[9px] text-muted-foreground/50"
                            >
                              Idle
                            </motion.p>
                          ) : (
                            runningQueue.map((a) => (
                              <motion.div
                                key={a.id}
                                variants={itemVariants}
                                className={cn(
                                  "truncate rounded-md px-1.5 py-0.5 text-[9px]",
                                  currentAssetId === a.id
                                    ? "bg-emerald-500/10 text-emerald-700"
                                    : "text-muted-foreground/70"
                                )}
                              >
                                {a.base}
                              </motion.div>
                            ))
                          )}
                        </motion.div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Ares
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-1.5">
                          <AnimatePresence mode="wait">
                            {currentStep === "ares" && currentAsset ? (
                              <motion.div
                                key="ares-active"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={springTransition}
                                className="flex flex-col items-center justify-center gap-1"
                              >
                                <Cpu className="size-3 text-muted-foreground/70" />
                                <p className="truncate text-[9px] text-emerald-700">
                                  Rendering {currentAsset.base} at 4K
                                </p>
                              </motion.div>
                            ) : (
                              <motion.p
                                key="ares-idle"
                                variants={fadePulseVariants}
                                initial="initial"
                                animate="animate"
                                exit={{ opacity: 0 }}
                                className="text-[9px] text-muted-foreground/50"
                              >
                                Idle
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Thumbnail Processor
                        </div>
                        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-1.5">
                          {running && (
                            <div
                                className="pointer-events-none"
                              style={{ position: "fixed", left: -9999, top: 0, width: 256, height: 256 }}
                              aria-hidden
                            >
                              <ThreeViewer
                                ref={viewerRef}
                                modelUrl={viewerModel?.url ?? null}
                                textures={viewerTextures}
                                fileName={viewerModel?.name ?? null}
                                onModelLoaded={() => {
                                  modelReadyRef.current = true
                                  modelErrorRef.current = null
                                }}
                                onModelError={(msg) => {
                                  modelReadyRef.current = false
                                  modelErrorRef.current = msg
                                }}
                                onTexturesApplied={() => {
                                  texturesReadyRef.current = true
                                }}
                              />
                            </div>
                          )}
                          <AnimatePresence mode="wait">
                            {thumbUrl ? (
                              <motion.div
                                key="thumb"
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={springTransition}
                                className="flex flex-col items-center justify-center gap-1"
                              >
                                <div className="flex aspect-square max-h-[72px] w-full max-w-[72px] items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-gradient-to-br from-muted via-secondary to-background">
                                  <img
                                    src={thumbUrl}
                                    alt={currentThumb?.base ?? ""}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                  <p className="truncate text-[9px] text-emerald-700">
                                    {currentThumb?.base ?? ""}
                                  </p>
                                <p className="text-[8px] text-muted-foreground/60">256 × 256</p>
                              </motion.div>
                            ) : (
                              <motion.p
                                key="thumb-idle"
                                variants={fadePulseVariants}
                                initial="initial"
                                animate="animate"
                                exit={{ opacity: 0 }}
                                className="text-[9px] text-muted-foreground/50"
                              >
                                Idle
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Normalizer
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-1.5">
                          <AnimatePresence mode="wait">
                            {currentStep === "normalize" && currentAsset ? (
                              <motion.div
                                key="norm-active"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={springTransition}
                                className="flex flex-col items-center justify-center gap-1"
                              >
                                <ScanLine className="size-3 text-muted-foreground/70" />
                                  <p className="truncate text-[9px] text-emerald-700">
                                    Scaling {currentAsset.base} to (1, 1, 1)
                                  </p>
                              </motion.div>
                            ) : (
                              <motion.p
                                key="norm-idle"
                                variants={fadePulseVariants}
                                initial="initial"
                                animate="animate"
                                exit={{ opacity: 0 }}
                                className="text-[9px] text-muted-foreground/50"
                              >
                                Idle
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  ) : stage.id === "compile" ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl bg-muted p-2">
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Bundler
                        </div>
                        <motion.div
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5"
                        >
                          {bundledAssets.length === 0 ? (
                            <motion.p
                              variants={fadePulseVariants}
                              initial="initial"
                              animate="animate"
                              className="p-1 text-[9px] text-muted-foreground/50"
                            >
                              Idle
                            </motion.p>
                          ) : (
                            bundledAssets.map((name, bi) => (
                              <motion.div
                                key={bi}
                                variants={itemVariants}
                                className="truncate rounded-md bg-white px-1.5 py-0.5 text-[9px] text-foreground/80"
                              >
                                {name}
                              </motion.div>
                            ))
                          )}
                        </motion.div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Director
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-1.5">
                          <div className="flex flex-col gap-0.5 font-mono text-[8px] leading-tight">
                            {isSorted ? (
                              sortedGroups.map((g) => (
                                <motion.div
                                  key={g.name}
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={springTransition}
                                  className="flex flex-col"
                                >
                                  <div className="flex items-center gap-1" style={{ paddingLeft: 0 }}>
                                    <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                  <span className="text-foreground">{g.name}/</span>
                                </div>
                                <div className="flex items-center gap-1" style={{ paddingLeft: 8 }}>
                                  <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                    <span className="text-muted-foreground/70">.thumbs/</span>
                                  </div>
                                  <div className="flex items-center gap-1" style={{ paddingLeft: 16 }}>
                                    <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                    <span className="text-muted-foreground/70">256x256/</span>
                                  </div>
                                </motion.div>
                              ))
                            ) : (
                              <>
                                <div className="flex items-center gap-1">
                                  <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                  <span className="text-foreground">{assetName}/</span>
                                </div>
                                <div className="flex items-center gap-1 pl-2">
                                  <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                  <span className="text-muted-foreground/70">.thumbs/</span>
                                </div>
                                <div className="flex items-center gap-1 pl-4">
                                  <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                  <span className="text-muted-foreground/70">256x256/</span>
                                </div>
                              </>
                            )}
                          </div>
                          <AnimatePresence mode="wait">
                            {currentStep === "bundler" && currentAsset ? (
                              <motion.p
                                key="dir-active"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={springTransition}
                                className="truncate text-[9px] text-emerald-700"
                              >
                                Directing {currentAsset.base}
                              </motion.p>
                            ) : directorReady ? (
                              <motion.p
                                key="dir-ready"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={springTransition}
                                className="text-[9px] text-emerald-700"
                              >
                                Structure ready
                              </motion.p>
                            ) : (
                              <motion.p
                                key="dir-idle"
                                variants={fadePulseVariants}
                                initial="initial"
                                animate="animate"
                                exit={{ opacity: 0 }}
                                className="text-[9px] text-muted-foreground/50"
                              >
                                Idle
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Extractor
                        </div>
                        <motion.div
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5"
                        >
                          {extracted.length === 0 ? (
                            <motion.p
                              variants={fadePulseVariants}
                              initial="initial"
                              animate="animate"
                              className="p-1 text-[9px] text-muted-foreground/50"
                            >
                              Idle
                            </motion.p>
                          ) : (
                            extracted.map((e) => (
                              <motion.div
                                key={e.id}
                                variants={itemVariants}
                                className="truncate rounded-md bg-white px-1.5 py-0.5 text-[9px] text-foreground/80"
                              >
                                {e.name}
                              </motion.div>
                            ))
                          )}
                        </motion.div>
                      </div>
                    </div>
                  ) : stage.id === "export" ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl bg-muted p-2">
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Move
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-1 overflow-y-auto p-1.5">
                          {moved.length === 0 ? (
                            <motion.p
                              variants={fadePulseVariants}
                              initial="initial"
                              animate="animate"
                              className="text-[9px] text-muted-foreground/50"
                            >
                              Idle
                            </motion.p>
                          ) : (
                            <div className="flex flex-col gap-0.5 font-mono text-[8px] leading-tight">
                              {isSorted ? (
                                sortedGroups.map((g) => (
                                  <div key={g.name} className="flex items-center gap-1">
                                  <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                  <span className="text-foreground">{g.name}/</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-1">
                                <Folder className="size-2.5 shrink-0 text-amber-500/80" />
                                <span className="text-foreground">{assetName}/</span>
                              </div>
                            )}
                              <DirTree node={moveTree} depth={1} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-muted">
                        <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                          Download
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-1.5">
                          <AnimatePresence mode="wait">
                            {zipping ? (
                              <motion.div
                                key="zipping"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={springTransition}
                                className="flex flex-col items-center justify-center gap-1"
                              >
                                <Loader2 className="size-3 animate-spin text-muted-foreground/70" />
                                <p className="text-[9px] text-muted-foreground/60">
                                  Generating {assetName}.zip…
                                </p>
                              </motion.div>
                            ) : zip ? (
                              <motion.div
                                key="zip-ready"
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={springTransition}
                                className="flex flex-col items-center justify-center gap-1"
                              >
                                <Archive className="size-3 text-emerald-700" />
                                <p className="truncate text-[9px] text-emerald-700">{zip.name}</p>
                                <p className="text-[8px] text-muted-foreground/60">Ready to download</p>
                              </motion.div>
                            ) : (
                              <motion.p
                                key="zip-idle"
                                variants={fadePulseVariants}
                                initial="initial"
                                animate="animate"
                                exit={{ opacity: 0 }}
                                className="text-[9px] text-muted-foreground/50"
                              >
                                Idle
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  ) : undefined
                }
              />
            )
          })}
          </motion.div>

        {subCard && (
          <SubCardModal
            kind={subCard}
            files={files}
            usdFiles={usdFiles}
            pngFiles={pngFiles}
            passable={passable}
            batchSize={batchSize}
            onSaveBatchSize={handleSaveBatchSize}
            onClose={() => setSubCard(null)}
            workflowId={workflowId}
            savedRules={
              workflow?.sorting === "Sorted"
                ? { listed: workflow.listed ?? [], unlisted: workflow.unlisted }
                : undefined
            }
            onSaveRules={(listed, unlisted) => {
              void handleSaveRules(listed, unlisted)
            }}
          />
        )}

        {resultsFilter && (
          <AssetResultsModal
            filter={resultsFilter}
            assets={assets}
            onClose={() => setResultsFilter(null)}
          />
        )}

        <motion.aside
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={springTransition}
          className="flex w-[248px] shrink-0 flex-col border-l border-border/40 bg-background"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
            <ScrollText className="size-3.5 text-muted-foreground/90" />
            <span className="text-xs font-medium text-foreground">Execution Logs</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60">{logs.length}</span>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3"
          >
            {logs.length === 0 ? (
              <motion.div
                variants={fadePulseVariants}
                initial="initial"
                animate="animate"
                className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50"
              >
                <Clock className="size-3.5" />
                <span className="text-[11px]">No logs yet</span>
              </motion.div>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  variants={itemVariants}
                  className="flex items-start gap-2 rounded-lg bg-muted px-2 py-1.5 text-[11px]"
                >
                  {log.type === "success" ? (
                    <CheckCircle className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                  ) : log.type === "error" ? (
                    <AlertCircle className="size-3 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="size-3 text-muted-foreground/60 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-foreground">{log.message}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{log.timestamp}</p>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </motion.aside>
      </div>
    </motion.div>
  )
}

export default function LibraPipelinePage() {
  return (
    <Suspense fallback={null}>
      <LibraPipeline />
    </Suspense>
  )
}
