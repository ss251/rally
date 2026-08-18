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
import { fetchNewestOpenCampaign, type CampaignView } from '#/lib/campaign'

export const Route = createFileRoute('/')({
  loader: async (): Promise<CampaignView | null> => {
    try {
      return await fetchNewestOpenCampaign()
    } catch {
      return null
    }
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
  const canChip = c != null && c.status === 'live' && !c.withdrawn

  return (
    <>
      <AppShell
        header={
          <div className="flex w-full items-center justify-between">
            <Brand />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(255,241,232,0.82)' }} />
              {c?.live ? 'Live on Arbitrum' : 'Arbitrum Sepolia'}
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col items-center gap-3">
            {canChip ? (
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
            ) : (
              <Link
                to="/create"
                className="relative flex w-full items-center justify-center overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.97]"
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
                Start a rally
              </Link>
            )}
            {canChip ? (
              <Link
                to="/create"
                className="text-sm font-medium text-muted transition-colors hover:text-paper"
              >
                or start your own rally →
              </Link>
            ) : (
              <Link
                to="/c/$id"
                params={{ id: '1' }}
                className="text-sm font-medium text-muted transition-colors hover:text-paper"
              >
                or see a past rally →
              </Link>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6 pt-4">
          <ModeSwitch active="goals" />
          {c ? <OpenHero c={c} now={now} /> : <EmptyHero />}
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

      {c && canChip && (
        <ContributeSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          campaignTitle={c.title}
          campaignId={c.id}
          initialAmount={25}
          onContributed={() => router.invalidate()}
        />
      )}
    </>
  )
}

function OpenHero({ c, now }: { c: CampaignView; now: number | null }) {
  const animatedRaised = useCountUp(c.raised)
  const displayRaised = Math.round(animatedRaised * 100) / 100
  const realPct = pct(displayRaised, c.goal, 9999)
  const cd = now == null ? null : countdown(c.deadline, now)
  const funded = c.status === 'funded'

  return (
    <>
      <div>
        <p className="text-sm text-faint">{c.organizer} is rallying for</p>
        <h1
          className="mt-1.5 text-display font-semibold text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {c.title}
        </h1>
      </div>

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

      <Link
        to="/c/$id"
        params={{ id: c.id }}
        className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-sm transition-colors hover:border-white/15"
      >
        <span className="text-muted">
          {c.live
            ? 'This bar is on-chain — open the full rally'
            : 'Open the full rally page'}
        </span>
        <span className="font-semibold text-paper">→</span>
      </Link>
    </>
  )
}

function EmptyHero() {
  return (
    <div className="flex flex-col items-center gap-5 pt-6 text-center">
      <div
        aria-hidden
        className="border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        style={{ width: 48, height: 168, borderRadius: 'var(--radius-tube)' }}
      />
      <div>
        <h1
          className="text-display font-semibold text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          No rally is filling right now
        </h1>
        <p className="mx-auto mt-2.5 max-w-[19rem] text-sm leading-relaxed text-muted">
          Every pot on-chain is closed or already paid out. Start the next one — one link, one goal,
          everyone in.
        </p>
      </div>
    </div>
  )
}
