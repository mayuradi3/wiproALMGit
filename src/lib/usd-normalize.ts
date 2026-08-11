/**
 * Normalizes transform/unit scaling in a USD ASCII file so the asset opens in
 * Isaac Sim with uniform scale `(1, 1, 1)`.
 *
 * This covers:
 * - `xformOp:scale`
 * - `Scale:unitsResolve` (Isaac Sim derives this from the asset's authored meters-per-unit)
 * - `metersPerUnit` metadata (forced to 1.0 so units are interpreted as meters)
 *
 * Binary USD files (.usdc / .usdz) are returned unchanged because they cannot
 * be safely edited in the browser. The caller can warn the user when that
 * happens.
 */

const SCALE_RE = /(xformOp:scale|Scale:unitsResolve)\s*=\s*\([^)]*\)/g
const METERS_PER_UNIT_RE = /(\bmetersPerUnit\b)\s*=\s*[\d.]+/g

function resetScale(_match: string, key: string): string {
  return `${key} = (1, 1, 1)`
}

function resetMetersPerUnit(_match: string, key: string): string {
  return `${key} = 1.0`
}

export function isUsdaFile(name: string): boolean {
  return name.toLowerCase().endsWith(".usda")
}

export function isUsdFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(".usd") || lower.endsWith(".usda") || lower.endsWith(".usdc") || lower.endsWith(".usdz")
}

export async function normalizeUsdScale(file: File): Promise<Blob> {
  if (!isUsdFile(file.name)) {
    return file
  }

  if (!isUsdaFile(file.name)) {
    // Binary USD cannot be safely edited here.
    return file
  }

  const text = await file.text()
  const normalized = text
    .replace(SCALE_RE, resetScale)
    .replace(METERS_PER_UNIT_RE, resetMetersPerUnit)

  return new Blob([normalized], { type: file.type || "application/octet-stream" })
}

export function normalizeUsdScaleFromText(text: string): string {
  return text
    .replace(SCALE_RE, resetScale)
    .replace(METERS_PER_UNIT_RE, resetMetersPerUnit)
}
