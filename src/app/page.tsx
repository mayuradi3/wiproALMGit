"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { Trash2 } from "lucide-react"
import type { Workflow } from "@/lib/workflow-registry"
import { listWorkflows, deleteWorkflow } from "@/app/actions"
import { AlmLogo } from "@/components/alm-logo"
import { CreateWorkflowPanel } from "@/components/workflow-create-panel"
import { IconWebglShader } from "@/components/icon-webgl-shader"
import { WorkflowGrid } from "@/components/workflow-grid"
import { WorkflowCard } from "@/components/workflow-card"
import { cn } from "@/lib/utils"

function PlusGlyph({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      width="100%"
      height="100%"
      variants={{
        rest: { rotate: 0 },
        hover: { rotate: 90 },
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
    <div className="relative z-10 flex flex-col min-h-dvh overflow-x-hidden">
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
          <AlmLogo size={42} />
          <span className="text-[15px] font-medium tracking-wide text-foreground font-zen-dots">
            ALM
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
                size={51}
                strokeWidth={2.5}
                iconSize={24}
                iconColor="#52525b"
                innerTop="transparent"
                innerBottom="transparent"
                icon={<PlusGlyph strokeWidth={2} />}
              />
            </motion.button>
          </motion.div>
        )}

        <motion.img
          src="/srl-logo.png"
          alt="Smart Robotics Lab"
          width={90}
          height={34}
          className="object-contain"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: intro ? 0 : 1, scale: intro ? 0.8 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        />
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
                  iconColor="#52525b"
                  innerTop="transparent"
                  innerBottom="transparent"
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
            <motion.div
              layout
              className={cn(
                "flex flex-col min-h-0",
                open
                  ? "w-1/4 min-w-0 border-r border-black/10 pr-6"
                  : "w-full max-w-4xl mx-auto"
              )}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
              <WorkflowGrid columns={open ? 1 : 3} gap={12}>
                {workflows.map((wf) => (
                  <WorkflowCard
                    key={wf.id}
                    workflow={wf}
                    onClick={() => {
                      if (wf.type === "ares") {
                        router.push(`/pipeline/ares?name=${encodeURIComponent(wf.name)}`)
                      } else {
                        router.push(`/pipeline/libra?id=${encodeURIComponent(wf.id)}`)
                      }
                    }}
                    onDelete={(e) => {
                      e.stopPropagation()
                      handleDelete(wf.id)
                    }}
                  />
                ))}
              </WorkflowGrid>
            </motion.div>

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
