import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import {
  ACCENT,
  CHAIN_META,
  CHAIN_ORDER,
  formatUsd,
  pct as pctOf,
  type CampaignStatus,
  type ChainSegment,
  type Skin,
} from '#/design/chains'
import { Confetti } from './Confetti'

interface ThermometerProps {
  /** Total raised so far, whole USDC units. */
  raised: number
  /** Goal, whole USDC units. */
  goal: number
  /** Per-chain composition. When omitted, a single accent-gradient fill is shown. */
  segments?: ChainSegment[]
  currency?: string
  skin?: Skin
  orientation?: 'vertical' | 'horizontal'
  status?: CampaignStatus
  /** Tube height in px (vertical only). */
  height?: number
  showReadout?: boolean
  showTicks?: boolean
  /** Force the funded/celebration visuals without a live crossing. */
  celebrate?: boolean
  /** Fires once when `raised` crosses `goal` live. */
  onGoalReached?: () => void
  className?: string
}

/**
 * The signature Rally element: a glass column that fills LIVE as contributions
 * land. Each chain contributes a visible colored band, so you can literally
 * read the cross-chain composition in the mercury. New money springs the liquid
 * up with an expo-out ease; crossing the goal rains confetti.
 *
 * Presentational only — feed it `raised`/`goal`/`segments`; it owns the motion.
 */
export function Thermometer({
  raised,
  goal,
  segments,
  currency = 'USDC',
  skin = 'rally',
  orientation = 'vertical',
  status,
  height = 340,
  showReadout = true,
  showTicks,
  celebrate = false,
  onGoalReached,
  className,
}: ThermometerProps) {
  const fillPct = pctOf(raised, goal, 100) // visual cap
  const realPct = pctOf(raised, goal, 9999) // may exceed 100
  const funded = status === 'funded' || realPct >= 100
  const accent = ACCENT[skin]
  const vertical = orientation === 'vertical'
  const ticks = showTicks ?? vertical

  // Normalize + order segments; fall back to a single accent band.
  const bands = useMemo(() => {
    const total = segments?.reduce((s, x) => s + x.amount, 0) ?? 0
    if (!segments || total <= 0) {
      return [{ key: 'accent', grow: 1, from: accent.from, to: accent.to }]
    }
    return [...segments]
      .filter((s) => s.amount > 0)
      .sort((a, b) => CHAIN_ORDER.indexOf(a.chain) - CHAIN_ORDER.indexOf(b.chain))
      .map((s) => ({
        key: s.chain,
        grow: s.amount,
        from: CHAIN_META[s.chain].from,
        to: CHAIN_META[s.chain].to,
      }))
  }, [segments, accent.from, accent.to])

  const topColor = bands[bands.length - 1]?.to ?? accent.to

  // Bump the liquid when new money lands.
  const prevRaised = useRef(raised)
  const prevPct = useRef(realPct)
  const [bumping, setBumping] = useState(false)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    const grew = raised > prevRaised.current
    const crossed = prevPct.current < 100 && realPct >= 100
    if (grew) {
      setBumping(true)
      const t = setTimeout(() => setBumping(false), 620)
      if (crossed) {
        setBurst(true)
        onGoalReached?.()
      }
      prevRaised.current = raised
      prevPct.current = realPct
      return () => clearTimeout(t)
    }
    prevRaised.current = raised
    prevPct.current = realPct
  }, [raised, realPct, onGoalReached])

  // Shared fill (the stacked liquid + wave surface + shimmer).
  const fill = (
    <div
      className={`absolute overflow-hidden ${
        vertical ? 'inset-x-0 bottom-0 origin-bottom' : 'inset-y-0 left-0 origin-left'
      } ${bumping ? 'animate-bump' : ''}`}
      style={{
        [vertical ? 'height' : 'width']: `${fillPct}%`,
        transition: `${vertical ? 'height' : 'width'} 900ms var(--ease-rally)`,
        borderRadius: 'inherit',
      } as CSSProperties}
    >
      {/* Stacked per-chain bands */}
      <div className={`absolute inset-0 flex ${vertical ? 'flex-col-reverse' : 'flex-row'}`}>
        {bands.map((b) => (
          <div
            key={b.key}
            className="relative"
            style={{
              flexGrow: b.grow,
              flexBasis: 0,
              background: `linear-gradient(${vertical ? '180deg' : '90deg'}, ${b.to}, ${b.from})`,
              transition: 'flex-grow 900ms var(--ease-rally)',
            }}
          />
        ))}
      </div>

      {/* Moving shimmer sweep */}
      <div
        className="absolute inset-0 animate-shimmer mix-blend-overlay"
        style={{
          background:
            'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)',
          backgroundSize: '200% 100%',
        }}
      />

      {/* Surface: wave crest (vertical) or leading meniscus (horizontal) */}
      {vertical ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4 -translate-y-1/2">
          <div
            className="absolute inset-x-[-60%] top-0 h-8 animate-wave rounded-[45%] bg-white/25"
            style={{ boxShadow: `0 0 22px 2px ${topColor}` }}
          />
          <div className="absolute inset-x-[-60%] top-0.5 h-8 animate-wave-slow rounded-[45%] bg-white/15" />
          <div className="absolute inset-x-2 top-0 h-px bg-white/80" />
        </div>
      ) : (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-2 translate-x-1/2"
          style={{ boxShadow: `0 0 18px 3px ${topColor}`, background: 'rgba(255,255,255,0.7)' }}
        />
      )}
    </div>
  )

  // The glass tube itself.
  const tube = (
    <div
      className="relative overflow-hidden border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      style={{
        borderRadius: 'var(--radius-tube)',
        ...(vertical
          ? { width: 40, height, minHeight: 120 }
          : { width: '100%', height: 16 }),
      }}
      role="progressbar"
      aria-valuenow={realPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${formatUsd(raised)} of ${formatUsd(goal)} ${currency} raised, ${realPct}%`}
    >
      {/* Bloom behind the liquid */}
      <div
        className="pointer-events-none absolute inset-0 animate-sheen"
        style={{
          background: `radial-gradient(120% 60% at 50% ${vertical ? 100 : 50}%, ${topColor}55, transparent 70%)`,
        }}
      />
      {fill}

      {/* Ticks */}
      {ticks &&
        [25, 50, 75].map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute left-0 right-0 h-px bg-white/10"
            style={{ bottom: `${t}%` }}
          />
        ))}
    </div>
  )

  if (!showReadout) {
    return (
      <div className={`relative ${className ?? ''}`}>
        {tube}
        <Confetti active={burst} skin={skin} onDone={() => setBurst(false)} />
      </div>
    )
  }

  // Full readout layout: vertical = tube beside big figure; horizontal = figure above bar.
  return (
    <div className={`relative ${vertical ? 'flex items-stretch gap-6' : 'flex flex-col gap-3'} ${className ?? ''}`}>
      {vertical && tube}

      <div className={`flex flex-1 flex-col ${vertical ? 'justify-between py-1' : ''}`}>
        <div className="flex items-baseline gap-2">
          {funded || celebrate ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-950"
              style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
            >
              <Check size={13} strokeWidth={3} /> Goal met
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <span
                className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
                style={{ background: accent.solid, color: accent.solid }}
              />
              Raising now
            </span>
          )}
        </div>

        <div className="mt-1">
          <div className="flex items-end gap-2">
            <span
              className={`tnum font-display font-semibold leading-none ${vertical ? 'text-figure' : 'text-figure'}`}
              style={{ color: 'var(--color-paper)' }}
            >
              {formatUsd(raised)}
            </span>
            <span
              className="tnum font-display text-2xl font-semibold leading-none"
              style={{
                background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {realPct}%
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            of <span className="tnum font-medium text-paper/90">{formatUsd(goal)}</span> {currency} goal
          </p>
        </div>

        {!vertical && tube}
      </div>

      <Confetti active={burst} skin={skin} onDone={() => setBurst(false)} />
    </div>
  )
}

export default Thermometer
