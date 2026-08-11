"use client"

import { useState, useRef, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Folder, PanelRightOpen, PanelRightClose } from "lucide-react"
import JSZip from "jszip"
import { ThreeViewer, type Textures, type ThreeViewerHandle } from "@/components/asset/three-viewer"
import { FileUploadCard } from "@/components/asset/file-upload-card"
import { TextureSlot } from "@/components/asset/texture-slot"
import { PipelineStatus, type PipelineStep } from "@/components/asset/pipeline-status"
import { ExecutionLogs } from "@/components/asset/execution-logs"
import { ExportBar } from "@/components/asset/export-bar"

type LogEntry = { id: string; message: string; type: "success" | "info" | "error"; timestamp: string }

import { cropTo256x256, fitToScreen } from "@/lib/image-utils"
import { normalizeUsdScale, isUsdaFile } from "@/lib/usd-normalize"

function AresPipeline() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewerRef = useRef<ThreeViewerHandle>(null)
  const [assetName, setAssetName] = useState(() => searchParams.get("name") ?? "Asset")

  const [modelFile, setModelFile] = useState<File | null>(null)
  const [modelUrl, setModelUrl] = useState<string | null>(null)

  const [baseColorFile, setBaseColorFile] = useState<File | null>(null)
  const [emissiveFile, setEmissiveFile] = useState<File | null>(null)
  const [normalFile, setNormalFile] = useState<File | null>(null)
  const [ormFile, setOrmFile] = useState<File | null>(null)

  const baseColorUrl = useMemo(() => baseColorFile ? URL.createObjectURL(baseColorFile) : undefined, [baseColorFile])
  const emissiveUrl = useMemo(() => emissiveFile ? URL.createObjectURL(emissiveFile) : undefined, [emissiveFile])
  const normalUrl = useMemo(() => normalFile ? URL.createObjectURL(normalFile) : undefined, [normalFile])
  const ormUrl = useMemo(() => ormFile ? URL.createObjectURL(ormFile) : undefined, [ormFile])

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pipelineStep, setPipelineStep] = useState<PipelineStep | null>(null)
  const [running, setRunning] = useState(false)
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [showControls, setShowControls] = useState(true)
  const modelReadyRef = useRef(false)
  const modelErrorRef = useRef<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const texturesReadyRef = useRef(false)
  const textureErrorRef = useRef<string | null>(null)

  function addLog(msg: string, t: LogEntry["type"] = "info") {
    setLogs((p) => [...p, { id: crypto.randomUUID(), message: msg, type: t, timestamp: new Date().toLocaleTimeString() }])
  }

  const modelName = modelFile?.name ?? null

  function handleModelFile(file: File) {
    if (modelUrl) URL.revokeObjectURL(modelUrl)
    setModelFile(file)
    setModelUrl(URL.createObjectURL(file))
    modelReadyRef.current = false
    modelErrorRef.current = null
    setModelError(null)
    texturesReadyRef.current = false
    addLog(`Loaded 3D model: ${file.name}`, "success")
  }

  function handleModelClear() {
    if (modelUrl) URL.revokeObjectURL(modelUrl)
    setModelFile(null)
    setModelUrl(null)
    modelReadyRef.current = false
    modelErrorRef.current = null
    setModelError(null)
    texturesReadyRef.current = false
    addLog("Model removed", "info")
  }

  const allTextures: Textures = {
    baseColor: baseColorUrl,
    emissive: emissiveUrl,
    normal: normalUrl,
    orm: ormUrl,
  }

  function hasAnyTexture() {
    return !!(baseColorFile || emissiveFile || normalFile || ormFile)
  }

  async function waitForReady(
    ref: React.MutableRefObject<boolean>,
    errorRef: React.MutableRefObject<string | null>,
    label: string,
    timeoutMs = 60000
  ): Promise<boolean> {
    if (ref.current) return true
    if (errorRef.current) {
      addLog(`${label} failed: ${errorRef.current}`, "error")
      return false
    }
    return new Promise<boolean>((resolve) => {
      const start = Date.now()
      const iv = setInterval(() => {
        if (ref.current) { clearInterval(iv); resolve(true) }
        else if (errorRef.current) { clearInterval(iv); addLog(`${label} failed: ${errorRef.current}`, "error"); resolve(false) }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); addLog(`${label} timed out after ${timeoutMs / 1000}s`, "error"); resolve(false) }
      }, 50)
    })
  }

  async function executePipeline() {
    if (!modelFile) { addLog("Upload a 3D model first", "error"); return }
    if (!hasAnyTexture()) { addLog("Upload at least one texture", "error"); return }

    setRunning(true)
    setZipBlob(null)
    texturesReadyRef.current = false
    modelErrorRef.current = null
    setModelError(null)

    setPipelineStep("model")
    addLog("Waiting for model to load...", "info")
    const modelOk = await waitForReady(modelReadyRef, modelErrorRef, "Model load", 60000)
    if (!modelOk) { setRunning(false); return }

    setPipelineStep("model")
    addLog("Model ready", "success")

    setPipelineStep("textures")
    addLog("Applying textures...", "info")
    const texOk = await waitForReady(texturesReadyRef, textureErrorRef, "Texture apply", 60000)
    if (!texOk) { setRunning(false); return }

    setPipelineStep("textures")
    addLog("Textures applied", "success")

    setPipelineStep("thumbnail")
    addLog("Capturing screenshot...", "info")

    try {
      const screenshot = await viewerRef.current!.captureScreenshot()
      const cropped = await cropTo256x256(screenshot)
      addLog("Thumbnail captured (256x256)", "success")

      setPipelineStep("bgremoval")
      addLog("Removing background...", "info")
      const clean = await viewerRef.current!.captureCleanScreenshot()
      const clean256 = await cropTo256x256(clean)
      addLog("Background removed", "success")

      setPipelineStep("fittoscreen")
      addLog("Fitting to screen with 0.001 margin...", "info")
      const fitted = await fitToScreen(clean256, 0.001)
      addLog("Fit to screen complete", "success")

      setPipelineStep("normalize")
      let exportModelFile = modelFile!
      if (isUsdaFile(modelFile!.name)) {
        addLog("Normalizer: ensuring uniform scale (1, 1, 1)...", "info")
        try {
          const normalizedBlob = await normalizeUsdScale(modelFile!)
          if (normalizedBlob !== modelFile!) {
            exportModelFile = new File([normalizedBlob], modelFile!.name, { type: modelFile!.type })
            addLog("Normalizer: model scale set to (1, 1, 1)", "success")
          } else {
            addLog("Normalizer: model already uniform", "info")
          }
        } catch (err: unknown) {
          addLog(
            `Normalizer: failed (${err instanceof Error ? err.message : String(err)}). Using original model.`,
            "error"
          )
        }
      } else {
        addLog("Normalizer: binary USD/OBJ/GLB skipped; scale normalization only applies to USDA", "info")
      }

      setPipelineStep("complete")

      const zip = new JSZip()
      const parent = zip.folder(assetName)!
      parent.file(exportModelFile.name, exportModelFile)

      const texFolder = parent.folder("Textures")!
      if (baseColorFile) texFolder.file(baseColorFile.name, baseColorFile)
      if (emissiveFile) texFolder.file(emissiveFile.name, emissiveFile)
      if (normalFile) texFolder.file(normalFile.name, normalFile)
      if (ormFile) texFolder.file(ormFile.name, ormFile)

      const sizeDir = parent.folder(".thumbs")!.folder("256x256")!
      sizeDir.file(`${modelFile!.name}.png`, fitted)

      const blob = await zip.generateAsync({ type: "blob" })
      setZipBlob(blob)
      addLog("Pipeline complete — ready to export", "success")
    } catch (err: unknown) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`, "error")
    }

    setRunning(false)
  }

  function handleExport() {
    if (!zipBlob) return
    const a = document.createElement("a")
    a.href = URL.createObjectURL(zipBlob)
    a.download = `${assetName}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
    addLog(`Downloaded ${assetName}.zip`, "success")
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-black">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0 bg-black">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push("/")} className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200">
            <ArrowLeft className="size-4" />
          </button>
          <Folder className="size-4 text-foreground" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground truncate flex-1">{assetName}</span>
        </div>
        <button type="button" onClick={() => setShowControls((v) => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/40 hover:bg-muted transition-all ml-auto">
          {showControls ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
          {showControls ? "Hide" : "Show"} Controls
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="relative" style={{ flex: "0.9 1 0%", minWidth: 0, minHeight: 300 }}>
          <ThreeViewer
            ref={viewerRef}
            modelUrl={modelUrl}
            textures={allTextures}
            fileName={modelName}
            onModelLoaded={() => { modelReadyRef.current = true; modelErrorRef.current = null; setModelError(null) }}
            onModelError={(msg) => { modelReadyRef.current = false; modelErrorRef.current = msg; setModelError(msg) }}
            onTexturesApplied={() => { texturesReadyRef.current = true }}
          />
        </div>
        <div className="shrink-0" style={{ flex: "0.1 0 0%" }} />

        {showControls && (
          <div className="w-[300px] shrink-0 border-l border-border/40 p-4 flex flex-col gap-3 overflow-y-auto bg-black">
            <FileUploadCard
              label="3D Model"
              sublabel="Upload USD, OBJ, GLB, or GLTF"
              fileName={modelName}
              onFile={handleModelFile}
              onClear={handleModelClear}
              accept=".usd,.usda,.usdc,.obj,.glb,.gltf"
            />

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-foreground">Textures</h3>
              <TextureSlot label="Base Color" hint="albedo" file={baseColorFile} onFile={setBaseColorFile} onClear={() => setBaseColorFile(null)} />
              <TextureSlot label="Emissive" hint="optional" file={emissiveFile} onFile={setEmissiveFile} onClear={() => setEmissiveFile(null)} />
              <TextureSlot label="Normal" hint="optional" file={normalFile} onFile={setNormalFile} onClear={() => setNormalFile(null)} />
              <TextureSlot label="ORM" hint="R:ao G:rough B:metal" file={ormFile} onFile={setOrmFile} onClear={() => setOrmFile(null)} />
            </div>

            <PipelineStatus current={pipelineStep} />
            <ExecutionLogs logs={logs} />
          </div>
        )}
      </div>

      <ExportBar
        hasModel={!!modelFile}
        hasTextures={hasAnyTexture()}
        hasThumbnail={pipelineStep === "complete"}
        hasZip={!!zipBlob}
        modelError={modelError}
        onExport={handleExport}
        onPlay={executePipeline}
        running={running}
        assetName={assetName}
      />
    </div>
  )
}

export default function AresPipelinePage() {
  return (
    <Suspense fallback={null}>
      <AresPipeline />
    </Suspense>
  )
}
