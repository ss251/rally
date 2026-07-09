import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import {
  ACCENT,
  CHAIN_META,
  CHAIN_ORDER,
  formatUsd,
  pct as pctOf,
  type CampaignStatus,
  type Chain,
  type ChainSegment,
  type Skin,
} from '#/design/chains'
import { Confetti } from './Confetti'
import { LiquidColumn } from './LiquidColumn'

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
  /** Tube width in px (vertical only). */
  width?: number
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
  width = 44,
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
  // Interior scale ticks are opt-in only — full-width lines compete with the
  // crisp chain seams and can be misread as band boundaries. The etched goal
  // line at 100% is the reference the instrument actually needs.
  const ticks = showTicks === true

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

  const liquidBands = bands.map((b) => ({ from: b.from, to: b.to, grow: b.grow }))
  // Surface color = the band riding the meniscus. Vertical stacks band[0] (Base)
  // at the top so it maps to the legend; horizontal fills to the last band.
  const surfaceColor = vertical
    ? (bands[0]?.to ?? accent.to)
    : (bands[bands.length - 1]?.to ?? accent.to)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

  // Pour the liquid when new money lands: bump `pourKey` (drives the settle-and-
  // overshoot rise in LiquidColumn) and remember the exact color of the chain
  // that grew, so the entering slug pours in that chain's color.
  const prevRaised = useRef(raised)
  const prevPct = useRef(realPct)
  const prevSeg = useRef(segments)
  const pourColor = useRef(surfaceColor)
  const [pourKey, setPourKey] = useState(0)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    const grew = raised > prevRaised.current
    const crossed = prevPct.current < 100 && realPct >= 100
    if (grew) {
      // Which chain contributed the most new money since last render?
      const before = new Map((prevSeg.current ?? []).map((s) => [s.chain, s.amount]))
      let grewChain: Chain | null = null
      let bestDelta = 0
      for (const s of segments ?? []) {
        const d = s.amount - (before.get(s.chain) ?? 0)
        if (d > bestDelta) {
          bestDelta = d
          grewChain = s.chain
        }
      }
      pourColor.current = grewChain ? CHAIN_META[grewChain].to : surfaceColor
      setPourKey((k) => k + 1)
      if (crossed) {
        setBurst(true)
        onGoalReached?.()
      }
    }
    prevRaised.current = raised
    prevPct.current = realPct
    prevSeg.current = segments
  }, [raised, realPct, segments, surfaceColor, onGoalReached])

  // The glass tube itself.
  const tube = (
    <div
      className="relative overflow-hidden border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      style={{
        borderRadius: 'var(--radius-tube)',
        ...(vertical
          ? { width, height, minHeight: 120 }
          : { width: '100%', height: 22 }),
      }}
      role="progressbar"
      aria-valuenow={realPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${formatUsd(raised)} of ${formatUsd(goal)} ${currency} raised, ${realPct}%`}
    >
      <div className="absolute inset-0">
        <LiquidColumn
          width={vertical ? width : 320}
          height={vertical ? height : 22}
          fillPct={fillPct}
          bands={liquidBands}
          topColor={surfaceColor}
          pourColor={pourColor.current}
          pourKey={pourKey}
          reducedMotion={reducedMotion}
          orientation={vertical ? 'vertical' : 'horizontal'}
        />
      </div>

      {/* Ticks — a quiet measurement scale on the glass. */}
      {ticks &&
        [25, 50, 75].map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute left-0 right-0 h-px bg-white/[0.07]"
            style={{ bottom: `${t}%` }}
          />
        ))}

      {/* Etched goal line: a hairline tick at 100% with the goal figure, so the
          fill has a verifiable destination. Vertical only (the tube's top). */}
      {vertical && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute left-1.5 right-1.5 top-[9px] h-px bg-white/25"
          />
          <span
            aria-hidden
            className="tnum pointer-events-none absolute inset-x-0 top-[13px] text-center text-[8.5px] font-semibold leading-none tracking-wide text-white/45"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {formatUsd(goal)}
          </span>
        </>
      )}
    </div>
  )

  if (!showReadout) {
    // No outer bloom: glass refracts light inward, it doesn't emit a halo. The
    // tube reads as a solid machined object, lit from within by the crisp liquid
    // + a single specular streak — not floating in coral fog.
    return (
      <div className={`relative ${className ?? ''}`}>
        <div className="relative">{tube}</div>
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
            // Quiet win chip — coral stays reserved for the CTA even in victory.
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.1] px-2.5 py-1 text-xs font-semibold text-paper">
              <Check size={13} strokeWidth={3} /> Goal met
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              {/* Warm-white heartbeat — status is never painted in the CTA color. */}
              <span
                className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
                style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
              />
              {skin === 'potluck' ? 'Collecting now' : 'Raising now'}
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
              style={{ color: 'rgba(255,240,233,0.72)' }}
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
