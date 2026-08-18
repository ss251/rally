import { createFileRoute, Link } from '@tanstack/react-router'
import { RotateCw, Undo2, Users } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { Brand } from '#/components/Brand'
import { ModeSwitch } from '#/components/ModeSwitch'
import { RoundBar } from '#/components/RoundBar'
import { RotationSchedule } from '#/components/RotationSchedule'
import { CircleMembers } from '#/components/CircleMembers'
import { formatUsd } from '#/design/chains'
import { fetchLiveCircle, type CircleView } from '#/lib/circle'

export const Route = createFileRoute('/circles/')({
  loader: async (): Promise<{ featured: CircleView | null }> => {
    const two = await fetchLiveCircle('2').catch(() => null)
    const one = two ? null : await fetchLiveCircle('1').catch(() => null)
    return { featured: two ?? one }
  },
  component: CirclesHome,
})

function CirclesHome() {
  const { featured } = Route.useLoaderData()
  const live = featured?.live === true
  const payee = featured?.members.find((m) => m.isPayee)

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between">
          <Brand sub="Circles" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'rgba(255,241,232,0.82)' }}
            />
            {live ? 'Live on Arbitrum' : 'Arbitrum Sepolia'}
          </span>
        </div>
      }
      cta={
        <div className="flex flex-col items-center gap-3">
          <Link
            to="/circles/new"
            className="relative w-full overflow-hidden rounded-full py-4 text-center text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.97]"
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
            Start a circle
          </Link>
          <Link to="/" className="text-sm font-medium text-muted transition-colors hover:text-paper">
            or rally around a goal →
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <ModeSwitch active="circles" />

        {featured ? (
          <LiveCircleHero c={featured} payeeName={payee?.name} />
        ) : (
          <EmptyCircleHero />
        )}

        <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          {[
            { Icon: Users, text: 'Everyone chips in the same amount, every round.' },
            { Icon: RotateCw, text: 'Each round, one member takes the whole pot. The turn rotates.' },
            { Icon: Undo2, text: 'Anyone misses a round? The circle stops and everyone’s refunded.' },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <Icon size={16} strokeWidth={2.25} className="text-muted" />
              </span>
              <p className="text-[13px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  )
}

function LiveCircleHero({ c, payeeName }: { c: CircleView; payeeName?: string }) {
  const pulse =
    c.status === 'broken'
      ? 'Stopped — everyone’s made whole'
      : c.status === 'filling'
        ? `Filling seats — ${c.joined} of ${c.memberTarget}`
        : c.status === 'completed'
          ? 'Every pot paid'
          : `Round ${(c.round ?? 0) + 1} of ${c.memberTarget}`

  return (
    <>
      <div>
        <p className="text-sm text-faint">{c.organizer} is running</p>
        <h1
          className="mt-1.5 text-display font-semibold text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {c.title}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <RoundBar
          potUsd={c.potUsd}
          memberTarget={c.memberTarget}
          fundedCount={c.status === 'filling' ? c.joined : c.fundedCount}
          broken={c.status === 'broken'}
          height={248}
          width={52}
        />
        <div className="flex flex-1 flex-col justify-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${c.status === 'broken' ? '' : 'animate-pulse-dot'}`}
              style={{
                background: c.status === 'broken' ? 'rgba(168,159,180,0.85)' : 'rgba(255,241,232,0.82)',
              }}
            />
            {pulse}
          </span>
          <div>
            <div className="flex items-baseline gap-2.5">
              <span
                className="tnum font-display text-figure font-semibold leading-none text-paper"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {formatUsd(c.potUsd)}
              </span>
              <span
                className="tnum font-display text-2xl font-semibold leading-none"
                style={{ color: 'rgba(255,240,233,0.72)' }}
              >
                pot
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              {c.status === 'filling' ? (
                <>
                  {c.joined} of {c.memberTarget} seats ·{' '}
                  <span className="font-medium text-paper/90">{formatUsd(c.depositUsd)}</span> each
                </>
              ) : (
                <>
                  {c.fundedCount} of {c.memberTarget} in ·{' '}
                  <span className="font-medium text-paper/90">{formatUsd(c.depositUsd)}</span> each
                </>
              )}
            </p>
          </div>
          {c.status === 'active' && payeeName && (
            <div className="mt-1 text-[13px] text-muted">
              This round’s pot → <span className="font-semibold text-paper">{payeeName}</span>
            </div>
          )}
        </div>
      </div>

      <RotationSchedule rounds={c.rounds} />
      <CircleMembers members={c.members} status={c.status} depositUsd={c.depositUsd} />

      <Link
        to="/circle/$id"
        params={{ id: c.id }}
        className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-sm transition-colors hover:border-white/15"
      >
        <span className="text-muted">
          {c.status === 'broken'
            ? 'This circle broke — see the refunds on-chain'
            : 'Open the full circle'}
        </span>
        <span className="font-semibold text-paper">→</span>
      </Link>
    </>
  )
}

function EmptyCircleHero() {
  return (
    <div className="flex flex-col items-center gap-4 pt-4 text-center">
      <h1
        className="text-display font-semibold text-paper"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Start the next circle
      </h1>
      <p className="mx-auto max-w-[19rem] text-sm leading-relaxed text-muted">
        A rotating pot your crew chips into together. Everyone gets a turn — or everyone is made
        whole.
      </p>
    </div>
  )
}
