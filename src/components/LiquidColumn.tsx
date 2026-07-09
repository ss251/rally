import { useEffect, useRef, useState } from 'react'

export interface LiquidBand {
  /** Lighter top-edge tint of this chain's zone. */
  from: string
  /** Saturated base of this chain's zone. */
  to: string
  /** Relative amount (flex-grow style weight). */
  grow: number
}

interface LiquidColumnProps {
  /** CSS px — matches the glass tube interior. For horizontal this is a
   *  fallback; the true width is measured from the element (it fills its box). */
  width: number
  height: number
  /** 0–100 target fill. */
  fillPct: number
  /** Chain zones. Order = CHAIN_ORDER (base → … → solana). For VERTICAL the
   *  stack is flipped so band[0] sits at the SURFACE (top) and reads top→bottom
   *  in the same order as the legend beside it; for HORIZONTAL band[0] is the
   *  origin (left). */
  bands: LiquidBand[]
  /** Surface color (meniscus + default pour tint). */
  topColor: string
  /** Exact (normalized) color of the chain whose money just landed — the slug
   *  that pours in at the surface. Defaults to `topColor`. */
  pourColor?: string
  /** Increment to trigger a pour (settle-and-overshoot rise). */
  pourKey?: number
  reducedMotion?: boolean
  /** vertical = fills bottom→top (hero); horizontal = fills left→right (cards). */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

// Spring: mildly under-damped so the pour settles with a slight overshoot then
// rests (~400ms, ζ≈0.64, ~7% overshoot). Integrated on rAF, sub-stepped for
// stability. At rest the loop stops entirely — the instrument goes perfectly
// still (no ambient "lava lamp" wave).
const SPRING_K = 220
const SPRING_C = 19

/**
 * The signature liquid — a machined precision instrument, canvas-rendered.
 * Crisp chain bands separated by hairline meniscus seams (no gaussian bleed),
 * one convex meniscus riding the top fill, a single specular streak down the
 * glass (one implied light source), and faint glass filling the empty region so
 * the tube never reads as a hole. When money lands it POURS: the level springs
 * up with a slosh + overshoot, the entering slug tinted with that chain's exact
 * color, then goes still. The tube chrome (border, inner shadow, goal tick) is
 * owned by <Thermometer>; this paints only the liquid + glass.
 */
export function LiquidColumn({
  width,
  height,
  fillPct,
  bands,
  topColor,
  pourColor,
  pourKey = 0,
  reducedMotion = false,
  orientation = 'vertical',
  className,
}: LiquidColumnProps) {
  const horizontal = orientation === 'horizontal'
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Animation state (persists across re-renders).
  const fillRef = useRef(-1) // -1 = not yet mounted (snap on first paint)
  const velRef = useRef(0)
  const targetRef = useRef(0)
  const rippleRef = useRef(0) // decaying surface slosh amplitude (px)
  const phaseRef = useRef(0)
  const tintRef = useRef(0) // pour-slug tint alpha 0..1
  const pourFromRef = useRef(0) // fill level where the current pour began
  const pourColorRef = useRef(topColor)
  const seenPourRef = useRef(pourKey)
  const runningRef = useRef(false)
  const rafRef = useRef(0)

  // Horizontal bars fill their container — measure the real rendered width.
  const [measuredW, setMeasuredW] = useState(width)
  useEffect(() => {
    if (!horizontal) {
      setMeasuredW(width)
      return
    }
    const el = canvasRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width
      if (cw && cw > 0) setMeasuredW(cw)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [horizontal, width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = horizontal ? measuredW : width
    const h = height
    if (w <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)

    const total = bands.reduce((s, b) => s + b.grow, 0) || 1
    const visibleRef = { current: true }
    const target = Math.max(0, Math.min(100, fillPct))
    targetRef.current = target

    // First paint → snap (no entrance slosh; a precision instrument arrives set).
    if (fillRef.current < 0) fillRef.current = target

    // A new pour arrived: remember where the surface was, tint the entering slug
    // with this chain's color, kick a surface slosh.
    if (pourKey !== seenPourRef.current) {
      seenPourRef.current = pourKey
      if (!reducedMotion) {
        pourFromRef.current = fillRef.current
        pourColorRef.current = pourColor ?? topColor
        tintRef.current = 1
        rippleRef.current = horizontal ? 1.6 : 3.6
      } else {
        fillRef.current = target
      }
    }

    // ── Physics step. Returns true once fully at rest. ──────────────────────
    const stepPhysics = (): boolean => {
      if (reducedMotion) {
        fillRef.current = target
        velRef.current = rippleRef.current = tintRef.current = 0
        return true
      }
      const sub = 2
      const dt = 1 / 60 / sub
      for (let i = 0; i < sub; i++) {
        const a = -SPRING_K * (fillRef.current - target) - SPRING_C * velRef.current
        velRef.current += a * dt
        fillRef.current += velRef.current * dt
      }
      rippleRef.current *= 0.9
      if (rippleRef.current < 0.06) rippleRef.current = 0
      tintRef.current *= 0.94
      if (tintRef.current < 0.02) tintRef.current = 0
      phaseRef.current += 0.34
      const still =
        Math.abs(fillRef.current - target) < 0.04 &&
        Math.abs(velRef.current) < 0.05 &&
        rippleRef.current === 0 &&
        tintRef.current === 0
      if (still) {
        fillRef.current = target
        velRef.current = 0
      }
      return still
    }

    // ── Vertical: bottom→top fill, band[0] at the surface. ──────────────────
    const drawVertical = () => {
      const fill = fillRef.current
      const surfaceY = h * (1 - fill / 100)
      const liquidH = h - surfaceY

      // Glass everywhere: faint white so the empty region reads as a tube, plus
      // a brighter sliver at the very top rim. Kept under the inner shadow.
      const glass = ctx.createLinearGradient(0, 0, 0, h)
      glass.addColorStop(0, 'rgba(255,255,255,0.12)')
      glass.addColorStop(0.05, 'rgba(255,255,255,0.065)')
      glass.addColorStop(0.55, 'rgba(255,255,255,0.05)')
      glass.addColorStop(1, 'rgba(255,255,255,0.04)')
      ctx.fillStyle = glass
      ctx.fillRect(0, 0, w, h)

      if (liquidH < 0.5) return

      // Bottom→top stack: band[0] (e.g. Base) ends at the surface.
      const stack = [...bands].reverse() // origin(bottom) → surface(top)
      const bulge = 2.2
      const rip = rippleRef.current
      const wl = w * 0.9
      const menisc = (x: number) => {
        const nx = (x / w) * 2 - 1
        const convex = -bulge * (1 - nx * nx)
        const wave = rip
          ? Math.sin((x / wl) * Math.PI * 2 + phaseRef.current) * rip +
            Math.sin((x / (wl * 0.6)) * Math.PI * 2 - phaseRef.current * 1.3) * rip * 0.4
          : 0
        return surfaceY + convex + wave
      }

      // Liquid clip path (wavy/convex top surface).
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, h)
      ctx.lineTo(0, menisc(0))
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, menisc(x))
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.clip()

      // Crisp bands, each with its own subtle top→bottom gradient.
      let cum = 0
      const bounds: number[] = []
      stack.forEach((b, i) => {
        const frac = b.grow / total
        const yBottom = h - cum * liquidH
        const yTop = h - (cum + frac) * liquidH
        const isSurface = i === stack.length - 1
        const drawTop = isSurface ? surfaceY - bulge - 2 : yTop
        const g = ctx.createLinearGradient(0, isSurface ? surfaceY : yTop, 0, yBottom)
        g.addColorStop(0, b.from)
        g.addColorStop(1, b.to)
        ctx.fillStyle = g
        ctx.fillRect(0, drawTop, w, yBottom - drawTop + 0.5)
        if (i > 0) bounds.push(yBottom)
        cum += frac
      })

      // Liquid depth: light enters at the surface and dies toward the pool —
      // a vertical ramp over the whole column (hues untouched, only luminance).
      // This is what separates "liquid in glass" from "flat colored slab".
      const depth = ctx.createLinearGradient(0, surfaceY, 0, h)
      depth.addColorStop(0, 'rgba(255,255,255,0.12)')
      depth.addColorStop(0.3, 'rgba(255,255,255,0)')
      depth.addColorStop(0.8, 'rgba(4,2,10,0.08)')
      depth.addColorStop(1, 'rgba(4,2,10,0.2)')
      ctx.fillStyle = depth
      ctx.fillRect(0, surfaceY - bulge - 2, w, h - surfaceY + bulge + 2)

      // Sub-surface glow: a breath of the surface chain's own light just under
      // the meniscus (screen), so the instrument reads lit from within.
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const sub = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + Math.min(18, liquidH))
      sub.addColorStop(0, hexA(topColor, 0.34))
      sub.addColorStop(1, hexA(topColor, 0))
      ctx.fillStyle = sub
      ctx.fillRect(0, surfaceY - bulge, w, Math.min(18, liquidH) + bulge)
      ctx.restore()

      // Cylinder volume: the glass walls curve away — a firm edge falloff.
      const edge = ctx.createLinearGradient(0, 0, w, 0)
      edge.addColorStop(0, 'rgba(6,3,10,0.44)')
      edge.addColorStop(0.2, 'rgba(6,3,10,0)')
      edge.addColorStop(0.8, 'rgba(6,3,10,0)')
      edge.addColorStop(1, 'rgba(6,3,10,0.4)')
      ctx.fillStyle = edge
      ctx.fillRect(0, surfaceY - bulge - 2, w, h)

      // Hairline meniscus seams between chains (dark line + bright lip above).
      for (const y of bounds) {
        ctx.fillStyle = 'rgba(4,2,8,0.34)'
        ctx.fillRect(0, y - 0.5, w, 1)
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
        ctx.fillRect(0, y - 1.25, w, 0.75)
      }

      // Pour slug: tint the freshly-risen region with the contribution's color.
      if (tintRef.current > 0.02) {
        const fromY = h * (1 - pourFromRef.current / 100)
        const a = Math.min(1, 1.7 * tintRef.current) // near-opaque slug at the surface
        const tg = ctx.createLinearGradient(0, surfaceY, 0, Math.min(h, fromY + liquidH * 0.12))
        tg.addColorStop(0, hexA(pourColorRef.current, a))
        tg.addColorStop(0.55, hexA(pourColorRef.current, a * 0.55))
        tg.addColorStop(1, hexA(pourColorRef.current, 0))
        ctx.fillStyle = tg
        ctx.fillRect(0, surfaceY - bulge - 2, w, Math.max(0, fromY - surfaceY) + liquidH * 0.12 + bulge)
      }

      ctx.restore()

      // Single specular streak down the glass (one implied light, left-of-centre).
      paintSpecularV(ctx, w, h)

      // Machined rim: a 1px inner light on each glass wall, full height —
      // the refraction line that makes the tube's edge read as ground glass.
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(1, 0, 1, h)
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(w - 2, 0, 1, h)

      // Convex meniscus highlight riding the surface (crisp, no bloom).
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, menisc(0) + 1)
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, menisc(x) + 1)
      ctx.strokeStyle = hexA(topColor, 0.35)
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, menisc(0))
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, menisc(x))
      ctx.strokeStyle = 'rgba(255,255,255,0.62)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }

    // ── Horizontal: left→right fill, band[0] at the origin (left). ──────────
    const drawHorizontal = () => {
      const fill = fillRef.current
      const surfaceX = w * (fill / 100)

      // Glass base (empty tube).
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(0, 0, w, h)

      if (surfaceX < 0.5) {
        paintGlassH(ctx, w, h)
        return
      }

      const bulge = 1.4
      const rip = rippleRef.current
      const wl = h * 1.4
      const menisc = (y: number) => {
        const ny = (y / h) * 2 - 1
        const convex = bulge * (1 - ny * ny)
        const wave = rip ? Math.sin((y / wl) * Math.PI * 2 + phaseRef.current) * rip : 0
        return surfaceX + convex + wave
      }

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(menisc(0), 0)
      for (let y = 0; y <= h; y += 1) ctx.lineTo(menisc(y), y)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.clip()

      let cum = 0
      const bounds: number[] = []
      bands.forEach((b, i) => {
        const frac = b.grow / total
        const xLeft = cum * surfaceX
        const xRight = (cum + frac) * surfaceX
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, b.from)
        g.addColorStop(1, b.to)
        ctx.fillStyle = g
        ctx.fillRect(xLeft, 0, xRight - xLeft + 0.5, h)
        if (i > 0) bounds.push(xLeft)
        cum += frac
      })

      // Vertical hairline seams between chains.
      for (const x of bounds) {
        ctx.fillStyle = 'rgba(4,2,8,0.32)'
        ctx.fillRect(x - 0.5, 0, 1, h)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fillRect(x - 1.25, 0, 0.75, h)
      }

      if (tintRef.current > 0.02) {
        const fromX = w * (pourFromRef.current / 100)
        const a = Math.min(1, 1.6 * tintRef.current)
        const tg = ctx.createLinearGradient(surfaceX, 0, Math.max(0, fromX - w * 0.14), 0)
        tg.addColorStop(0, hexA(pourColorRef.current, a))
        tg.addColorStop(0.55, hexA(pourColorRef.current, a * 0.55))
        tg.addColorStop(1, hexA(pourColorRef.current, 0))
        ctx.fillStyle = tg
        ctx.fillRect(0, 0, surfaceX + bulge + 2, h)
      }
      ctx.restore()

      // Continuous cylindrical glass over the whole capsule (top sheen + curved
      // lower shade) so the slim bar reads as one glass tube, not a flat track.
      paintGlassH(ctx, w, h)

      // Leading meniscus highlight.
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(menisc(0), 0)
      for (let y = 0; y <= h; y += 1) ctx.lineTo(menisc(y), y)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (horizontal) drawHorizontal()
      else drawVertical()
    }

    const frame = () => {
      const still = stepPhysics()
      render()
      if (!still && visibleRef.current) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        runningRef.current = false
      }
    }
    const ensureRunning = () => {
      if (runningRef.current || reducedMotion) return
      runningRef.current = true
      rafRef.current = requestAnimationFrame(frame)
    }

    // Paint once for the current state; run the loop only if there's motion left.
    render()
    const atRest =
      Math.abs(fillRef.current - target) < 0.04 &&
      Math.abs(velRef.current) < 0.05 &&
      rippleRef.current === 0 &&
      tintRef.current === 0
    if (!atRest) ensureRunning()

    // Pause the loop while scrolled offscreen (cheap card feeds).
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const vis = entries[0]?.isIntersecting ?? true
          const was = visibleRef.current
          visibleRef.current = vis
          if (vis && !was) ensureRunning()
        },
        { threshold: 0 },
      )
      io.observe(canvas)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      runningRef.current = false
      io?.disconnect()
    }
  }, [horizontal, measuredW, width, height, fillPct, bands, topColor, pourColor, pourKey, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width: horizontal ? '100%' : width, height, display: 'block' }}
    />
  )
}

/** Cylinder specular: one firm light streak left of centre + a whisper of a
 *  counter-reflection near the right wall (a lit glass cylinder always has
 *  both — the second one is what tricks the eye into roundness). */
function paintSpecularV(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const spec = ctx.createLinearGradient(0, 0, w, 0)
  spec.addColorStop(0.16, 'rgba(255,255,255,0)')
  spec.addColorStop(0.28, 'rgba(255,255,255,0.28)')
  spec.addColorStop(0.4, 'rgba(255,255,255,0)')
  spec.addColorStop(0.82, 'rgba(255,255,255,0)')
  spec.addColorStop(0.9, 'rgba(255,255,255,0.08)')
  spec.addColorStop(0.97, 'rgba(255,255,255,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = spec
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** Cylindrical glass over the whole horizontal capsule: a top gloss sheen and a
 *  curved lower shade (one implied light source), so the slim bar reads round. */
function paintGlassH(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,255,255,0.18)')
  g.addColorStop(0.24, 'rgba(255,255,255,0.03)')
  g.addColorStop(0.52, 'rgba(255,255,255,0)')
  g.addColorStop(0.78, 'rgba(0,0,0,0.10)')
  g.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.save()
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** hex (#rrggbb) → rgba() string with alpha. Falls back to the hex if unparsable. */
function hexA(hex: string, a: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r},${g},${b},${a})`
}

export default LiquidColumn
