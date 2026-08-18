"use client"

import { motion } from "framer-motion"
import type { CSSProperties } from "react"

type AmbientBackgroundProps = {
  baseColor?: string
  color1?: string
  color2?: string
  color3?: string
  blurAmount?: number
  speedMultiplier?: number
  overlayOpacity?: number
  colorDuration?: number
}

export function AmbientBackground({
  baseColor = "#ffffff",
  color1 = "rgba(177, 200, 214, 0.35)",
  color2 = "rgba(229, 229, 230, 0.35)",
  color3 = "rgba(95, 96, 100, 0.25)",
  blurAmount = 60,
  speedMultiplier = 1,
  overlayOpacity = 0.1,
  colorDuration = 10,
}: AmbientBackgroundProps) {
  return (
    <div
      style={{
        ...containerStyle,
        backgroundColor: baseColor,
      }}
    >
      <motion.div
        style={{
          ...blobStyle,
          backgroundColor: color1,
          width: "80%",
          height: "80%",
          top: "10%",
          left: "10%",
        }}
        animate={{
          x: [-30, 30],
          y: [-30, 30],
          scale: [1, 1.1],
          backgroundColor: [color1, color2, color3],
        }}
        transition={{
          default: {
            duration: 7 * speedMultiplier,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          },
          backgroundColor: {
            duration: colorDuration,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          },
        }}
      />
      <motion.div
        style={{
          ...blobStyle,
          backgroundColor: color2,
          width: "70%",
          height: "70%",
          top: "15%",
          right: "15%",
        }}
        animate={{
          x: [50, -50],
          y: [100, -20],
          backgroundColor: [color2, color3, color1],
        }}
        transition={{
          default: {
            duration: 5 * speedMultiplier,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          },
          backgroundColor: {
            duration: colorDuration,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          },
        }}
      />
      <motion.div
        style={{
          ...blobStyle,
          backgroundColor: color3,
          width: "60%",
          height: "60%",
          bottom: "10%",
          left: "20%",
        }}
        animate={{
          x: [-20, 80],
          y: [100, 50],
          backgroundColor: [color3, color1, color2],
        }}
        transition={{
          default: {
            duration: 6 * speedMultiplier,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          },
          backgroundColor: {
            duration: colorDuration,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          },
        }}
      />
      <div
        style={{
          ...overlayStyle,
          backdropFilter: `blur(${blurAmount}px)`,
          WebkitBackdropFilter: `blur(${blurAmount}px)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          ...overlayStyle,
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          opacity: overlayOpacity,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

const containerStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  isolation: "isolate",
}

const blobStyle: CSSProperties = {
  position: "absolute",
  borderRadius: "50%",
  opacity: 0.6,
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100%",
  height: "100%",
  zIndex: 10,
}
