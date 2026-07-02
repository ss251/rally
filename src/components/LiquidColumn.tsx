import { useEffect, useRef, useState } from 'react'

export interface LiquidBand {
  /** Vivid color for this chain's zone. */
  color: string
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
  /** Origin→surface chain zones (order = CHAIN_ORDER). */
  bands: LiquidBand[]
  /** Glow color at the surface (top chain). */
  topColor: string
  /** Increment to trigger a wobble (e.g. contribution count). */
  bumpKey?: number
  reducedMotion?: boolean
  /** vertical = fills bottom→top (hero); horizontal = fills left→right (cards). */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/**
 * The signature liquid. Canvas-rendered mercury: a live wave surface, chain
 * colors poured as blended layers (readable but fluid — not a stacked bar), a
 * luminous meniscus, and a glass specular highlight. The tube around it (border,
 * bloom) is owned by <Thermometer>; this paints only the liquid.
 *
 * Works in both axes so a campaign card's slim horizontal bar has the same
 * mercury quality as the hero column. Pauses its rAF when scrolled offscreen so
 * a feed of cards stays cheap.
 */
export function LiquidColumn({
  width,
  height,
  fillPct,
  bands,
  topColor,
  bumpKey = 0,
  reducedMotion = false,
  orientation = 'vertical',
  className,
}: LiquidColumnProps) {
  const horizontal = orientation === 'horizontal'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fillRef = useRef(0) // animated fill, rises from empty
  const bumpRef = useRef(0)
  const tRef = useRef(0)
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

  // Trigger a wobble when bumpKey changes.
  useEffect(() => {
    bumpRef.current = 1
  }, [bumpKey])

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

    // Poured-layer gradient shared by both axes: each chain's color peaks at its
    // zone center and feathers into its neighbours → fluid, not a stacked bar.
    const pourGradient = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      plateau = 0.3,
    ) => {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1)
      const add = (o: number, c: string) => grad.addColorStop(Math.max(0, Math.min(1, o)), c)
      add(0, bands[0]?.color ?? topColor)
      let cum = 0
      for (const b of bands) {
        const frac = b.grow / total
        const c = cum + frac / 2
        add(c - frac * plateau, b.color)
        add(c + frac * plateau, b.color)
        cum += frac
      }
      add(1, bands[bands.length - 1]?.color ?? topColor)
      return grad
    }

    const drawVertical = () => {
      const fill = fillRef.current
      const bump = bumpRef.current
      const t = tRef.current
      const surfaceY = h * (1 - fill / 100)

      const amp = (reducedMotion ? 1.4 : 2.6) + bump * 5
      const wl = w * 1.3
      const waveAt = (x: number) =>
        surfaceY +
        Math.sin(x / wl + t) * amp +
        Math.sin(x / (wl * 0.55) - t * 1.25) * amp * 0.45

      ctx.beginPath()
      ctx.moveTo(0, h)
      ctx.lineTo(0, waveAt(0))
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, waveAt(x))
      ctx.lineTo(w, h)
      ctx.closePath()

      ctx.fillStyle = pourGradient(0, h, 0, surfaceY)
      ctx.fill()

      ctx.save()
      ctx.clip()

      // Subsurface bloom just under the surface.
      const bloom = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + h * 0.5)
      bloom.addColorStop(0, hexA(topColor, 0.55))
      bloom.addColorStop(1, hexA(topColor, 0))
      ctx.fillStyle = bloom
      ctx.fillRect(0, surfaceY, w, h * 0.5)

      // Glass specular: a soft vertical light band down the left (cylinder).
      const spec = ctx.createLinearGradient(0, 0, w, 0)
      spec.addColorStop(0, 'rgba(255,255,255,0)')
      spec.addColorStop(0.16, 'rgba(255,255,255,0.24)')
      spec.addColorStop(0.34, 'rgba(255,255,255,0.05)')
      spec.addColorStop(0.62, 'rgba(255,255,255,0)')
      spec.addColorStop(0.9, 'rgba(255,255,255,0.1)')
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = spec
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()

      // Meniscus: bright, glowing rim riding the wave.
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, waveAt(0))
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, waveAt(x))
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      ctx.lineWidth = 1.6
      ctx.shadowBlur = 18
      ctx.shadowColor = topColor
      ctx.stroke()
      ctx.strokeStyle = hexA(topColor, 0.9)
      ctx.lineWidth = 3
      ctx.shadowBlur = 26
      ctx.stroke()
      ctx.restore()
    }

    const drawHorizontal = () => {
      const fill = fillRef.current
      const bump = bumpRef.current
      const t = tRef.current
      const surfaceX = w * (fill / 100)

      // Gentle vertical-edge wobble, scaled to the (short) bar height.
      const amp = (reducedMotion ? 0.5 : 1.1) + bump * 2.4
      const wl = h * 1.6
      const waveAt = (y: number) =>
        surfaceX +
        Math.sin(y / wl + t) * amp +
        Math.sin(y / (wl * 0.6) - t * 1.3) * amp * 0.4

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(waveAt(0), 0)
      for (let y = 0; y <= h; y += 1) ctx.lineTo(waveAt(y), y)
      ctx.lineTo(waveAt(h), h)
      ctx.lineTo(0, h)
      ctx.closePath()

      // Softer plateau than the tall hero column → the slim bar bleeds like
      // poured liquid instead of hard segments, while chains stay legible.
      ctx.fillStyle = pourGradient(0, 0, surfaceX, 0, 0.16)
      ctx.fill()

      ctx.save()
      ctx.clip()

      // Subsurface bloom trailing the leading edge (light from within).
      const bloomW = Math.min(surfaceX, w * 0.55)
      const bloom = ctx.createLinearGradient(surfaceX, 0, surfaceX - bloomW, 0)
      bloom.addColorStop(0, hexA(topColor, 0.5))
      bloom.addColorStop(1, hexA(topColor, 0))
      ctx.fillStyle = bloom
      ctx.fillRect(surfaceX - bloomW, 0, bloomW, h)

      // Cylindrical edge shading (source-over): darken top + bottom edges so the
      // slim bar reads as a rounded glass tube of liquid, not a flat segment.
      const shade = ctx.createLinearGradient(0, 0, 0, h)
      shade.addColorStop(0, 'rgba(8,4,12,0.42)')
      shade.addColorStop(0.24, 'rgba(8,4,12,0)')
      shade.addColorStop(0.74, 'rgba(8,4,12,0)')
      shade.addColorStop(1, 'rgba(8,4,12,0.36)')
      ctx.fillStyle = shade
      ctx.fillRect(0, 0, w, h)

      // Wet specular: a bright gloss band in the upper third (screen).
      const spec = ctx.createLinearGradient(0, 0, 0, h)
      spec.addColorStop(0, 'rgba(255,255,255,0.06)')
      spec.addColorStop(0.16, 'rgba(255,255,255,0.44)')
      spec.addColorStop(0.36, 'rgba(255,255,255,0.05)')
      spec.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = spec
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()

      // Meniscus: glowing rim riding the leading edge.
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(waveAt(0), 0)
      for (let y = 0; y <= h; y += 1) ctx.lineTo(waveAt(y), y)
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      ctx.lineWidth = 1.4
      ctx.shadowBlur = 10
      ctx.shadowColor = topColor
      ctx.stroke()
      ctx.strokeStyle = hexA(topColor, 0.9)
      ctx.lineWidth = 2.4
      ctx.shadowBlur = 16
      ctx.stroke()
      ctx.restore()
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const target = Math.max(0, Math.min(100, fillPct))
      if (reducedMotion) fillRef.current = target
      else fillRef.current += (target - fillRef.current) * 0.09

      if (fillRef.current < 0.4) {
        schedule()
        return
      }

      if (horizontal) drawHorizontal()
      else drawVertical()

      schedule()
    }

    const schedule = () => {
      if (reducedMotion || !visibleRef.current) return
      tRef.current += 0.028
      if (bumpRef.current > 0.001) bumpRef.current *= 0.9
      else bumpRef.current = 0
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    // Pause the loop while the bar is scrolled offscreen (cheap card feeds).
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const vis = entries[0]?.isIntersecting ?? true
          const was = visibleRef.current
          visibleRef.current = vis
          if (vis && !was) schedule()
        },
        { threshold: 0 },
      )
      io.observe(canvas)
    }

    draw()
    return () => {
      cancelAnimationFrame(rafRef.current)
      io?.disconnect()
    }
  }, [horizontal, measuredW, width, height, fillPct, bands, topColor, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width: horizontal ? '100%' : width, height, display: 'block' }}
    />
  )
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
