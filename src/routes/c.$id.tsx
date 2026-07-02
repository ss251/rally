import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { ContributeSheet } from '#/components/ContributeSheet'
import { Thermometer } from '#/components/Thermometer'
import { ContributorFeed } from '#/components/ContributorFeed'
import { ShareLink } from '#/components/ShareLink'
import { CHAIN_META, countdown, formatUsd, pct } from '#/design/chains'
import { fetchLiveCampaign, mockCampaign, type CampaignView } from '#/lib/campaign'

export const Route = createFileRoute('/c/$id')({
  // Read live from Arbitrum Sepolia; fall back to representative mock so a
  // shared link NEVER lands on a broken screen. Never throws to the boundary.
  loader: async ({ params }): Promise<CampaignView> => {
    const live = await fetchLiveCampaign(params.id).catch(() => null)
    return live ?? mockCampaign(params.id)
  },
  component: CampaignDetail,
})

/** Client-only clock so relative time / countdown never mismatches on hydration. */
function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function CampaignDetail() {
  const c = Route.useLoaderData()
  const [sheetOpen, setSheetOpen] = useState(false)
  const now = useNow()

  const realPct = pct(c.raised, c.goal, 9999)
  const cd = now == null ? null : countdown(c.deadline, now)
  const topChain = c.segments[c.segments.length - 1]?.chain ?? 'base'
  const hasBackers = c.contributors.length > 0
  const funded = c.status === 'funded'

  return (
    <>
      <AppShell
        header={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Link
                to="/"
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted transition-colors active:scale-95 hover:text-paper"
              >
                <ArrowLeft size={18} />
              </Link>
              <span
                className="text-lg font-semibold tracking-tight text-paper"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Rally
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-rally-500 animate-pulse-dot" />
              {c.live ? 'Live on Arbitrum' : 'Arbitrum testnet'}
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setSheetOpen(true)}
              className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
              style={{
                background: 'var(--color-rally-500)',
                boxShadow:
                  '0 1px 0 0 rgba(255,255,255,0.35) inset, 0 10px 34px -10px var(--color-rally-glow)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
              />
              {funded ? 'Share the win' : 'Chip in $25'}
            </button>
            <ShareLink variant="ghost" label="Copy the link" />
          </div>
        }
      >
        <div className="flex flex-col gap-6 pt-4">
          <div>
            <p className="text-sm text-faint">{c.organizer} is rallying for</p>
            <h1
              className="mt-1.5 text-[2.15rem] font-semibold leading-[1.04] tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {c.title}
            </h1>
          </div>

          {/* Hero row: the liquid column + a vertically-centered readout. */}
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
                <span
                  className="h-1.5 w-1.5 rounded-full bg-rally-500 animate-pulse-dot"
                  style={{ color: 'var(--color-rally-500)' }}
                />
                {funded ? 'Goal met' : 'Raising now'}
              </span>
              <div>
                <div className="flex items-end gap-2.5">
                  <span
                    className="tnum font-display text-figure font-semibold leading-none text-paper"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {formatUsd(c.raised)}
                  </span>
                  <span
                    className="tnum font-display text-2xl font-semibold leading-none"
                    style={{
                      background:
                        'linear-gradient(90deg, var(--color-rally-600), var(--color-rally-300))',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }}
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
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: CHAIN_META[s.chain].to }}
                      />
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
                <span className={cd?.urgent ? 'text-warn' : undefined}>
                  {cd == null ? 'open' : cd.label}
                </span>
              </div>
            </div>
          </div>

          {hasBackers ? (
            <ContributorFeed contributors={c.contributors} maxVisible={5} />
          ) : (
            <EmptyFeed />
          )}

          {/* Provenance: quiet, honest — this money is real + on-chain. */}
          {c.live && c.creator && (
            <a
              href={`https://sepolia.arbiscan.io/address/0x914e4682aD2FeBb3e00a21dB29B93c16fc080AB4`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-faint transition-colors hover:border-white/15"
            >
              <span>
                Settled on-chain · goal vault{' '}
                <span className="tnum text-muted">0x914e…0AB4</span>
              </span>
              <span className="text-muted">View ↗</span>
            </a>
          )}
        </div>
      </AppShell>

      <ContributeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        campaignTitle={c.title}
        fromChain={topChain}
      />
    </>
  )
}

/** First-run: nobody's chipped in yet. Invitation, not a void. */
function EmptyFeed() {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
      <span className="text-sm font-semibold text-paper">Be the first to chip in</span>
      <p className="max-w-[16rem] text-[13px] leading-relaxed text-faint">
        The bar fills the moment your money lands — from whatever chain you're on.
      </p>
    </section>
  )
}
