"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"

type WaterDropCursorProps = {
  size?: number
  tint?: string
  hoverTint?: string
  clickTint?: string
  refraction?: number
  highlight?: number
  fill?: number
  trailCount?: number
  trailFalloff?: number
  followSpeed?: number
  trailLag?: number
  mergeStrength?: number
  idleMotion?: number
  stretch?: number
  hideNativeCursor?: boolean
  zIndex?: number
}

function withAlpha(input: string, alpha: number): string {
  try {
    if (input.toLowerCase() === "transparent") return "transparent"
    const hex = input.replace("#", "")
    let r = 0, g = 0, b = 0, a = 1
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16)
      g = parseInt(hex[1] + hex[1], 16)
      b = parseInt(hex[2] + hex[2], 16)
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
      a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    } else {
      return input
    }
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return input
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a * alpha))})`
  } catch {
    return input
  }
}

function dropSizes(size: number, count: number, falloff: number): number[] {
  const sizes = [size]
  for (let i = 1; i <= count; i++) {
    sizes.push(Math.max(2, size * Math.pow(falloff, i)))
  }
  return sizes
}

export function WaterDropCursor({
  size = 28,
  tint = "transparent",
  hoverTint = "#6b7280",
  clickTint = "#000000",
  refraction = 4,
  highlight = 0.9,
  fill = 0.14,
  trailCount = 4,
  trailFalloff = 0.72,
  followSpeed = 0.22,
  trailLag = 0.78,
  mergeStrength = 1.25,
  idleMotion = 1,
  stretch = 0.55,
  hideNativeCursor = true,
  zIndex = 99999,
}: WaterDropCursorProps) {
  const rawId = useId()
  const gooId = "wdc-goo-" + rawId.replace(/[^a-zA-Z0-9]/g, "")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const sizes = dropSizes(size, trailCount, trailFalloff)
  const gooBlur = Math.max(0.8, size * 0.17 * mergeStrength)

  const resolveBlob = (color: string) => {
    if (color.toLowerCase() === "transparent") return "transparent"
    return `radial-gradient(circle at 50% 44%, ${withAlpha(color, 0.9)} 0%, ${withAlpha(color, 1)} 72%, ${withAlpha(color, 1)} 100%)`
  }
  const blobColor = resolveBlob(tint)
  const hoverBlobColor = resolveBlob(hoverTint)
  const clickBlobColor = resolveBlob(clickTint)

  const shadowFor = (color: string) => {
    if (color.toLowerCase() === "transparent") return "rgba(0,0,0,0.16)"
    const rgb = withAlpha(color, 1).replace("rgba(", "rgb(").replace(/, [\d.]+\)$/, ")")
    return rgb
  }

  const glassStyle = (mode: "default" | "hover" | "click"): CSSProperties => {
    const color = mode === "click" ? clickTint : mode === "hover" ? hoverTint : tint
    return {
      position: "absolute",
      left: 0,
      top: 0,
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: "50%",
      background: "transparent",
      boxShadow: [
        `0 ${size * 0.08}px ${size * 0.2}px rgba(0, 0, 0, ${mode === "default" ? 0.14 : 0.18})`,
        `0 ${size * 0.04}px ${size * 0.08}px rgba(0, 0, 0, ${mode === "default" ? 0.09 : 0.12})`,
      ].join(", "),
      willChange: "transform",
    }
  }

  const specularStyle: CSSProperties = {
    position: "absolute",
    left: "29%",
    top: "19%",
    width: "17%",
    height: "13%",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0) 100%)",
    filter: `blur(${Math.max(0.2, size * 0.012)}px)`,
    opacity: highlight,
    pointerEvents: "none",
  }

  const causticStyle: CSSProperties = {
    position: "absolute",
    left: "58%",
    top: "66%",
    width: "12%",
    height: "9%",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)",
    filter: `blur(${Math.max(0.2, size * 0.014)}px)`,
    opacity: 0.7 * highlight,
    pointerEvents: "none",
  }

  function glossStyle(s: number, mode: "default" | "hover" | "click"): CSSProperties {
    const light = mode === "click" ? 0.95 : mode === "hover" ? 0.55 : 0.65
    return {
      position: "absolute",
      left: 0,
      top: 0,
      width: s,
      height: s,
      marginLeft: -s / 2,
      marginTop: -s / 2,
      borderRadius: "50%",
      background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,${light}) 0%, rgba(255,255,255,0) 40%)`,
      boxShadow: [
        `inset 0 0 0 ${Math.max(0.4, s * 0.045)}px rgba(255,255,255,${light * 0.35})`,
        `inset 0 ${-s * 0.12}px ${s * 0.12}px ${-s * 0.06}px rgba(255,255,255,${light * 0.6})`,
      ].join(", "),
      willChange: "transform",
      pointerEvents: "none",
    }
  }

  const gooFilter = (
    <svg aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
      <defs>
        <filter id={gooId} colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={gooBlur} result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" />
        </filter>
      </defs>
    </svg>
  )

  if (!mounted || typeof document === "undefined") return null

  return createPortal(
    <CursorLayer
      gooId={gooId}
      gooFilter={gooFilter}
      glassStyle={glassStyle}
      specularStyle={specularStyle}
      causticStyle={causticStyle}
      glossStyle={glossStyle}
      blobColor={blobColor}
      hoverBlobColor={hoverBlobColor}
      clickBlobColor={clickBlobColor}
      sizes={sizes}
      followSpeed={followSpeed}
      trailLag={trailLag}
      idleMotion={idleMotion}
      stretch={stretch}
      hideNativeCursor={hideNativeCursor}
      zIndex={zIndex}
    />,
    document.body
  )
}

type CursorLayerProps = {
  gooId: string
  gooFilter: React.ReactNode
  glassStyle: (mode: "default" | "hover" | "click") => CSSProperties
  specularStyle: CSSProperties
  causticStyle: CSSProperties
  glossStyle: (s: number, mode: "default" | "hover" | "click") => CSSProperties
  blobColor: string
  hoverBlobColor: string
  clickBlobColor: string
  sizes: number[]
  followSpeed: number
  trailLag: number
  idleMotion: number
  stretch: number
  hideNativeCursor: boolean
  zIndex: number
}

function CursorLayer({
  gooId,
  gooFilter,
  glassStyle,
  specularStyle,
  causticStyle,
  glossStyle,
  blobColor,
  hoverBlobColor,
  clickBlobColor,
  sizes,
  followSpeed,
  trailLag,
  idleMotion,
  stretch,
  hideNativeCursor,
  zIndex,
}: CursorLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const blobRefs = useRef<(HTMLDivElement | null)[]>([])
  const glossRefs = useRef<(HTMLDivElement | null)[]>([])
  const glassRef = useRef<HTMLDivElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setEnabled(window.matchMedia("(pointer: fine)").matches)
  }, [])

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return
    if (!hideNativeCursor) return
    const previous = document.body.style.cursor
    document.body.style.cursor = "none"
    return () => {
      document.body.style.cursor = previous
    }
  }, [enabled, hideNativeCursor])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const idle = reduced ? 0 : idleMotion
    const stretchAmount = reduced ? 0 : stretch
    const count = sizes.length
    const nodes: { x: number; y: number }[] = []
    const startX = window.innerWidth / 2
    const startY = window.innerHeight / 2
    for (let i = 0; i < count; i++) nodes.push({ x: startX, y: startY })
    const pointer = { x: startX, y: startY }
    const vel = { x: 0, y: 0 }
    let angle = 0
    let visible = 0
    let target = 0
    let hover = 0
    let targetHover = 0
    let click = 0
    let targetClick = 0
    let last = performance.now()
    let frame = 0

    const isOverInteractive = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) return false
      const target = el.closest(
        "a, button, [role='button'], input, textarea, select, label, [tabindex], [data-cursor='hover']"
      )
      return !!target
    }

    const onMove = (e: MouseEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      target = 1
      targetHover = isOverInteractive(e) ? 1 : 0
    }
    const onLeave = () => {
      target = 0
    }
    const onEnter = () => {
      target = 1
    }
    const onDown = (e: MouseEvent) => {
      targetClick = 1
      targetHover = isOverInteractive(e) ? 1 : 0
    }
    const onUp = () => {
      targetClick = 0
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseleave", onLeave)
    document.addEventListener("mouseenter", onEnter)
    window.addEventListener("mousedown", onDown, { passive: true })
    window.addEventListener("mouseup", onUp, { passive: true })

    const tick = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000)
      last = now
      const step = dt * 60
      const smooth = (base: number) => 1 - Math.pow(1 - Math.min(0.95, base), step)

      const head = nodes[0]
      const k0 = smooth(followSpeed)
      const nx = head.x + (pointer.x - head.x) * k0
      const ny = head.y + (pointer.y - head.y) * k0
      vel.x = vel.x * 0.78 + (nx - head.x) * 0.22
      vel.y = vel.y * 0.78 + (ny - head.y) * 0.22
      head.x = nx
      head.y = ny

      for (let i = 1; i < count; i++) {
        const k = smooth(followSpeed * Math.pow(trailLag, i))
        nodes[i].x += (nodes[i - 1].x - nodes[i].x) * k
        nodes[i].y += (nodes[i - 1].y - nodes[i].y) * k
      }

      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y)
      if (speed > 0.45) angle = (Math.atan2(vel.y, vel.x) * 180) / Math.PI
      const sp = Math.min(1, speed / 26)
      const calm = 1 - sp
      const t = now / 1000

      visible += (target - visible) * smooth(0.12)
      hover += (targetHover - hover) * smooth(0.18)
      click += (targetClick - click) * smooth(0.28)
      if (layerRef.current) layerRef.current.style.opacity = String(visible)

      const mode: "default" | "hover" | "click" = click > 0.5 ? "click" : hover > 0.5 ? "hover" : "default"
      const effectiveBlobColor = mode === "click" ? clickBlobColor : mode === "hover" ? hoverBlobColor : blobColor
      const effectiveGlassStyle = glassStyle(mode)

      for (let i = 0; i < count; i++) {
        const wob = idle * 0.05 * calm
        const wx = 1 + Math.sin(t * 1.9 + i * 1.7) * wob
        const wy = 1 + Math.sin(t * 2.6 + i * 2.3 + 1.2) * wob
        const driftX = Math.sin(t * 0.8 + i * 2.1) * idle * 1.2 * calm
        const driftY = Math.cos(t * 1.05 + i * 1.4) * idle * 1.2 * calm
        const ease = 1 - i / (count + 1)
        const sx = (1 + sp * stretchAmount * ease) * wx
        const sy = (1 - sp * stretchAmount * 0.55 * ease) * wy
        const transform = `translate3d(${nodes[i].x + driftX}px, ${nodes[i].y + driftY}px, 0) rotate(${angle}deg) scale(${sx}, ${sy})`

        const blob = blobRefs.current[i]
        if (blob) {
          blob.style.transform = transform
          blob.style.background = effectiveBlobColor
          blob.style.opacity = mode === "default" && i === 0 ? "0.35" : mode === "default" ? "0.2" : i === 0 ? "1" : "0.85"
        }
        if (i === 0) {
          if (glassRef.current) {
            glassRef.current.style.transform = transform
            Object.assign(glassRef.current.style, effectiveGlassStyle)
          }
        } else {
          const gloss = glossRefs.current[i]
          if (gloss) {
            gloss.style.transform = transform
            Object.assign(gloss.style, glossStyle(sizes[i], mode))
            const dx = nodes[i].x - nodes[i - 1].x
            const dy = nodes[i].y - nodes[i - 1].y
            const gap = Math.sqrt(dx * dx + dy * dy)
            const apart = Math.min(1, gap / Math.max(1, sizes[i] * 0.85))
            gloss.style.opacity = String(apart * apart)
          }
        }
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
      document.removeEventListener("mouseenter", onEnter)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
    }
  }, [enabled, sizes, followSpeed, trailLag, idleMotion, stretch])

  if (!enabled) return null

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex,
        opacity: 0,
        contain: "strict",
      }}
    >
      {gooFilter}
      <div style={{ position: "absolute", inset: 0, filter: `url(#${gooId})`, opacity: 0.55 }}>
        {sizes.map((s, i) => (
          <div
            key={i}
            ref={(el) => {
              blobRefs.current[i] = el
            }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: s,
              height: s,
              marginLeft: -s / 2,
              marginTop: -s / 2,
              borderRadius: "50%",
              background: blobColor,
              opacity: i === 0 ? 0.35 : 0.2,
              willChange: "transform",
            }}
          />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0 }}>
        {sizes.map((s, i) =>
          i === 0 ? null : (
            <div
              key={i}
              ref={(el) => {
                glossRefs.current[i] = el
              }}
              style={glossStyle(s, "default")}
            />
          )
        )}
      </div>
      <div ref={glassRef} style={glassStyle("default")}>
        <div style={specularStyle} />
        <div style={causticStyle} />
      </div>
    </div>
  )
}
