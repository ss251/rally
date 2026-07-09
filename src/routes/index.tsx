import { useEffect, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { Brand } from '#/components/Brand'
import { ContributeSheet } from '#/components/ContributeSheet'
import { ModeSwitch } from '#/components/ModeSwitch'
import { Thermometer } from '#/components/Thermometer'
import { ContributorFeed } from '#/components/ContributorFeed'
import { ChainIcon } from '#/components/ChainIcon'
import { countdown, formatUsd, pct } from '#/design/chains'
import { useCountUp } from '#/design/useCountUp'
import { loadCampaign, mockCampaign, type CampaignView } from '#/lib/campaign'

// The landing hero IS the product: the live on-chain campaign, filling. The
// bar a visitor sees here is the same bar their "Chip in" raises — same id,
// same loader, same read as /c/1. No staged numbers.
const HERO_CAMPAIGN_ID = '1'

export const Route = createFileRoute('/')({
  loader: async (): Promise<CampaignView> => {
    const load = await loadCampaign(HERO_CAMPAIGN_ID)
    return load.kind === 'view' ? load.view : mockCampaign(HERO_CAMPAIGN_ID)
  },
  component: Home,
})

/** Client-only clock so the countdown never mismatches on hydration. */
function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function Home() {
  const c = Route.useLoaderData()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const now = useNow()

  // The hero money + percent RISE (not snap) when a chip-in re-runs the loader,
  // in the same ~700ms the tube pours — one synchronized "pour" beat. Derive the
  // percent from the SAME animating figure so both climb together. The real
  // c.raised still feeds the Thermometer, so the number and the liquid share the
  // window. Snaps under OS reduced-motion (see useCountUp).
  const animatedRaised = useCountUp(c.raised)
  // Keep the cents: rounding to a whole dollar here made the hero read "$16"
  // while the Base row right under it said "$16.50" — two truths on one screen.
  const displayRaised = Math.round(animatedRaised * 100) / 100
  const realPct = pct(displayRaised, c.goal, 9999)
  const cd = now == null ? null : countdown(c.deadline, now)
  const topChain = c.segments[c.segments.length - 1]?.chain ?? 'base'
  const funded = c.status === 'funded'

  return (
    <>
      <AppShell
        header={
          <div className="flex w-full items-center justify-between">
            <Brand />
            {/* Static dot — the hero's pulse is the page's single heartbeat. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(255,241,232,0.82)' }} />
              {c.live ? 'Live on Arbitrum' : 'Demo'}
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setSheetOpen(true)}
              className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.97]"
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
        {/* —— The hero IS the product: the live campaign, read off-chain —— */}
        <div className="flex flex-col gap-6 pt-4">
          {/* Both modes are the story — discoverable before any scroll. */}
          <ModeSwitch active="goals" />

          <div>
            <p className="text-sm text-faint">{c.organizer} is rallying for</p>
            <h1
              className="mt-1.5 text-display font-semibold text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {c.title}
            </h1>
          </div>

          {/* Hero row: the liquid column + a vertically-centered readout (no void) */}
          <div className="flex items-center gap-6">
            <Thermometer
              raised={c.raised}
              goal={c.goal}
              segments={c.segments}
              orientation="vertical"
              height={248}
              width={52}
              status={c.status}
              showReadout={false}
            />
            <div className="flex flex-1 flex-col justify-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                {/* Honest state: the pulse only beats when the numbers are live. */}
                {c.live && (
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: 'rgba(255,241,232,0.82)' }} />
                )}
                {c.live ? (funded ? 'Goal met' : 'Raising now') : 'Preview — reconnecting'}
              </span>
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="tnum font-display text-figure font-semibold leading-none text-paper"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {formatUsd(displayRaised)}
                  </span>
                  <span
                    className="tnum font-display text-2xl font-semibold leading-none"
                    style={{ color: 'rgba(255,240,233,0.72)' }}
                  >
                    {realPct}%
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  of <span className="font-medium text-paper/90">{formatUsd(c.goal)}</span> USDC goal
                </p>
              </div>
              {c.segments.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {c.segments.map((s) => (
                    <span key={s.chain} className="flex items-center gap-2 text-[13px] text-muted">
                      <ChainIcon chain={s.chain} size={20} contained />
                      <span className="capitalize text-paper/80">{s.chain}</span>
                      <span className="tnum ml-auto text-faint">{formatUsd(s.amount)}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                <span className="tnum font-medium text-paper">
                  {c.backerCount} {c.backerCount === 1 ? 'backer' : 'backers'}
                </span>
                <span className="text-faint">·</span>
                {/* Urgency survives the black test as weight, not only amber. */}
                <span className={cd?.urgent ? 'font-medium text-warn' : undefined}>
                  {cd == null ? 'open' : cd.label}
                </span>
              </div>
            </div>
          </div>

          <ContributorFeed
            contributors={c.contributors}
            totalCount={c.backerCount}
            maxVisible={4}
          />

          {/* The same fund, full page — share it, watch it, verify it. */}
          <Link
            to="/c/$id"
            params={{ id: HERO_CAMPAIGN_ID }}
            className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-sm transition-colors hover:border-white/15"
          >
            {/* No dot here — the header pill is this screen's one status lamp,
                and the sentence already says "on-chain" in words. */}
            <span className="text-muted">
              {c.live
                ? 'This bar is on-chain — open the full rally'
                : 'Open the full rally page'}
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
                <RotateCw size={16} strokeWidth={2.25} className="text-muted" />
              </span>
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-paper">
                  Circles
                  {/* Neutral tag — coral means "press me", and this row's press
                      target is the whole row, not the badge. */}
                  <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    New
                  </span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-faint">
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
        campaignTitle={c.title}
        campaignId={HERO_CAMPAIGN_ID}
        fromChain={topChain}
        initialAmount={25}
        // The money just landed on-chain — re-run the loader so THIS bar,
        // the one they're looking at, visibly rises.
        onContributed={() => router.invalidate()}
      />
    </>
  )
}
