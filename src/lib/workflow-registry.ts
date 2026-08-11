export type WorkflowType = "bulk" | "ares"

export const REGEX_TYPES = [
  "contains",
  "starts with",
  "ends with",
  "equals",
  "regex",
] as const

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

export type Workflow = {
  id: string
  name: string
  type: WorkflowType
  sorting?: "Sorted" | "Unsorted"
  listed?: SortingRule[]
  unlisted?: SortingRule
  createdAt: number
}
