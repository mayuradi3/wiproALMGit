import type { Workflow, WorkflowType, SortingRule } from "@/lib/workflow-registry"

const LOCALSTORAGE_KEY = "alm-workflows"

function readRegistryBrowser(): Workflow[] {
  if (typeof window === "undefined") return []
  try {
    const data = window.localStorage.getItem(LOCALSTORAGE_KEY)
    return data ? (JSON.parse(data) as Workflow[]) : []
  } catch {
    return []
  }
}

function writeRegistryBrowser(workflows: Workflow[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(workflows))
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

export async function listWorkflows(): Promise<Workflow[]> {
  try {
    return readRegistryBrowser()
  } catch (err) {
    console.error("listWorkflows failed:", err)
    return []
  }
}

export async function createWorkflow(
  name: string,
  type: WorkflowType,
  sorting?: "Sorted" | "Unsorted",
  listed?: SortingRule[],
  unlisted?: SortingRule
): Promise<Workflow> {
  const workflows = await listWorkflows()
  const id = makeId()
  const workflow: Workflow = {
    id,
    name: name.trim(),
    type,
    sorting,
    listed,
    unlisted,
    createdAt: Date.now(),
  }
  workflows.unshift(workflow)
  try {
    writeRegistryBrowser(workflows)
  } catch (err) {
    console.error("createWorkflow write failed:", err)
    throw err
  }
  return workflow
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const workflows = await listWorkflows()
    return workflows.find((w) => w.id === id) ?? null
  } catch (err) {
    console.error("getWorkflow failed:", err)
    return null
  }
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  try {
    const workflows = await listWorkflows()
    const idx = workflows.findIndex((w) => w.id === id)
    if (idx === -1) return false
    workflows.splice(idx, 1)
    writeRegistryBrowser(workflows)
    return true
  } catch (err) {
    console.error("deleteWorkflow failed:", err)
    return false
  }
}

export async function updateWorkflowRules(
  id: string,
  listed: SortingRule[],
  unlisted: SortingRule | undefined
): Promise<boolean> {
  try {
    const workflows = await listWorkflows()
    const idx = workflows.findIndex((w) => w.id === id)
    if (idx === -1) return false

    workflows[idx] = {
      ...workflows[idx],
      sorting: "Sorted",
      listed,
      unlisted,
    }
    writeRegistryBrowser(workflows)
    return true
  } catch (err) {
    console.error("updateWorkflowRules failed:", err)
    return false
  }
}
