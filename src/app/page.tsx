"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { Trash2, Layers, Zap } from "lucide-react"
import type { Workflow } from "@/lib/workflow-registry"
import { listWorkflows, deleteWorkflow } from "@/app/actions"
import { CerberusLogo } from "@/components/cerberus-logo"
import { CreateWorkflowPanel } from "@/components/workflow-create-panel"
import { IconWebglShader } from "@/components/icon-webgl-shader"
import { cn } from "@/lib/utils"

function PlusGlyph({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="butt"
      width="100%"
      height="100%"
      variants={{
        rest: { rotate: 0, strokeWidth },
        hover: { rotate: 90, strokeWidth: Math.min(strokeWidth + 1.5, 4) },
      }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <path d="M12 5v14M5 12h14" />
    </motion.svg>
  )
}

export default function Home() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [intro, setIntro] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const timer = setTimeout(() => setIntro(false), 1000)
    return () => clearTimeout(timer)
  }, [pathname])

  const load = useCallback(async () => {
    console.log("[Home] loading workflows...")
    try {
      const list = await listWorkflows()
      console.log("[Home] loaded workflows:", list.length)
      setWorkflows(list)
    } catch (err) {
      console.error("[Home] Failed to load workflows:", err)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => setIntro(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  async function handleDelete(id: string) {
    await deleteWorkflow(id)
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  function handleCreated(w: Workflow) {
    setWorkflows((prev) => [w, ...prev])
    setOpen(false)
  }

  const isEmpty = loaded && workflows.length === 0

  return (
    <div className="flex flex-col min-h-dvh overflow-x-hidden">
      <header className="flex items-center justify-between px-6 py-3.5">
        <motion.button
          type="button"
          aria-label="Go to workflows"
          onClick={() => {
            setOpen(false)
            router.push("/")
          }}
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: intro ? 0 : 1, y: intro ? -16 : 0 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          <CerberusLogo size={22} />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Cerberus
          </span>
        </motion.button>

        {!isEmpty && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: intro ? 0 : 1, scale: intro ? 0.8 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <motion.button
              type="button"
              aria-label={open ? "Close workflow creator" : "Create workflow"}
              onClick={() => setOpen((v) => !v)}
              className="flex items-center justify-center p-1.5 text-muted-foreground focus:outline-none"
              initial="rest"
              whileHover="hover"
              animate="rest"
              whileTap={{ scale: 0.94 }}
            >
              <IconWebglShader
                size={34}
                strokeWidth={2.5}
                iconSize={18}
                iconColor="#a1a1aa"
                icon={<PlusGlyph strokeWidth={2} />}
              />
            </motion.button>
          </motion.div>
        )}
      </header>

      <main className="flex-1 flex flex-col p-6 min-h-0 overflow-x-hidden">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : isEmpty ? (
          <AnimatePresence mode="wait">
            {!open ? (
              <motion.div
                key="empty-plus"
                className="flex-1 flex flex-col items-center justify-center gap-6"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: intro ? 0 : 1, y: intro ? 24 : 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.button
                  type="button"
                  aria-label="Create workflow"
                  onClick={() => setOpen(true)}
                  className="flex items-center justify-center focus:outline-none"
                  initial="rest"
                  whileHover="hover"
                  animate="rest"
                  whileTap={{ scale: 0.95 }}
                >
                  <IconWebglShader
                    size={92}
                    strokeWidth={3.5}
                    iconSize={40}
                    iconColor="#a1a1aa"
                    icon={<PlusGlyph strokeWidth={2} />}
                  />
                </motion.button>
                <p className="text-sm text-muted-foreground">
                  Create your first workflow
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty-create"
                className="flex-1 flex items-start justify-center pt-12"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <CreateWorkflowPanel onCreated={handleCreated} />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <motion.div
            className="flex flex-1 min-h-0 gap-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: intro ? 0 : 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div
              className={cn(
                "flex flex-col min-h-0 transition-all duration-500",
                open
                  ? "w-1/4 min-w-0 border-r border-white/5 pr-6"
                  : "w-full max-w-4xl mx-auto"
              )}
            >
              <motion.div
                className="flex items-center justify-between mb-5 shrink-0"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: intro ? 0 : 1, x: intro ? -16 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <h2 className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
                  Workflows
                </h2>
                <span className="text-xs text-muted-foreground">
                  {workflows.length}
                </span>
              </motion.div>
              <div
                className={cn(
                  "grid gap-3 overflow-x-hidden",
                  open
                    ? "grid-cols-1 overflow-y-auto min-h-0 pr-1"
                    : "sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                <AnimatePresence mode="popLayout">
                  {workflows.map((wf, i) => (
                    <motion.div
                      key={wf.id}
                      initial={{ opacity: 0, x: -40 }}
                      animate={{
                        opacity: intro ? 0 : 1,
                        x: intro ? -40 : 0,
                        transition: {
                          delay: intro ? 0 : i * 0.2,
                          duration: 0.3,
                          ease: "easeOut",
                        },
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.9,
                        y: -10,
                        transition: { duration: 0.2, ease: "easeIn" },
                      }}
                      layout
                      layoutId={wf.id}
                    >
                      <div
                        className="group relative rounded-xl border border-white/10 bg-transparent p-4 flex flex-col gap-3 cursor-pointer transition-colors duration-200 hover:border-white/30"
                        onClick={() => {
                          if (wf.type === "ares") {
                            router.push(`/pipeline/ares?name=${encodeURIComponent(wf.name)}`)
                          } else {
                            router.push(`/pipeline/libra?id=${encodeURIComponent(wf.id)}`)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {wf.type === "ares" ? (
                              <Zap className="size-4 text-amber-500 shrink-0" />
                            ) : (
                              <Layers className="size-4 text-sky-500 shrink-0" />
                            )}
                            <span className="text-sm font-medium text-foreground truncate">
                              {wf.name}
                            </span>
                          </div>
                          <motion.button
                            type="button"
                            aria-label={`Delete ${wf.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(wf.id)
                            }}
                            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="size-3.5" />
                          </motion.button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 rounded-md px-1.5 py-0.5">
                            {wf.type === "ares" ? "Single" : "Bulk"}
                          </span>
                          {wf.sorting && (
                            <span className="text-[11px] text-muted-foreground">
                              {wf.sorting}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground ml-auto">
                            {new Date(wf.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {open && (
                <motion.section
                  key="create"
                  className="flex-1 min-w-0 pt-2"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <CreateWorkflowPanel onCreated={handleCreated} />
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  )
}
