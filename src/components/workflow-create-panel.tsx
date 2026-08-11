"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Layers, ArrowDownUp, Shuffle, Check } from "lucide-react"
import type { Workflow } from "@/lib/workflow-registry"
import { createWorkflow } from "@/app/actions"
import { cn } from "@/lib/utils"
import { SortingRulesCard,
  type SortingRule,
  newRule,
  isRuleComplete,
  duplicateDirectoryNames,
} from "@/components/sorting-rules-card"
import type { SortingRule as RegistryRule } from "@/lib/workflow-registry"

type Mode = "ares" | "bulk"
type Sorting = "Sorted" | "Unsorted"

type ChoiceButtonProps = {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  icon: typeof Zap
  title: string
  desc: string
  iconColor: string
}

function ChoiceButton({
  selected,
  disabled,
  onClick,
  icon: Icon,
  title,
  desc,
  iconColor,
}: ChoiceButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.03, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3.5 text-left backdrop-blur-xl transition-colors duration-200 focus:outline-none disabled:opacity-60",
        selected
          ? "border-white/50 bg-white/10"
          : "border-white/15 bg-white/[0.04] hover:border-white/30"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
        <Icon className={cn("size-4", iconColor)} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="block text-[11px] text-white/55">{desc}</span>
      </span>
    </motion.button>
  )
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
      {children}
    </span>
  )
}

export function CreateWorkflowPanel({
  onCreated,
}: {
  onCreated: (workflow: Workflow) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [mode, setMode] = useState<Mode | null>(null)
  const [sorting, setSorting] = useState<Sorting | null>(null)
  const [creating, setCreating] = useState(false)
  const [listedRules, setListedRules] = useState<SortingRule[]>(() => [newRule()])
  const [unlistedRule, setUnlistedRule] = useState<SortingRule>(() => newRule())

  const showMode = name.trim().length > 0
  const showOrder = mode === "bulk"
  const listedDupDirs = duplicateDirectoryNames(listedRules)
  const rulesValid =
    listedRules.some((r) => isRuleComplete(r) && !listedDupDirs.has(r.directory.trim().toLowerCase())) ||
    isRuleComplete(unlistedRule)
  const canCreate =
    name.trim().length > 0 &&
    mode !== null &&
    (mode === "ares" ||
      sorting === "Unsorted" ||
      (sorting === "Sorted" && rulesValid))

  async function handleCreate() {
    if (!canCreate || !mode || creating) return
    setCreating(true)

    const listedToSave: RegistryRule[] | undefined =
      mode === "bulk" && sorting === "Sorted"
        ? listedRules
            .filter((r) => isRuleComplete(r) && !listedDupDirs.has(r.directory.trim().toLowerCase()))
            .map((r) => ({ id: r.id, directory: r.directory.trim(), conditions: r.conditions }))
        : undefined

    const unlistedToSave: RegistryRule | undefined =
      mode === "bulk" && sorting === "Sorted" && isRuleComplete(unlistedRule)
        ? { id: unlistedRule.id, directory: unlistedRule.directory.trim(), conditions: [] }
        : undefined

    const workflow = await createWorkflow(name.trim(), mode, sorting ?? undefined, listedToSave, unlistedToSave)
    onCreated(workflow)
    if (mode === "ares") {
      router.push(`/pipeline/ares?name=${encodeURIComponent(workflow.name)}`)
    } else {
      router.push(`/pipeline/libra?id=${encodeURIComponent(workflow.id)}`)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Create workflow
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a new Ares or Libra workflow.
        </p>
      </div>

      <div className="space-y-4">
        <section>
          <StepLabel>Step 1 · Name</StepLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) handleCreate()
            }}
            placeholder="e.g. Character Assets"
            className="mt-3 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/40 backdrop-blur-md focus:border-white/35 focus:outline-none"
          />
        </section>

        <AnimatePresence>
          {showMode && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <StepLabel>Step 2 · Mode</StepLabel>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ChoiceButton
                  selected={mode === "ares"}
                  disabled={creating}
                  onClick={() => setMode("ares")}
                  icon={Zap}
                  title="Ares"
                  desc="Single asset import"
                  iconColor="text-amber-400"
                />
                <ChoiceButton
                  selected={mode === "bulk"}
                  disabled={creating}
                  onClick={() => setMode("bulk")}
                  icon={Layers}
                  title="Libra"
                  desc="Batch import pipeline for large folders/ bulk imports"
                  iconColor="text-sky-400"
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showOrder && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <StepLabel>Step 3 · Order</StepLabel>
              <p className="mt-1 text-sm text-white/70">
                How should Libra sort files?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ChoiceButton
                  selected={sorting === "Sorted"}
                  disabled={creating}
                  onClick={() => setSorting("Sorted")}
                  icon={ArrowDownUp}
                  title="Sorted"
                  desc="Ordered by filename"
                  iconColor="text-zinc-200"
                />
                <ChoiceButton
                  selected={sorting === "Unsorted"}
                  disabled={creating}
                  onClick={() => setSorting("Unsorted")}
                  icon={Shuffle}
                  title="Unsorted"
                  desc="Original file order"
                  iconColor="text-zinc-200"
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showOrder && sorting === "Sorted" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <SortingRulesCard
                listed={listedRules}
                unlisted={unlistedRule}
                onListedChange={setListedRules}
                onUnlistedChange={setUnlistedRule}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          All fields must be set to continue
        </span>
        <motion.button
          type="button"
          disabled={!canCreate || creating}
          onClick={handleCreate}
          whileHover={canCreate ? { scale: 1.04 } : undefined}
          whileTap={canCreate ? { scale: 0.96 } : undefined}
          className={cn(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none",
            canCreate
              ? "bg-zinc-100 text-zinc-900 hover:bg-white"
              : "cursor-not-allowed bg-white/10 text-white/40"
          )}
        >
          {creating ? "Creating..." : "Create project"}
          {canCreate && <Check className="size-4" />}
        </motion.button>
      </div>
    </div>
  )
}
