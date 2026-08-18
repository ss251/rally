import { useEffect, useState } from 'react'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Gift, Loader2 } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { Brand } from '#/components/Brand'
import { ContributeSheet } from '#/components/ContributeSheet'
import { Thermometer } from '#/components/Thermometer'
import { ContributorFeed } from '#/components/ContributorFeed'
import { ShareLink } from '#/components/ShareLink'
import { ChainIcon } from '#/components/ChainIcon'
import { ACCENT, countdown, formatUsd, pct, type Skin } from '#/design/chains'
import { useCountUp } from '#/design/useCountUp'
import { loginWithEmail } from '#/lib/auth/magic'
import { settleCampaignServerFn } from '#/lib/campaign-actions'
import { loadCampaign, mockPotluckCampaign, type CampaignView } from '#/lib/campaign'

export const Route = createFileRoute('/c/$id')({
  validateSearch: (search: Record<string, unknown>): { skin?: 'potluck' } =>
    search.skin === 'potluck' ? { skin: 'potluck' } : {},
  loader: async ({ params }): Promise<CampaignView> => {
    const load = await loadCampaign(params.id)
    if (load.kind === 'not-found') throw notFound()
    return load.view
  },
  notFoundComponent: CampaignNotFound,
  component: CampaignDetail,
})

function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function statusLabel(c: CampaignView, isPotluck: boolean, funded: boolean): string {
  if (isPotluck) return funded ? 'Fully funded' : 'Collecting gifts'
  if (c.withdrawn) return 'Paid out'
  if (c.status === 'funded') return 'Goal met — ready to collect'
  if (c.status === 'missed') return 'Missed — refunds open'
  return 'Raising now'
}

function CampaignDetail() {
  const loaded = Route.useLoaderData()
  const { skin: skinParam } = Route.useSearch()
  const skin: Skin = skinParam === 'potluck' ? 'potluck' : 'rally'
  const isPotluck = skin === 'potluck'
  const c = isPotluck ? mockPotluckCampaign(loaded.id) : loaded
  const accent = ACCENT[skin]
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const now = useNow()

  const animatedRaised = useCountUp(c.raised)
  const displayRaised = Math.round(animatedRaised * 100) / 100
  const realPct = pct(displayRaised, c.goal, 9999)
  const cd = now == null ? null : countdown(c.deadline, now)
  const hasBackers = c.contributors.length > 0
  const funded = c.status === 'funded'
  const canChip = isPotluck || (c.status === 'live' && !c.withdrawn)
  const canWithdraw = !isPotluck && c.status === 'funded' && !c.withdrawn
  const canRefund = !isPotluck && c.status === 'missed' && !c.withdrawn && c.raised > 0

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
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted transition-[color,background-color,transform] duration-150 ease-[var(--ease-rally)] active:scale-95 hover:text-paper"
              >
                <ArrowLeft size={18} />
              </Link>
              <Brand />
            </div>
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
            {canChip ? (
              <button
                onClick={() => setSheetOpen(true)}
                className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.97]"
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
            ) : canWithdraw ? (
              <SettleButton
                label={`Collect ${formatUsd(c.raised)}`}
                action="withdraw"
                campaignId={c.id}
                onDone={() => router.invalidate()}
              />
            ) : canRefund ? (
              <SettleButton
                label="Get your refund"
                action="refund"
                campaignId={c.id}
                onDone={() => router.invalidate()}
              />
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
                  className={`h-1.5 w-1.5 rounded-full ${c.status === 'live' ? 'animate-pulse-dot' : ''}`}
                  style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
                />
                {statusLabel(c, isPotluck, funded)}
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

          {hasBackers ? (
            <ContributorFeed
              contributors={c.contributors}
              totalCount={c.backerCount}
              skin={skin}
              maxVisible={5}
            />
          ) : (
            <EmptyFeed live={c.status === 'live'} />
          )}

          {c.live && c.creator && (
            <a
              href={`https://sepolia.arbiscan.io/address/0x914e4682aD2FeBb3e00a21dB29B93c16fc080AB4`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-faint transition-colors hover:border-white/15"
            >
              <span className="min-w-0 truncate">
                Settled on-chain · vault{' '}
                <span className="tnum whitespace-nowrap text-muted">0x914e…0AB4</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted">View ↗</span>
            </a>
          )}
        </div>
      </AppShell>

      {canChip && (
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

function SettleButton({
  label,
  action,
  campaignId,
  onDone,
}: {
  label: string
  action: 'withdraw' | 'refund'
  campaignId: string
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [needEmail, setNeedEmail] = useState(action === 'refund')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      if (action === 'refund') {
        if (!/.+@.+\..+/.test(email)) {
          setNeedEmail(true)
          setBusy(false)
          return
        }
        const user = await loginWithEmail(email)
        await settleCampaignServerFn({
          data: { campaignId, action: 'refund', backer: user.address },
        })
      } else {
        await settleCampaignServerFn({ data: { campaignId, action: 'withdraw' } })
      }
      onDone()
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      setError(
        raw.includes('NothingToRefund')
          ? 'Nothing left to refund for this email.'
          : raw.includes('AlreadyWithdrawn')
            ? 'This pot was already collected.'
            : raw.includes('GoalNotReached')
              ? 'The goal hasn’t been met yet.'
              : 'Couldn’t settle this pot — try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {action === 'refund' && needEmail && (
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="the email you chipped in with"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-paper outline-none placeholder:text-faint focus:border-white/30"
        />
      )}
      <button
        onClick={run}
        disabled={busy}
        className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.97] disabled:opacity-70"
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
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={18} className="animate-spin [animation-duration:0.6s]" />
            {action === 'refund' ? 'Checking your email…' : 'Collecting…'}
          </span>
        ) : (
          label
        )}
      </button>
      {error && <p className="text-center text-[13px] font-medium leading-relaxed text-warn">{error}</p>}
    </div>
  )
}

function CampaignNotFound() {
  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted transition-[color,background-color,transform] duration-150 ease-[var(--ease-rally)] active:scale-95 hover:text-paper"
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
          <Link
            to="/"
            className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-center text-base font-semibold text-paper transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.98]"
          >
            Back to Rally
          </Link>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-6 pt-14 text-center">
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

function EmptyFeed({ live }: { live: boolean }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
      <span className="text-sm font-semibold text-paper">
        {live ? 'Be the first to chip in' : 'No one chipped in'}
      </span>
      <p className="max-w-[16rem] text-[13px] leading-relaxed text-faint">
        {live
          ? 'The bar fills the moment your money lands — from whatever chain you’re on.'
          : 'This pot closed without a contribution.'}
      </p>
    </section>
  )
}
