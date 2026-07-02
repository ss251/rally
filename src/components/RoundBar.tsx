import { useEffect, useMemo, useRef, useState } from 'react'
import { formatUsd } from '#/design/chains'
import { LiquidColumn, type LiquidBand } from './LiquidColumn'

interface RoundBarProps {
  /** The rotating pot — depositUsd × memberTarget (the bar's "goal"). */
  potUsd: number
  /** Rotation size N — the tube is divided into N seat slots. */
  memberTarget: number
  /** Members who have funded the CURRENT round (fills fundedCount/N). */
  fundedCount: number
  /** Broken circles drain the warmth out of the liquid. */
  broken?: boolean
  height?: number
  width?: number
  className?: string
}

// Two adjacent coral tones so each member's slug reads as its own pour —
// the hairline meniscus seams between bands become "N people are in" marks.
// Circles' liquid is deliberately WARM (the brand accent), not chain-colored:
// a circle is one pot of shared money, not a cross-chain composition.
const SLUG_A = { from: '#FFB579', to: '#FF8A55' }
const SLUG_B = { from: '#FF9A5B', to: '#FF7A50' }
// Broken: the same liquid gone cold — desaturated plum, still legible.
const SLUG_BROKEN_A = { from: '#8d8298', to: '#7a7086' }
const SLUG_BROKEN_B = { from: '#837890', to: '#6f6579' }

/**
 * The Circles signature: the SAME glass instrument as the Pools thermometer,
 * re-tasked as a per-round meter. The tube is etched into N seat slots; each
 * member's chip-in pours one warm slug of liquid, and the pot figure at the
 * top is what unlocks when the liquid reaches it. Every round it drains and
 * refills — the rotation made visceral. Reuses LiquidColumn for the pour
 * physics; the chrome mirrors Thermometer's tube exactly.
 */
export function RoundBar({
  potUsd,
  memberTarget,
  fundedCount,
  broken = false,
  height = 248,
  width = 52,
  className,
}: RoundBarProps) {
  const n = Math.max(1, memberTarget)
  const funded = Math.max(0, Math.min(fundedCount, n))
  const fillPct = (funded / n) * 100

  const bands = useMemo<LiquidBand[]>(() => {
    if (funded === 0) return [{ ...(broken ? SLUG_BROKEN_A : SLUG_A), grow: 1 }]
    return Array.from({ length: funded }, (_, i) => ({
      ...(broken
        ? i % 2 === 0
          ? SLUG_BROKEN_A
          : SLUG_BROKEN_B
        : i % 2 === 0
          ? SLUG_A
          : SLUG_B),
      grow: 1,
    }))
  }, [funded, broken])

  const surface = broken ? SLUG_BROKEN_A.to : SLUG_A.to

  // Pour when someone new chips in this round (mirrors Thermometer's pourKey).
  const prevFunded = useRef(funded)
  const [pourKey, setPourKey] = useState(0)
  useEffect(() => {
    if (funded > prevFunded.current) setPourKey((k) => k + 1)
    prevFunded.current = funded
  }, [funded])

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

  return (
    <div className={`relative ${className ?? ''}`}>
      <div
        className="relative overflow-hidden border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        style={{ borderRadius: 'var(--radius-tube)', width, height, minHeight: 120 }}
        role="progressbar"
        aria-valuenow={funded}
        aria-valuemin={0}
        aria-valuemax={n}
        aria-label={`${funded} of ${n} members have chipped in this round; the pot is ${formatUsd(potUsd)}`}
      >
        <div className="absolute inset-0">
          <LiquidColumn
            width={width}
            height={height}
            fillPct={fillPct}
            bands={bands}
            topColor={surface}
            pourColor={surface}
            pourKey={pourKey}
            reducedMotion={reducedMotion}
            orientation="vertical"
          />
        </div>

        {/* Seat slots: one etched hairline per member boundary. Unlike the
            Pools tube (where interior ticks are opt-out noise), these ARE the
            instrument — each gap is a seat the liquid has to fill. */}
        {Array.from({ length: n - 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute left-1.5 right-1.5 h-px bg-white/[0.09]"
            style={{ bottom: `${((i + 1) / n) * 100}%` }}
          />
        ))}

        {/* Etched pot line at the top — the destination figure. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1.5 right-1.5 top-[9px] h-px bg-white/25"
        />
        <span
          aria-hidden
          className="tnum pointer-events-none absolute inset-x-0 top-[13px] text-center text-[8.5px] font-semibold leading-none tracking-wide text-white/45"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatUsd(potUsd)}
        </span>
      </div>
    </div>
  )
}

export default RoundBar
