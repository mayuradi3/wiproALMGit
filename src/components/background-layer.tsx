"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

export function BackgroundLayer() {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const previousPath = useRef(pathname)

  const isHome = pathname === "/"
  const isAres = pathname === "/pipeline/ares"

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const wasHome = previousPath.current === "/"
    const isPipeline = pathname.startsWith("/pipeline/")
    const fromHomeToPipeline = wasHome && isPipeline

    if (fromHomeToPipeline) {
      // Freeze at final opacity so there's no transition when leaving home
      el.style.opacity = "0.25"
      el.style.animation = "none"
    } else if (isHome && previousPath.current !== "/") {
      // Returning home: restart the fade-in animation
      el.style.opacity = ""
      el.style.animation = "none"
      void el.offsetWidth
      el.style.animation = ""
    }

    previousPath.current = pathname
  }, [pathname, isHome])

  if (isAres) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none bg-logo"
      data-animate={isHome}
    />
  )
}
