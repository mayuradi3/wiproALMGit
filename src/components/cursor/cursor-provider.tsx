import { WaterDropCursor } from "@/components/cursor/water-drop-cursor"

export function CursorProvider() {
  return (
    <WaterDropCursor
      size={26}
      tint="transparent"
      hoverTint="#6b7280"
      clickTint="#000000"
      refraction={0}
      highlight={0.95}
      fill={0}
      trailCount={4}
      trailFalloff={0.68}
      followSpeed={0.2}
      trailLag={0.74}
      mergeStrength={1.5}
      idleMotion={1}
      stretch={0.5}
      hideNativeCursor
      zIndex={99999}
    />
  )
}
