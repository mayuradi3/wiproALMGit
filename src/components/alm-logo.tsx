"use client"

import { motion } from "framer-motion"

type AlmLogoProps = {
  className?: string
  size?: number
}

export function AlmLogo({ className = "", size = 22 }: AlmLogoProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ width: size, height: size }}
    >
      <img
        src="/branding/PARI.png"
        alt="Wipro PARI"
        width={size}
        height={size}
        className="block object-contain"
        draggable={false}
        style={{ width: size, height: size }}
      />
    </motion.div>
  )
}
