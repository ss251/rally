import { useEffect, useRef, useState } from 'react'
import {
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
  /** Epoch ms — the REAL block time when known. Absent = no age is shown;
   *  the feed never invents a time for on-chain money. */
  timestamp?: number
}

interface ContributorFeedProps {
  contributors: Contributor[]
  skin?: Skin
  /** Cap the rows shown; the rest collapse into a "+N more" footer. */
  maxVisible?: number
  /**
   * Total backer count when `contributors` is only a window of it (e.g. the
   * most recent rows of a longer on-chain log). Keeps the feed header in
   * agreement with the hero readout — one truth, two places.
   */
  totalCount?: number
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
  totalCount,
  className,
}: ContributorFeedProps) {
  const now = useNow()
  const isPotluck = skin === 'potluck'

  const sorted = [...contributors].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  const visible = sorted.slice(0, maxVisible)
  const total = Math.max(totalCount ?? 0, sorted.length)
  const overflow = total - visible.length

  // Track which ids are freshly arrived to animate only them. The FIRST pass
  // (page load) only seeds the set: firing the arrival event for every row at
  // once would signal "everything is new", which is false — the load batch
  // gets a quick staggered rise instead (see the row markup).
  const seen = useRef<Set<string>>(new Set())
  const mounted = useRef(false)
  const [enteredThisPass, setEntered] = useState<Set<string>>(new Set())
  useEffect(() => {
    const isFirst = !mounted.current
    mounted.current = true
    const fresh = new Set<string>()
    for (const c of visible) {
      if (!seen.current.has(c.id)) {
        fresh.add(c.id)
        seen.current.add(c.id)
      }
    }
    if (!isFirst && fresh.size) setEntered(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributors])

  return (
    <section className={`flex flex-col ${className ?? ''}`} aria-label="Contributors">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-paper">
          {/* Static — one pulsing dot per screen, and it belongs to the hero. */}
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: 'rgba(255,241,232,0.82)' }}
          />
          {isPotluck ? 'Gifts landing' : 'Live from the group'}
        </h3>
        <span className="tnum text-xs text-faint">
          {total} {total === 1 ? 'backer' : 'backers'}
        </span>
      </header>

      <ul className="flex flex-col gap-2">
        {visible.map((c, i) => {
          const fresh = enteredThisPass.has(c.id)
          return (
            <li
              key={c.id}
              // Two entrances, two meanings. Page load: a quick staggered rise
              // (50ms/row — the list settling into place). A LIVE arrival: the
              // arrival event — springs in warm-lit, decays to ordinary over
              // ~3s (newness is time, not a badge — roast #2).
              className={`flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pr-3.5 ${
                fresh ? 'animate-arrive' : 'animate-rise'
              }`}
              style={fresh ? undefined : { animationDelay: `${Math.min(i, 6) * 50}ms` }}
            >
              <Avatar c={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-paper">{c.name}</span>
                  <ChainBadge chain={c.chain} />
                </div>
                {isPotluck && c.note ? (
                  <p className="truncate text-xs text-muted">“{c.note}”</p>
                ) : c.timestamp != null || c.note ? (
                  // The age is shown ONLY when it's the real block time — a row
                  // with no resolvable time shows none (never an invented one).
                  <p className="text-xs text-faint">
                    {c.timestamp != null
                      ? now == null
                        ? 'just now'
                        : timeAgo(c.timestamp, now)
                      : null}
                    {c.note ? (
                      <span className="text-muted">
                        {c.timestamp != null ? ' · ' : ''}“{c.note}”
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <span className="tnum shrink-0 text-sm font-bold text-paper">
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
