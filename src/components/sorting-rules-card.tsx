"use client"

import { Plus, Trash2, FolderOpen, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

export type SortingCondition = {
  id: string
  regexType: string
  value: string
}

export type SortingRule = {
  id: string
  directory: string
  conditions: SortingCondition[]
}

export const REGEX_TYPES = [
  "contains",
  "starts with",
  "ends with",
  "equals",
  "regex",
] as const

let ruleSeq = 0
let condSeq = 0

export function newCondition(): SortingCondition {
  condSeq += 1
  return { id: `cond-${condSeq}`, regexType: "contains", value: "" }
}

export function newRule(): SortingRule {
  ruleSeq += 1
  return { id: `rule-${ruleSeq}`, directory: "", conditions: [newCondition()] }
}

const INVALID_CHARS = /[\\/:*?"<>|\u0000-\u001f]/

export function isValidFolderName(name: string): boolean {
  const t = name.trim()
  if (t.length === 0 || t.length > 255) return false
  if (t === "." || t === "..") return false
  if (INVALID_CHARS.test(t)) return false
  if (/[. ]$/.test(t)) return false
  return true
}

export function isConditionComplete(c: SortingCondition): boolean {
  return c.regexType !== "" && c.value.trim() !== ""
}

export function isRuleComplete(r: SortingRule): boolean {
  return (
    isValidFolderName(r.directory) &&
    r.conditions.length > 0 &&
    r.conditions.every(isConditionComplete)
  )
}

export function duplicateDirectoryNames(rows: SortingRule[]): Set<string> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = r.directory.trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set(
    [...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key)
  )
}

type ConditionRowProps = {
  condition: SortingCondition
  onChange: (patch: Partial<SortingCondition>) => void
  onRemove?: () => void
  showRemove?: boolean
}

function ConditionRow({ condition, onChange, onRemove, showRemove }: ConditionRowProps) {
  return (
    <div className="flex items-start gap-2">
      <select
        value={condition.regexType}
        onChange={(e) => onChange({ regexType: e.target.value })}
        className="w-[120px] shrink-0 rounded-lg border border-white/15 bg-black/25 px-2 py-2 text-sm text-white backdrop-blur-md focus:border-white/35 focus:outline-none"
      >
        {REGEX_TYPES.map((t) => (
          <option key={t} value={t} className="bg-zinc-900">
            {t}
          </option>
        ))}
      </select>
      <input
        value={condition.value}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="Value"
        className="flex-1 min-w-0 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/35 backdrop-blur-md focus:border-white/35 focus:outline-none"
      />
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:text-red-400 hover:bg-red-400/10"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

type ListedRuleRowProps = {
  rule: SortingRule
  onChange: (patch: Partial<SortingRule>) => void
  onRemove?: () => void
  duplicate?: boolean
}

function ListedRuleRow({ rule, onChange, onRemove, duplicate }: ListedRuleRowProps) {
  const dirInvalid = rule.directory !== "" && !isValidFolderName(rule.directory)
  const error =
    rule.directory === ""
      ? null
      : dirInvalid
        ? "Invalid folder name"
        : duplicate
          ? "Folder name already used"
          : null

  function updateCondition(id: string, patch: Partial<SortingCondition>) {
    onChange({
      conditions: rule.conditions.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    })
  }

  function addCondition() {
    onChange({ conditions: [...rule.conditions, newCondition()] })
  }

  function removeCondition(id: string) {
    onChange({ conditions: rule.conditions.filter((c) => c.id !== id) })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            value={rule.directory}
            onChange={(e) => onChange({ directory: e.target.value })}
            placeholder="Directory name"
            className={cn(
              "w-full rounded-lg border bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/35 backdrop-blur-md focus:outline-none",
              error
                ? "border-red-500/60 focus:border-red-500"
                : "border-white/15 focus:border-white/35"
            )}
          />
          {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove rule"
            className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:text-red-400 hover:bg-red-400/10"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2 pl-0">
        {rule.conditions.map((c) => (
          <ConditionRow
            key={c.id}
            condition={c}
            onChange={(patch) => updateCondition(c.id, patch)}
            onRemove={() => removeCondition(c.id)}
            showRemove={rule.conditions.length > 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="mt-2 flex items-center gap-1 text-xs text-white/60 transition-colors hover:text-white"
      >
        <Plus className="size-3" />
        Add condition
      </button>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof FolderOpen; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-white">
      <Icon className="size-4 text-white/70" />
      {children}
    </div>
  )
}

type SortingRulesCardProps = {
  listed: SortingRule[]
  unlisted: SortingRule
  onListedChange: (rows: SortingRule[]) => void
  onUnlistedChange: (rule: SortingRule) => void
}

export function SortingRulesCard({
  listed,
  unlisted,
  onListedChange,
  onUnlistedChange,
}: SortingRulesCardProps) {
  function updateListed(id: string, patch: Partial<SortingRule>) {
    onListedChange(listed.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function addListed() {
    onListedChange([...listed, newRule()])
  }
  function removeListed(id: string) {
    onListedChange(listed.filter((r) => r.id !== id))
  }

  const dupes = duplicateDirectoryNames(listed)

  return (
    <section>
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
        Step 4 · Rules
      </span>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={FolderOpen}>Listed</SectionTitle>
          <button
            type="button"
            onClick={addListed}
            className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white focus:outline-none"
          >
            <Plus className="size-3" />
            Add directory
          </button>
        </div>
        <p className="mt-1 text-[11px] text-white/50">
          Directories and the conditions files must match to be sorted into them
        </p>
        <div className="mt-2.5 flex flex-col gap-2">
          {listed.length === 0 ? (
            <p className="text-xs text-white/40">
              No listed rules yet — add one to get started.
            </p>
          ) : (
            listed.map((row) => (
              <ListedRuleRow
                key={row.id}
                rule={row}
                onChange={(patch) => updateListed(row.id, patch)}
                onRemove={() => removeListed(row.id)}
                duplicate={dupes.has(row.directory.trim().toLowerCase())}
              />
            ))
          )}
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle icon={Inbox}>Unlisted</SectionTitle>
        <p className="mt-1 text-[11px] text-white/50">
          Fallback directory for all files that don&apos;t match any listed rule
        </p>
        <div className="mt-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <input
                value={unlisted.directory}
                onChange={(e) =>
                  onUnlistedChange({ ...unlisted, directory: e.target.value })
                }
                placeholder="Directory name"
                className={cn(
                  "w-full rounded-lg border bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/35 backdrop-blur-md focus:outline-none",
                  unlisted.directory !== "" && !isValidFolderName(unlisted.directory)
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-white/15 focus:border-white/35"
                )}
              />
              {unlisted.directory !== "" && !isValidFolderName(unlisted.directory) && (
                <p className="mt-1 text-[10px] text-red-400">Invalid folder name</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
