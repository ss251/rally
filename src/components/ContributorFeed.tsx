import { useEffect, useRef, useState } from 'react'
import {
  ACCENT,
  CHAIN_META,
  avatarGradient,
  formatUsd,
  initials,
  timeAgo,
  type Chain,
  type Skin,
} from '#/design/chains'
import { ChainIcon } from './ChainIcon'

export interface Contributor {
  id: string
  name: string
  avatarUrl?: string
  /** Whole USDC units. */
  amount: number
  chain: Chain
  /** Optional gift note — surfaced prominently in the Potluck skin. */
  note?: string
  /** Epoch ms. */
  timestamp: number
}

interface ContributorFeedProps {
  contributors: Contributor[]
  skin?: Skin
  /** Cap the rows shown; the rest collapse into a "+N more" footer. */
  maxVisible?: number
  className?: string
}

/** Client-only ticking clock (avoids SSR hydration mismatch on relative time). */
function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Small pill showing which chain the USDC arrived from (CCTP source). */
function ChainBadge({ chain }: { chain: Chain }) {
  const m = CHAIN_META[chain]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-1.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: m.color, background: `${m.color}1f` }}
    >
      <ChainIcon chain={chain} size={13} />
      {m.short}
    </span>
  )
}

function Avatar({ c }: { c: Contributor }) {
  if (c.avatarUrl) {
    return (
      <img
        src={c.avatarUrl}
        alt={c.name}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
      />
    )
  }
  const g = avatarGradient(c.name)
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
      aria-hidden="true"
    >
      {initials(c.name)}
    </span>
  )
}

/**
 * The live named feed beside the thermometer — "who's chipping in, and from
 * which chain." Newly arrived rows spring in from the top; the newest row gets
 * an accent glow so the eye catches it. In the Potluck skin, gift notes read
 * as the primary content.
 *
 * Presentational only — pass a `contributors` array (newest first is fine; the
 * component sorts by timestamp).
 */
export function ContributorFeed({
  contributors,
  skin = 'rally',
  maxVisible = 6,
  className,
}: ContributorFeedProps) {
  const now = useNow()
  const accent = ACCENT[skin]
  const isPotluck = skin === 'potluck'

  const sorted = [...contributors].sort((a, b) => b.timestamp - a.timestamp)
  const visible = sorted.slice(0, maxVisible)
  const overflow = sorted.length - visible.length

  // Track which ids are freshly arrived to animate only them.
  const seen = useRef<Set<string>>(new Set())
  const [enteredThisPass, setEntered] = useState<Set<string>>(new Set())
  useEffect(() => {
    const fresh = new Set<string>()
    for (const c of visible) {
      if (!seen.current.has(c.id)) {
        fresh.add(c.id)
        seen.current.add(c.id)
      }
    }
    if (fresh.size) setEntered(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributors])

  const topId = visible[0]?.id

  return (
    <section className={`flex flex-col ${className ?? ''}`} aria-label="Contributors">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-paper">
          <span
            className="animate-pulse-dot h-2 w-2 rounded-full"
            style={{ background: accent.solid, color: accent.solid }}
          />
          {isPotluck ? 'Gifts landing' : 'Live from the group'}
        </h3>
        <span className="tnum text-xs text-faint">
          {sorted.length} {sorted.length === 1 ? 'backer' : 'backers'}
        </span>
      </header>

      <ul className="flex flex-col gap-2">
        {visible.map((c) => {
          const fresh = enteredThisPass.has(c.id)
          const isTop = c.id === topId
          return (
            <li
              key={c.id}
              className={`flex items-center gap-3 rounded-2xl border p-2.5 pr-3.5 transition-colors ${
                fresh ? 'animate-slide-in' : ''
              }`}
              style={{
                borderColor: isTop ? 'rgba(255,255,255,0.14)' : 'var(--color-line)',
                background: isTop
                  ? `linear-gradient(90deg, ${accent.solid}1a, var(--color-surface) 58%)`
                  : 'var(--color-surface)',
                // A coral left-rail that hugs the rounded corners (not a full
                // ring) + a hairline top highlight — marks the newest row.
                boxShadow: isTop
                  ? `inset 3px 0 0 ${accent.solid}, inset 0 1px 0 rgba(255,255,255,0.05)`
                  : undefined,
              }}
            >
              <Avatar c={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-paper">{c.name}</span>
                  <ChainBadge chain={c.chain} />
                </div>
                {isPotluck && c.note ? (
                  <p className="truncate text-xs text-muted">“{c.note}”</p>
                ) : (
                  <p className="text-xs text-faint">
                    {now == null ? 'just now' : timeAgo(c.timestamp, now)}
                    {c.note ? <span className="text-muted"> · “{c.note}”</span> : null}
                  </p>
                )}
              </div>
              <span
                className="tnum shrink-0 text-sm font-bold"
                style={{ color: CHAIN_META[c.chain].color }}
              >
                +{formatUsd(c.amount)}
              </span>
            </li>
          )
        })}
      </ul>

      {overflow > 0 && (
        <p className="mt-3 text-center text-xs text-faint">
          + {overflow} more {overflow === 1 ? 'backer' : 'backers'}
        </p>
      )}
    </section>
  )
}

export default ContributorFeed
