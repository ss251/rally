import { useEffect, useRef } from 'react'
import { ACCENT, CHAIN_META, type Skin } from '#/design/chains'

interface ConfettiProps {
  /** Fire a burst each time this flips false → true. */
  active: boolean
  skin?: Skin
  /** Number of particles per burst. */
  particleCount?: number
  /** Called when the burst finishes animating out. */
  onDone?: () => void
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  shape: 0 | 1 // 0 = rect, 1 = circle
  life: number
}

/**
 * Zero-dependency canvas confetti. Renders nothing until `active` goes true,
 * then rains a burst tinted with the chain palette + the skin accent. Honors
 * prefers-reduced-motion (skips the animation entirely).
 *
 * Presentational only — the parent decides *when* the goal is hit.
 */
export function Confetti({ active, skin = 'rally', particleCount = 140, onDone, className }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const wasActive = useRef(false)

  useEffect(() => {
    const started = active && !wasActive.current
    wasActive.current = active
    if (!started) return

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      onDone?.()
      return
    }

    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = parent.clientWidth
    const h = parent.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)

    const palette = [
      ACCENT[skin].from,
      ACCENT[skin].to,
      CHAIN_META.base.color,
      CHAIN_META.arbitrum.color,
      CHAIN_META.optimism.color,
      CHAIN_META.solana.color,
      '#ffffff',
    ]

    // Launch from two lower corners, arc up and out (party-popper feel).
    const particles: Particle[] = Array.from({ length: particleCount }, (_, i) => {
      const fromLeft = i % 2 === 0
      const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.8
      const speed = 9 + Math.random() * 9
      return {
        x: fromLeft ? w * 0.08 : w * 0.92,
        y: h * 0.92,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        size: 5 + Math.random() * 7,
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: Math.random() > 0.5 ? 1 : 0,
        life: 0,
      }
    })

    const gravity = 0.28
    const drag = 0.985
    const maxLife = 190

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      let alive = 0
      for (const p of particles) {
        p.life += 1
        p.vx *= drag
        p.vy = p.vy * drag + gravity
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        const fade = Math.max(0, 1 - p.life / maxLife)
        if (fade <= 0 || p.y > h + 20) continue
        alive++
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 1) {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
        }
        ctx.restore()
      }
      if (alive > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, w, h)
        onDone?.()
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [active, skin, particleCount, onDone])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-30 ${className ?? ''}`}
    />
  )
}

export default Confetti
