"use client"

export async function cropTo256x256(blob: Blob): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")!
  const size = Math.min(img.width, img.height)
  ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256)
  img.close()
  return new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"))
}

export async function fitToScreen(blob: Blob, margin = 0.001): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const size = Math.max(img.width, img.height)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  img.close()

  const imageData = ctx.getImageData(0, 0, size, size)
  const data = imageData.data
  let minX = size
  let minY = size
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      if (data[idx + 3] > 0) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return blob
  }

  const w = maxX - minX + 1
  const h = maxY - minY + 1
  let boxSize = Math.max(w, h)
  const marginPx = boxSize * margin
  boxSize = boxSize + marginPx * 2

  const cx = (minX + maxX + 1) / 2
  const cy = (minY + maxY + 1) / 2
  let sx = Math.floor(cx - boxSize / 2)
  let sy = Math.floor(cy - boxSize / 2)
  let sw = Math.ceil(boxSize)
  let sh = Math.ceil(boxSize)

  sx = Math.max(0, sx)
  sy = Math.max(0, sy)
  sw = Math.min(sw, size - sx)
  sh = Math.min(sh, size - sy)

  const out = document.createElement("canvas")
  out.width = size
  out.height = size
  const octx = out.getContext("2d")!
  octx.clearRect(0, 0, size, size)
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, size, size)

  return new Promise<Blob>((r) => out.toBlob((b) => r(b!), "image/png"))
}
