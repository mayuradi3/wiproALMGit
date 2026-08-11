"use client"

import { ScrollText, CheckCircle, Clock, AlertCircle } from "lucide-react"

type LogEntry = {
  id: string
  message: string
  type: "success" | "info" | "error"
  timestamp: string
}

type ExecutionLogsProps = {
  logs: LogEntry[]
}

export function ExecutionLogs({ logs }: ExecutionLogsProps) {
  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Execution Logs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <ScrollText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Clock className="size-4 mb-2 opacity-50" />
          <span className="text-xs">No logs yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-muted/30"
            >
              {log.type === "success" ? (
                <CheckCircle className="size-3 text-emerald-500 shrink-0 mt-0.5" />
              ) : log.type === "error" ? (
                <AlertCircle className="size-3 text-destructive shrink-0 mt-0.5" />
              ) : (
                <Clock className="size-3 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-foreground truncate">{log.message}</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">
                  {log.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
