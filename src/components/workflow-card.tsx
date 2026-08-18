import { Trash2 } from "lucide-react"
import type { Workflow } from "@/lib/workflow-registry"
import { cn } from "@/lib/utils"

interface WorkflowCardProps {
  workflow: Workflow
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

export function WorkflowCard({ workflow, onClick, onDelete }: WorkflowCardProps) {
  const isAres = workflow.type === "ares"

  return (
    <div
      onClick={onClick}
      className={cn(
        "group absolute inset-0 flex flex-col items-center justify-center gap-3",
        "bg-card text-card-foreground rounded-2xl border border-border p-4 shadow-sm",
        "transition-colors duration-200 hover:border-foreground/20 hover:bg-secondary"
      )}
    >
      <img
        src={isAres ? "/branding/Ares.png?v=2" : "/branding/Libraicon.png?v=2"}
        alt={isAres ? "Ares pipeline" : "Libra pipeline"}
        className="h-16 w-auto object-contain"
        key={isAres ? "ares-png" : "libra-png"}
      />
      <span className="text-sm font-medium text-card-foreground truncate max-w-full px-2 text-center">
        {workflow.name}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {isAres ? "Single" : "Bulk"}
        {workflow.sorting ? ` · ${workflow.sorting}` : ""}
      </span>
      <button
        type="button"
        aria-label={`Delete ${workflow.name}`}
        onClick={onDelete}
        className="absolute top-2 right-2 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
