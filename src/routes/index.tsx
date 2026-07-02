import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { ContributeSheet } from '#/components/ContributeSheet'
import { Thermometer } from '#/components/Thermometer'
import { ContributorFeed, type Contributor } from '#/components/ContributorFeed'
import { ChainIcon } from '#/components/ChainIcon'
import { formatUsd, type ChainSegment } from '#/design/chains'

export const Route = createFileRoute('/')({ component: Home })

// —— Demo campaign (real, human — the product shown live on the landing) ——
const RAISED = 3120
const GOAL = 4000
const SEGMENTS: ChainSegment[] = [
  { chain: 'base', amount: 1400 },
  { chain: 'arbitrum', amount: 720 },
  { chain: 'optimism', amount: 400 },
  { chain: 'solana', amount: 600 },
]
const now = Date.now()
const CONTRIBUTORS: Contributor[] = [
  { id: 'a', name: 'Maya', amount: 250, chain: 'base', timestamp: now - 90_000 },
  { id: 'b', name: 'Tomás', amount: 40, chain: 'solana', timestamp: now - 240_000 },
  { id: 'c', name: 'Priya', amount: 120, chain: 'arbitrum', timestamp: now - 600_000 },
  { id: 'd', name: 'Wei', amount: 60, chain: 'optimism', timestamp: now - 1_500_000 },
]

function Home() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <AppShell
        header={
          <div className="flex w-full items-center justify-between">
            <span
              className="text-lg font-semibold tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rally
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-faint">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: 'rgba(255,241,232,0.82)' }} />
              Arbitrum testnet
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setSheetOpen(true)}
              className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
              style={{
                background:
                  'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
              />
              Chip in $25
            </button>
            <Link
              to="/create"
              className="text-sm font-medium text-muted transition-colors hover:text-paper"
            >
              or start your own rally →
            </Link>
          </div>
        }
      >
        {/* —— The hero IS the product: a live campaign, filling —— */}
        <div className="flex flex-col gap-6 pt-4">
          <div>
            <p className="text-sm text-faint">Maya is rallying for</p>
            <h1
              className="mt-1.5 text-[2.15rem] font-semibold leading-[1.04] tracking-[-0.01em] text-paper"
              style={{ fontFamily: 'var(--font-display)', wordSpacing: '0.08em' }}
            >
              Send the crew to Tokyo
            </h1>
          </div>

          {/* Hero row: the liquid column + a vertically-centered readout (no void) */}
          <div className="flex items-center gap-6">
            <Thermometer
              raised={RAISED}
              goal={GOAL}
              segments={SEGMENTS}
              orientation="vertical"
              height={248}
              width={52}
              status="live"
              showReadout={false}
            />
            <div className="flex flex-1 flex-col justify-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: 'rgba(255,241,232,0.82)' }} />
                Raising now
              </span>
              <div>
                <div className="flex items-end gap-2.5">
                  <span
                    className="tnum font-display text-figure font-semibold leading-none text-paper"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {formatUsd(RAISED)}
                  </span>
                  <span
                    className="tnum font-display text-2xl font-semibold leading-none"
                    style={{ color: 'rgba(255,240,233,0.72)' }}
                  >
                    78%
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  of <span className="font-medium text-paper/90">{formatUsd(GOAL)}</span> USDC goal
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {SEGMENTS.map((s) => (
                  <span key={s.chain} className="flex items-center gap-2 text-[13px] text-muted">
                    <ChainIcon chain={s.chain} size={16} />
                    <span className="capitalize text-paper/80">{s.chain}</span>
                    <span className="tnum ml-auto text-faint">{formatUsd(s.amount)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                <span className="font-medium text-paper">23 backers</span>
                <span className="text-faint">·</span>
                <span>2 days left</span>
              </div>
            </div>
          </div>

          <ContributorFeed contributors={CONTRIBUTORS} maxVisible={4} />

          {/* This hero is a demo. The real thing is live on-chain — go see it. */}
          <Link
            to="/c/$id"
            params={{ id: '1' }}
            className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-sm transition-colors hover:border-white/15"
          >
            <span className="flex items-center gap-2 text-muted">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: 'rgba(255,241,232,0.82)' }} />
              See a real rally, filling live on Arbitrum
            </span>
            <span className="font-semibold text-paper">→</span>
          </Link>

          {/* The second shape of group money: Pools fill toward a goal;
              Circles rotate a pot through the crew. Same promise underneath —
              it pays out in full, or everyone's made whole. */}
          <Link
            to="/circles"
            className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 transition-colors hover:border-white/15"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <RotateCw size={16} strokeWidth={2.25} style={{ color: 'var(--color-rally-500)' }} />
              </span>
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-paper">
                  Circles
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--color-rally-500)', background: 'rgba(255,122,80,0.12)' }}
                  >
                    New
                  </span>
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-faint">
                  A savings pot that rotates through the crew, round by round
                </span>
              </span>
            </span>
            <span className="font-semibold text-paper">→</span>
          </Link>
        </div>
      </AppShell>

      <ContributeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        campaignTitle="the Tokyo fund"
        fromChain="base"
        initialAmount={25}
      />
    </>
  )
}
