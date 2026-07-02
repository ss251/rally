import { useEffect, useRef } from 'react'

export interface LiquidBand {
  /** Vivid color for this chain's zone. */
  color: string
  /** Relative amount (flex-grow style weight). */
  grow: number
}

interface LiquidColumnProps {
  /** CSS px — matches the glass tube interior. */
  width: number
  height: number
  /** 0–100 target fill. */
  fillPct: number
  /** Bottom→top chain zones (order = CHAIN_ORDER). */
  bands: LiquidBand[]
  /** Glow color at the surface (top chain). */
  topColor: string
  /** Increment to trigger a wobble (e.g. contribution count). */
  bumpKey?: number
  reducedMotion?: boolean
  className?: string
}

/**
 * The signature liquid. Canvas-rendered mercury: a live wave surface, chain
 * colors poured as blended layers (readable but fluid — not a stacked bar), a
 * luminous meniscus, and a glass specular highlight. The tube around it (border,
 * bloom) is owned by <Thermometer>; this paints only the liquid.
 */
export function LiquidColumn({
  width,
  height,
  fillPct,
  bands,
  topColor,
  bumpKey = 0,
  reducedMotion = false,
  className,
}: LiquidColumnProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fillRef = useRef(0) // animated fill, rises from empty
  const bumpRef = useRef(0)
  const tRef = useRef(0)
  const rafRef = useRef(0)

  // Trigger a wobble when bumpKey changes.
  useEffect(() => {
    bumpRef.current = 1
  }, [bumpKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const total = bands.reduce((s, b) => s + b.grow, 0) || 1

    const draw = () => {
      const w = width
      const h = height
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Ease the fill toward its target (rise on mount + on change).
      const target = Math.max(0, Math.min(100, fillPct))
      if (reducedMotion) fillRef.current = target
      else fillRef.current += (target - fillRef.current) * 0.09
      const fill = fillRef.current

      const bump = bumpRef.current
      const t = tRef.current
      const surfaceY = h * (1 - fill / 100)
      if (fill < 0.4) {
        schedule()
        return
      }

      // Wave surface — two offset sines so it reads organic, amplitude lifts on bump.
      const amp = (reducedMotion ? 1.4 : 2.6) + bump * 5
      const wl = w * 1.3
      const waveAt = (x: number) =>
        surfaceY +
        Math.sin(x / wl + t) * amp +
        Math.sin(x / (wl * 0.55) - t * 1.25) * amp * 0.45

      // Liquid body path (wave top → down to bottom).
      ctx.beginPath()
      ctx.moveTo(0, h)
      ctx.lineTo(0, waveAt(0))
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, waveAt(x))
      ctx.lineTo(w, h)
      ctx.closePath()

      // Poured-layer gradient: each chain's color peaks at its zone center and
      // blends into its neighbours → fluid, not a hard stacked bar.
      const grad = ctx.createLinearGradient(0, h, 0, surfaceY)
      const add = (o: number, c: string) => grad.addColorStop(Math.max(0, Math.min(1, o)), c)
      add(0, bands[0]?.color ?? topColor)
      let cum = 0
      for (const b of bands) {
        const frac = b.grow / total
        const c = cum + frac / 2
        // A plateau per chain (color holds across the zone middle) with feathered
        // edges — each chain stays readable, boundaries still blend like liquid.
        add(c - frac * 0.3, b.color)
        add(c + frac * 0.3, b.color)
        cum += frac
      }
      add(1, bands[bands.length - 1]?.color ?? topColor)
      ctx.fillStyle = grad
      ctx.fill()

      // Clip to the liquid for the overlays.
      ctx.save()
      ctx.clip()

      // Subsurface bloom just under the surface (warmth/light from within).
      const bloom = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + h * 0.5)
      bloom.addColorStop(0, hexA(topColor, 0.55))
      bloom.addColorStop(1, hexA(topColor, 0))
      ctx.fillStyle = bloom
      ctx.fillRect(0, surfaceY, w, h * 0.5)

      // Glass specular: a soft vertical light band down the left (cylinder highlight).
      const spec = ctx.createLinearGradient(0, 0, w, 0)
      spec.addColorStop(0, 'rgba(255,255,255,0)')
      spec.addColorStop(0.16, 'rgba(255,255,255,0.24)')
      spec.addColorStop(0.34, 'rgba(255,255,255,0.05)')
      spec.addColorStop(0.62, 'rgba(255,255,255,0)')
      spec.addColorStop(0.9, 'rgba(255,255,255,0.10)') // faint right rim
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
      // a second, softer glow pass
      ctx.strokeStyle = hexA(topColor, 0.9)
      ctx.lineWidth = 3
      ctx.shadowBlur = 26
      ctx.stroke()
      ctx.restore()

      schedule()
    }

    const schedule = () => {
      if (reducedMotion) return
      tRef.current += 0.028
      if (bumpRef.current > 0.001) bumpRef.current *= 0.9
      else bumpRef.current = 0
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [width, height, fillPct, bands, topColor, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width, height, display: 'block' }}
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
