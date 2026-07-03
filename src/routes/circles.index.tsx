import { createFileRoute, Link } from '@tanstack/react-router'
import { RotateCw, Undo2, Users } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { ModeSwitch } from '#/components/ModeSwitch'
import { RoundBar } from '#/components/RoundBar'
import { RotationSchedule } from '#/components/RotationSchedule'
import { CircleMembers } from '#/components/CircleMembers'
import { formatUsd } from '#/design/chains'
import { mockCircle } from '#/lib/circle'

export const Route = createFileRoute('/circles/')({ component: CirclesHome })

// —— Demo circle (real, human — the product shown live on the landing) ——
// The roommates' savings circle: five friends, $50 a month, the pot rotates.
const DEMO = mockCircle('demo')

function CirclesHome() {
  const payee = DEMO.members.find((m) => m.isPayee)

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between">
          {/* A peer landing, not a sub-page: same wordmark-only header as `/` —
              the ModeSwitch below is the way between the two modes. */}
          <span
            className="text-lg font-semibold tracking-tight text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Rally <span className="text-muted">Circles</span>
          </span>
          {/* Static dot + honest label — this hero is representative data. */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'rgba(255,241,232,0.82)' }}
            />
            Demo
          </span>
        </div>
      }
      cta={
        <div className="flex flex-col items-center gap-3">
          <Link
            to="/circles/new"
            className="relative w-full overflow-hidden rounded-full py-4 text-center text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
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
      {/* —— The hero IS the product: a savings circle, mid-rotation —— */}
      <div className="flex flex-col gap-6 pt-4">
        {/* The same switch as the Goals landing — one tap between the modes. */}
        <ModeSwitch active="circles" />

        <div>
          <p className="text-sm text-faint">{DEMO.organizer} is running</p>
          <h1
            className="mt-1.5 text-display font-semibold text-paper"
            style={{ fontFamily: 'var(--font-display)', wordSpacing: '0.08em' }}
          >
            {DEMO.title}
          </h1>
        </div>

        {/* Hero row: the per-round liquid + a vertically-centered readout. */}
        <div className="flex items-center gap-6">
          <RoundBar
            potUsd={DEMO.potUsd}
            memberTarget={DEMO.memberTarget}
            fundedCount={DEMO.fundedCount}
            height={248}
            width={52}
          />
          <div className="flex flex-1 flex-col justify-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
              />
              Round {(DEMO.round ?? 0) + 1} of {DEMO.memberTarget}
            </span>
            <div>
              <div className="flex items-baseline gap-2.5">
                <span
                  className="tnum font-display text-figure font-semibold leading-none text-paper"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {formatUsd(DEMO.potUsd)}
                </span>
                <span
                  className="tnum font-display text-2xl font-semibold leading-none"
                  style={{ color: 'rgba(255,240,233,0.72)' }}
                >
                  pot
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {DEMO.fundedCount} of {DEMO.memberTarget} in ·{' '}
                <span className="font-medium text-paper/90">{formatUsd(DEMO.depositUsd)}</span> each
              </p>
            </div>
            {payee && (
              <div className="mt-1 flex flex-col gap-1 text-[13px] text-muted">
                <span>
                  This round’s pot → <span className="font-semibold text-paper">{payee.name}</span>
                </span>
                <span className="text-faint">round closes in 9 days</span>
              </div>
            )}
          </div>
        </div>

        <RotationSchedule rounds={DEMO.rounds} />

        <CircleMembers members={DEMO.members} status={DEMO.status} depositUsd={DEMO.depositUsd} />

        {/* The concept, in three lines — placed after you've SEEN it work. */}
        <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          {[
            { Icon: Users, text: 'Everyone chips in the same amount, every round.' },
            { Icon: RotateCw, text: 'Each round, one member takes the whole pot. The turn rotates.' },
            { Icon: Undo2, text: 'Anyone misses a round? The circle stops and everyone’s refunded.' },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              {/* Same icon-chip anatomy as the Circles row on the Goals landing. */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <Icon size={16} strokeWidth={2.25} style={{ color: 'var(--color-rally-500)' }} />
              </span>
              <p className="text-[13px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>

        {/* This hero is a demo. The real thing is live on-chain — go see it. */}
        <Link
          to="/circle/$id"
          params={{ id: '1' }}
          className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-sm transition-colors hover:border-white/15"
        >
          {/* No dot here — the header pill is this screen's one status lamp,
              and the sentence already says "live on Arbitrum" in words. */}
          <span className="text-muted">See a real circle, rotating live on Arbitrum</span>
          <span className="font-semibold text-paper">→</span>
        </Link>
      </div>
    </AppShell>
  )
}
