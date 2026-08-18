"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

export function BackgroundLayer() {
  const pathname = usePathname()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<
    { x: number; y: number; baseX: number; baseY: number; vx: number; vy: number; color: string }[]
  >([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const frameRef = useRef<number | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [particleCount, setParticleCount] = useState(0)

  const isHome = pathname === "/"
  const isAres = pathname === "/pipeline/ares"

  useEffect(() => {
    if (isAres) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    let cancelled = false
    const img = new Image()
    img.src = "/branding/PARI.png"

    img.onload = () => {
      if (cancelled) return
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const width = rect.width
      const height = rect.height

      ctx.clearRect(0, 0, width, height)

      const imageAspect = img.naturalWidth / img.naturalHeight
      const viewportAspect = width / height
      let drawWidth: number
      let drawHeight: number
      if (viewportAspect > imageAspect) {
        drawHeight = height * 1.5
        drawWidth = drawHeight * imageAspect
      } else {
        drawWidth = width * 1.5
        drawHeight = drawWidth / imageAspect
      }
      const drawX = (width - drawWidth) / 2
      const drawY = (height - drawHeight) / 2

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      const maxParticles = 22000
      const spacing = Math.max(2, Math.floor(Math.sqrt((canvas.width * canvas.height) / (maxParticles * 1.6))))

      const candidates: { x: number; y: number; r: number; g: number; b: number }[] = []
      for (let y = 0; y < canvas.height; y += spacing) {
        for (let x = 0; x < canvas.width; x += spacing) {
          const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4
          const alpha = pixels[index + 3]
          if (alpha > 128) {
            candidates.push({ x: Math.floor(x), y: Math.floor(y), r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] })
          }
        }
      }

      const particles: { x: number; y: number; baseX: number; baseY: number; vx: number; vy: number; color: string }[] = []
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i]
        const px = c.x / dpr
        const py = c.y / dpr
        particles.push({ x: px, y: py, baseX: px, baseY: py, vx: 0, vy: 0, color: `rgb(${c.r}, ${c.g}, ${c.b})` })
      }

      particlesRef.current = particles
      setParticleCount(particles.length)
      setReady(true)
    }

    return () => {
      cancelled = true
    }
  }, [isAres])

  useEffect(() => {
    if (!ready || isAres) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    const onMouseMove = (e: MouseEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (!canvasRect) return
      mouseRef.current = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top }
    }
    const onMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseleave", onMouseLeave)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const mouse = mouseRef.current
      const particles = particlesRef.current

      const activeRadius = 100
      const activeRadiusSq = activeRadius * activeRadius
      const repelStrength = 2.0
      const springStrength = 0.04
      const damping = 0.95

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const distanceSq = dx * dx + dy * dy

        if (distanceSq < activeRadiusSq && distanceSq > 0) {
          const distance = Math.sqrt(distanceSq)
          const force = (activeRadius - distance) / activeRadius
          const invDistance = 1 / distance
          p.vx -= dx * invDistance * force * repelStrength
          p.vy -= dy * invDistance * force * repelStrength
        }

        p.vx += (p.baseX - p.x) * springStrength
        p.vy += (p.baseY - p.y) * springStrength

        p.vx *= damping
        p.vy *= damping

        p.x += p.vx
        p.y += p.vy

        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      frameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      window.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseleave", onMouseLeave)
    }
  }, [ready, isAres])

  if (isAres) return null

  return (
    <div aria-hidden="true" className="fixed inset-0 z-[1] overflow-hidden pointer-events-none">
      <motion.canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHome ? 0.35 : 0.18 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  )
}
