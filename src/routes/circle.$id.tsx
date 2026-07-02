import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { CircleMembers } from '#/components/CircleMembers'
import { CircleSheet, type CircleSheetMode } from '#/components/CircleSheet'
import { Confetti } from '#/components/Confetti'
import { RotationSchedule } from '#/components/RotationSchedule'
import { RoundBar } from '#/components/RoundBar'
import { ShareLink } from '#/components/ShareLink'
import { countdown, formatUsd } from '#/design/chains'
import { getMagicUser } from '#/lib/auth/magic'
import {
  fetchLiveCircle,
  inviteLinkFor,
  mockCircle,
  ROTATING_VAULT,
  ROTATING_VAULT_SHORT,
  type CircleView,
} from '#/lib/circle'
import { fillCircleRoundServerFn } from '#/lib/circle-actions'

export const Route = createFileRoute('/circle/$id')({
  // Read live from the RotatingVault on Arbitrum Sepolia; fall back to the
  // representative mock so a shared link NEVER lands on a broken screen.
  loader: async ({ params }): Promise<CircleView> => {
    const live = await fetchLiveCircle(params.id).catch(() => null)
    return live ?? mockCircle(params.id)
  },
  component: CircleDetail,
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

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

function CircleDetail() {
  const c = Route.useLoaderData()
  const router = useRouter()
  const now = useNow()

  const [sheetMode, setSheetMode] = useState<CircleSheetMode>('chip')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [you, setYou] = useState<string | null>(null)
  const [demoFilling, setDemoFilling] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [burst, setBurst] = useState(false)

  // Who's looking? (Client-only; Magic session survives reloads.)
  useEffect(() => {
    let alive = true
    getMagicUser()
      .then((u) => alive && setYou(u?.address ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const n = c.memberTarget
  const roundFunded = c.status !== 'filling' && c.fundedCount >= n
  const youMember = you
    ? (c.members.find((m) => m.address.toLowerCase() === you.toLowerCase()) ?? null)
    : null
  const payee = c.round != null ? (c.members[c.round] ?? null) : null
  const potTaken = c.round != null && c.rounds[c.round]?.state === 'claimed'
  const failedRound = c.rounds.find((r) => r.state === 'failed')
  const firstOpenSeat = c.members.find((m) => m.address === ZERO_ADDR)?.seat ?? 0
  const yourRefund = youMember?.refundableUsd ?? 0

  // Confetti when the round crosses to fully funded (live re-reads).
  const prevFunded = useRef(roundFunded)
  useEffect(() => {
    if (roundFunded && !prevFunded.current) setBurst(true)
    prevFunded.current = roundFunded
  }, [roundFunded])

  const openSheet = (mode: CircleSheetMode) => {
    setSheetMode(mode)
    setSheetOpen(true)
  }

  const demoFill = async () => {
    if (demoFilling) return
    setDemoError(null)
    setDemoFilling(true)
    try {
      await fillCircleRoundServerFn({
        data: { circleId: c.id, except: youMember ? youMember.address : undefined },
      })
      await router.invalidate()
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : 'The demo fill hit a snag — try again.')
    } finally {
      setDemoFilling(false)
    }
  }

  const cd = now != null && c.roundClosesAt != null ? countdown(c.roundClosesAt, now) : null

  // ── Pulse line + bar state per status ─────────────────────────────────────
  const pulseLabel =
    c.status === 'filling'
      ? `Filling seats — ${c.joined} of ${n}`
      : c.status === 'active'
        ? `Round ${(c.round ?? 0) + 1} of ${n}`
        : c.status === 'broken'
          ? 'Circle broken'
          : c.status === 'completed'
            ? 'Every pot paid'
            : 'Called off'
  const barCount = c.status === 'filling' ? c.joined : c.fundedCount

  // ── The context-aware primary action ──────────────────────────────────────
  const primary = (() => {
    if (!c.live) {
      return (
        <Link
          to="/circles/new"
          className="relative w-full overflow-hidden rounded-full py-4 text-center text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
          style={coralCta}
        >
          <CtaSheen />
          Start a circle like this
        </Link>
      )
    }
    if (c.status === 'filling') {
      return (
        <ShareLink
          variant="primary"
          url={inviteLinkFor(c.id, firstOpenSeat, c.title)}
          label="Invite the crew"
        />
      )
    }
    if (c.status === 'broken') {
      return (
        <button onClick={() => openSheet('refund')} className={ctaBtnClass} style={coralCta}>
          <CtaSheen />
          {yourRefund > 0 ? `Get ${formatUsd(yourRefund)} back` : 'Get refunded'}
        </button>
      )
    }
    if (c.status === 'completed') {
      return (
        <Link
          to="/circles/new"
          className="relative w-full overflow-hidden rounded-full py-4 text-center text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
          style={coralCta}
        >
          <CtaSheen />
          Start the next circle
        </Link>
      )
    }
    if (c.status === 'cancelled') {
      return <StatusPill>This circle was called off before it started</StatusPill>
    }
    // active
    if (youMember?.isPayee && roundFunded && !potTaken) {
      return (
        <button onClick={() => openSheet('claim')} className={ctaBtnClass} style={coralCta}>
          <CtaSheen />
          Claim your pot · {formatUsd(c.potUsd)}
        </button>
      )
    }
    if (!roundFunded && (!youMember || !youMember.fundedThisRound)) {
      return (
        <button onClick={() => openSheet('chip')} className={ctaBtnClass} style={coralCta}>
          <CtaSheen />
          Chip in {formatUsd(c.depositUsd)}
        </button>
      )
    }
    if (!roundFunded && youMember?.fundedThisRound) {
      return <StatusPill>You’re in this round ✓ — waiting on the others</StatusPill>
    }
    return (
      <StatusPill>
        Round funded ✓ — pot ready for {payee?.name ?? 'its payee'}
      </StatusPill>
    )
  })()

  const showDemoFill = c.live && c.status === 'active' && !roundFunded

  return (
    <>
      <AppShell
        header={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Link
                to="/circles"
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted transition-colors active:scale-95 hover:text-paper"
              >
                <ArrowLeft size={18} />
              </Link>
              <span
                className="text-lg font-semibold tracking-tight text-paper"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Rally <span className="text-muted">Circles</span>
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-faint">
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
              />
              {c.live ? 'Live on Arbitrum' : 'Circles · testnet'}
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col gap-2.5">
            {primary}
            {showDemoFill ? (
              <button
                onClick={demoFill}
                disabled={demoFilling}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {demoFilling ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> The crew is chipping in…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} strokeWidth={2.25} /> Watch the round fill — demo
                  </>
                )}
              </button>
            ) : (
              <ShareLink variant="ghost" label="Copy the link" />
            )}
            {demoError && (
              <p className="text-center text-[12.5px] leading-relaxed text-warn">{demoError}</p>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6 pt-4">
          <div>
            <p className="text-sm text-faint">{c.organizer} is running</p>
            <h1
              className="mt-1.5 text-[2.15rem] font-semibold leading-[1.04] tracking-[-0.01em] text-paper"
              style={{ fontFamily: 'var(--font-display)', wordSpacing: '0.08em' }}
            >
              {c.title}
            </h1>
          </div>

          {/* Broken: say it plainly, above the instrument. */}
          {c.status === 'broken' && (
            <div className="rounded-2xl border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.06)] px-4 py-3.5 text-[13px] leading-relaxed text-muted">
              <span className="font-semibold text-warn">
                Round {(failedRound?.index ?? 0) + 1} went unfunded, so the circle stopped.
              </span>{' '}
              Every deposit still in the pot goes back to its owner — automatically.
            </div>
          )}

          {/* Hero row: the per-round liquid + a vertically-centered readout. */}
          <div className="relative flex items-center gap-6">
            <RoundBar
              potUsd={c.potUsd}
              memberTarget={n}
              fundedCount={barCount}
              broken={c.status === 'broken'}
              height={248}
              width={52}
            />
            <div className="flex flex-1 flex-col justify-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                  style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
                />
                {pulseLabel}
              </span>
              <div>
                <div className="flex items-end gap-2.5">
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
                      {c.joined} of {n} seats filled ·{' '}
                      <span className="font-medium text-paper/90">{formatUsd(c.depositUsd)}</span>{' '}
                      each round
                    </>
                  ) : (
                    <>
                      {c.fundedCount} of {n} in this round ·{' '}
                      <span className="font-medium text-paper/90">{formatUsd(c.depositUsd)}</span>{' '}
                      each
                    </>
                  )}
                </p>
              </div>
              {c.status === 'active' && payee && (
                <div className="flex flex-col gap-1 text-[13px] text-muted">
                  <span>
                    This round’s pot →{' '}
                    <span className="font-semibold text-paper">
                      {youMember?.isPayee ? 'you ✦' : payee.name}
                    </span>
                  </span>
                  {cd != null && (
                    <span className={cd.urgent ? 'text-warn' : 'text-faint'}>
                      {cd.ended ? 'round closed' : `round closes in ${cd.label.replace(' left', '')}`}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Confetti active={burst} skin="rally" onDone={() => setBurst(false)} />
          </div>

          <RotationSchedule rounds={c.rounds} />

          <CircleMembers
            members={c.members}
            status={c.status}
            depositUsd={c.depositUsd}
            youAddress={you}
          />

          {/* Provenance: quiet, honest — this money is real + on-chain. */}
          {c.live && (
            <a
              href={`https://sepolia.arbiscan.io/address/${ROTATING_VAULT}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-faint transition-colors hover:border-white/15"
            >
              <span>
                Settled on-chain · rotating vault{' '}
                <span className="tnum text-muted">{ROTATING_VAULT_SHORT}</span>
              </span>
              <span className="text-muted">View ↗</span>
            </a>
          )}
        </div>
      </AppShell>

      <CircleSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode={sheetMode}
        circleId={c.id}
        circleTitle={c.title}
        depositUsd={c.depositUsd}
        potUsd={c.potUsd}
        refundableUsd={yourRefund}
        // The action landed on-chain — re-run the loader so the vault read
        // refreshes and the round bar pours for real.
        onDone={() => {
          router.invalidate()
          getMagicUser()
            .then((u) => setYou(u?.address ?? null))
            .catch(() => {})
        }}
      />
    </>
  )
}

// ── Shared CTA chrome (matches the app's coral primary exactly) ─────────────
const coralCta: React.CSSProperties = {
  background:
    'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
}

const ctaBtnClass =
  'relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]'

function CtaSheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
    />
  )
}

/** A quiet non-action state where the primary CTA would sit. */
function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-full border border-white/10 bg-white/[0.04] py-4 text-center text-[15px] font-semibold text-paper">
      {children}
    </div>
  )
}
