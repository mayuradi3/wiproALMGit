import type { ReactNode } from "react"

interface WorkflowGridProps {
  children: ReactNode[]
  columns?: number
  gap?: number
}

export function WorkflowGrid({
  children,
  columns = 3,
  gap = 12,
}: WorkflowGridProps) {
  return (
    <div
      className="grid w-full"
      style={{
        gap,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {children.map((child, i) => (
        <div
          key={i}
          className="relative w-full min-h-[140px] overflow-hidden rounded-2xl"
        >
          {child}
        </div>
      ))}
    </div>
  )
}
