import { useEffect, useRef, useState } from 'react'

// The money figure rises with the SAME curve as the liquid pour, so the number
// and the tube read as one physical beat. --ease-rally = cubic-bezier(0.22, 1,
// 0.36, 1) (expo-out); we solve that Bézier for x→y so the count is eased on
// the identical curve, not a lookalike.
function makeCubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const solveX = (x: number) => {
    let t = x
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - x
      const d = (3 * ax * t + 2 * bx) * t + cx
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    return Math.min(1, Math.max(0, t))
  }
  return (x: number) => sampleY(solveX(x))
}

const easeRally = makeCubicBezier(0.22, 1, 0.36, 1)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * Count a displayed number from its previous value up to `target` over ~700ms
 * on the Rally ease — used so the hero money figure and percent RISE in the
 * same window the tube pours, instead of snapping on a loader re-read.
 *
 * Presentational only. Animates on an INCREASE; snaps on a decrease, on first
 * paint, and whenever the OS asks for reduced motion. Returns the current
 * (possibly fractional) value — round it for whole-dollar display.
 */
export function useCountUp(target: number, opts?: { durationMs?: number }): number {
  const durationMs = opts?.durationMs ?? 700
  const [value, setValue] = useState(target)
  // The last value actually painted — a new target animates FROM here, so a
  // mid-flight loader re-read continues from where the digits currently sit.
  const valueRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = valueRef.current
    // Snap: reduced motion, first paint, or anything that isn't a rise.
    if (prefersReducedMotion() || target <= from) {
      valueRef.current = target
      setValue(target)
      return
    }
    const delta = target - from
    let start = 0
    const tick = (ts: number) => {
      if (!start) start = ts
      const t = Math.min(1, (ts - start) / durationMs)
      const next = t >= 1 ? target : from + delta * easeRally(t)
      valueRef.current = next
      setValue(next)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  return value
}
