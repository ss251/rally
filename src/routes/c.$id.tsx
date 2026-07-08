import { useEffect, useState } from 'react'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Gift } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { Brand } from '#/components/Brand'
import { ContributeSheet } from '#/components/ContributeSheet'
import { Thermometer } from '#/components/Thermometer'
import { ContributorFeed } from '#/components/ContributorFeed'
import { ShareLink } from '#/components/ShareLink'
import { ChainIcon } from '#/components/ChainIcon'
import { ACCENT, countdown, formatUsd, pct, type Skin } from '#/design/chains'
import { useCountUp } from '#/design/useCountUp'
import { loadCampaign, mockPotluckCampaign, type CampaignView } from '#/lib/campaign'

export const Route = createFileRoute('/c/$id')({
  // `?skin=potluck` re-themes the SAME screen as a group gift (festive accent +
  // gift-note feed). It's a preview skin, so it renders representative data.
  validateSearch: (search: Record<string, unknown>): { skin?: 'potluck' } =>
    search.skin === 'potluck' ? { skin: 'potluck' } : {},
  // Read live from Arbitrum Sepolia. A campaign that provably doesn't exist
  // gets a real not-found screen (never someone else's numbers, never a
  // chip-in that funds a different fund). The representative mock remains
  // ONLY as the transient-RPC-failure fallback for KNOWN ids, so a shared
  // link to a real fund never lands on a broken screen.
  loader: async ({ params }): Promise<CampaignView> => {
    const load = await loadCampaign(params.id)
    if (load.kind === 'not-found') throw notFound()
    return load.view
  },
  notFoundComponent: CampaignNotFound,
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
  const loaded = Route.useLoaderData()
  const { skin: skinParam } = Route.useSearch()
  const skin: Skin = skinParam === 'potluck' ? 'potluck' : 'rally'
  const isPotluck = skin === 'potluck'
  // Potluck is a preview theme over representative data; Rally reads live.
  const c = isPotluck ? mockPotluckCampaign(loaded.id) : loaded
  const accent = ACCENT[skin]
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const now = useNow()

  // Same synchronized "pour" beat as the landing: on a chip-in the loader
  // re-reads and the hero money + percent RISE over ~700ms while the tube pours,
  // instead of snapping. The percent is derived from the animating figure so
  // both climb together; the Thermometer still gets the real c.raised.
  const animatedRaised = useCountUp(c.raised)
  const displayRaised = Math.round(animatedRaised)
  const realPct = pct(displayRaised, c.goal, 9999)
  const cd = now == null ? null : countdown(c.deadline, now)
  const topChain = c.segments[c.segments.length - 1]?.chain ?? 'base'
  const hasBackers = c.contributors.length > 0
  const funded = c.status === 'funded'
  const ctaLabel = isPotluck
    ? funded
      ? 'Share the joy'
      : 'Add to the gift'
    : funded
      ? 'Share the win'
      : 'Chip in $25'

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
              <Brand />
            </div>
            {/* Static dot; two-word status vocabulary: Demo | Live on Arbitrum. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'rgba(255,241,232,0.82)' }}
              />
              {!isPotluck && c.live ? 'Live on Arbitrum' : 'Demo'}
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setSheetOpen(true)}
              className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
              style={{
                background: isPotluck
                  ? 'linear-gradient(180deg, #ff7db0, #ff5c9a 58%, #f0457f)'
                  : 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
              />
              {ctaLabel}
            </button>
            <ShareLink variant="ghost" label="Copy the link" />
          </div>
        }
      >
        <div className="flex flex-col gap-6 pt-4">
          <div>
            {isPotluck && (
              <span
                className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-950"
                style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
              >
                <Gift size={12} strokeWidth={2.5} /> Group gift
              </span>
            )}
            <p className="text-sm text-faint">
              {c.organizer} {isPotluck ? 'is collecting for' : 'is rallying for'}
            </p>
            <h1
              className="mt-1.5 text-display font-semibold text-paper"
              style={{ fontFamily: 'var(--font-display)', wordSpacing: '0.08em' }}
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
              skin={skin}
              orientation="vertical"
              height={248}
              width={52}
              status={c.status}
              showReadout={false}
            />
            <div className="flex flex-1 flex-col justify-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                  style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
                />
                {isPotluck
                  ? funded
                    ? 'Fully funded'
                    : 'Collecting gifts'
                  : funded
                    ? 'Goal met'
                    : 'Raising now'}
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
                      <ChainIcon chain={s.chain} size={16} />
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

          {hasBackers ? (
            <ContributorFeed
              contributors={c.contributors}
              totalCount={c.backerCount}
              skin={skin}
              maxVisible={5}
            />
          ) : (
            <EmptyFeed />
          )}

          {/* Provenance: quiet, honest — this money is real + on-chain. */}
          {c.live && c.creator && (
            <a
              href={`https://sepolia.arbiscan.io/address/0x914e4682aD2FeBb3e00a21dB29B93c16fc080AB4`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-faint transition-colors hover:border-white/15"
            >
              {/* One line at 393pt: the address never breaks mid-hex. */}
              <span className="min-w-0 truncate">
                Settled on-chain · vault{' '}
                <span className="tnum whitespace-nowrap text-muted">0x914e…0AB4</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted">View ↗</span>
            </a>
          )}
        </div>
      </AppShell>

      <ContributeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        campaignTitle={c.title}
        campaignId={c.id}
        fromChain={topChain}
        initialAmount={25}
        // A real contribution just landed on-chain — re-run the loader so the
        // GoalVault read refreshes and the thermometer rises for real.
        onContributed={() => router.invalidate()}
      />
    </>
  )
}

/**
 * Unknown campaign id — a designed dead end, not a fake fund. An empty glass
 * tube (nothing has ever poured in here) and one honest invitation: this
 * rally doesn't exist yet, so start it.
 */
function CampaignNotFound() {
  return (
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
            <Brand />
          </div>
        </div>
      }
      cta={
        <div className="flex flex-col gap-2.5">
          <Link
            to="/create"
            className="relative flex w-full items-center justify-center overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
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
          <Link
            to="/c/$id"
            params={{ id: '1' }}
            className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-center text-base font-semibold text-paper transition-transform active:scale-[0.98]"
          >
            See one filling live →
          </Link>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-6 pt-14 text-center">
        {/* An empty glass tube — no goal etched, because no fund lives here. */}
        <div
          aria-hidden
          className="border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
          style={{ width: 48, height: 200, borderRadius: 'var(--radius-tube)' }}
        />
        <div>
          <h1
            className="text-display font-semibold text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            This rally doesn’t exist yet
          </h1>
          <p className="mx-auto mt-2.5 max-w-[19rem] text-sm leading-relaxed text-muted">
            No fund lives at this link — check the address, or be the one who
            starts it. One link, one goal, everyone in.
          </p>
        </div>
      </div>
    </AppShell>
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
