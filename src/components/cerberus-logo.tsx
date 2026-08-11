"use client"

import { motion } from "framer-motion"

type CerberusLogoProps = {
  className?: string
  size?: number
}

export function CerberusLogo({ className = "", size = 22 }: CerberusLogoProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ width: size, height: size }}
    >
      <img
        src="/cerberus-logo.png"
        alt="Cerberus"
        width={size}
        height={size}
        className="block"
        draggable={false}
      />
    </motion.div>
  )
}
