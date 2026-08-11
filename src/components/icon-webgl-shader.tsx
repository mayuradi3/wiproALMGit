"use client"

import { useEffect, useId, useRef } from "react"
import type { ReactNode } from "react"
import { ShaderMount, liquidMetalFragmentShader } from "@paper-design/shaders"

type IconWebglShaderProps = {
  size?: number
  strokeWidth?: number
  iconSize?: number
  iconColor?: string
  innerTop?: string
  innerBottom?: string
  icon?: ReactNode
}

export function IconWebglShader({
  size = 220,
  strokeWidth = 3,
  iconSize = 72,
  iconColor = "#8a8a8a",
  innerTop = "#1c1c1c",
  innerBottom = "#000000",
  icon,
}: IconWebglShaderProps) {
  const shaderRef = useRef<HTMLDivElement>(null)
  const maskId = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const radius = size / 2
  const ringRadius = radius - strokeWidth / 2

  useEffect(() => {
    const el = shaderRef.current
    if (!el) return
    const mount = new ShaderMount(
      el,
      liquidMetalFragmentShader,
      {
        u_repetition: 1.6,
        u_softness: 0.45,
        u_scale: 1.6,
        u_angle: 120,
        u_shiftRed: 0.35,
        u_shiftBlue: 0.35,
        u_distortion: 0,
        u_contour: 0,
        u_shape: 1,
        u_offsetX: 0.1,
        u_offsetY: -0.1,
      },
      undefined,
      1
    )
    return () => mount?.dispose()
  }, [])

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-block",
      }}
    >
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="black" />
            <circle
              cx={radius}
              cy={radius}
              r={ringRadius}
              fill="none"
              stroke="white"
              strokeWidth={strokeWidth}
            />
          </mask>
        </defs>
      </svg>
      <div
        ref={shaderRef}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          filter: "contrast(1.4) brightness(1.2)",
          WebkitMask: `url(#${maskId})`,
          mask: `url(#${maskId})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: strokeWidth,
          borderRadius: "50%",
          background: `linear-gradient(180deg, ${innerTop}, ${innerBottom})`,
          boxShadow:
            "inset 0 1px 4px rgba(255,255,255,0.1), inset 0 -6px 12px rgba(0,0,0,0.6)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: iconSize,
          height: iconSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {icon}
      </div>
    </div>
  )
}

export function PlusIcon({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
