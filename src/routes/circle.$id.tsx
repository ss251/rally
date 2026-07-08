import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { AppShell } from '#/components/AppShell'
import { Brand } from '#/components/Brand'
import { CircleMembers } from '#/components/CircleMembers'
import { CircleSheet, type CircleSheetMode } from '#/components/CircleSheet'
import { Confetti } from '#/components/Confetti'
import { RotationSchedule } from '#/components/RotationSchedule'
import { RoundBar } from '#/components/RoundBar'
import { ShareLink } from '#/components/ShareLink'
import { countdown, FOCUS_RING, formatUsd } from '#/design/chains'
import { useCountUp } from '#/design/useCountUp'
import { getMagicUser } from '#/lib/auth/magic'
import {
  fetchLiveCircle,
  friendlyCircleError,
  inviteLinkFor,
  mockCircle,
  ROTATING_VAULT,
  ROTATING_VAULT_SHORT,
  type CircleView,
} from '#/lib/circle'
import { fillCircleRoundServerFn } from '#/lib/circle-actions'
import {
  mintSeatInviteAsOrganizer,
  startSelfCustodiedCircle,
} from '#/lib/circle-self-custody'

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
  const [demoOpen, setDemoOpen] = useState(false)
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
  // Keep the pot figure on the same rising-count treatment as the Pool hero, so
  // any loader re-read that lands a larger pot climbs rather than snaps. (The
  // per-round beat here is carried by the RoundBar filling; the pot itself is
  // deposit × seats, steady across a round.)
  const displayPot = Math.round(useCountUp(c.potUsd))
  const roundFunded = c.status !== 'filling' && c.fundedCount >= n
  const youMember = you
    ? (c.members.find((m) => m.address.toLowerCase() === you.toLowerCase()) ?? null)
    : null
  // The organizer's wallet — for self-custodied circles this is a real person
  // (the creator), and organizer-only actions (signing invites, start) can
  // ONLY happen from their session. Relayer-organized demo circles never match.
  const youAreOrganizer =
    !!you && c.organizerAddress !== ZERO_ADDR && c.organizerAddress.toLowerCase() === you.toLowerCase()
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

  // Organizer-only: start the full circle from the ORGANIZER's own 7702 kernel
  // (start is organizer-gated on-chain — the relayer structurally can't do
  // this for a self-custodied circle).
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const startCircle = async () => {
    if (starting) return
    setStartError(null)
    setStarting(true)
    try {
      await startSelfCustodiedCircle({ circleId: c.id })
      await router.invalidate()
      setBurst(true)
    } catch (e) {
      setStartError(friendlyCircleError(e))
    } finally {
      setStarting(false)
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
          ? 'Stopped — everyone’s made whole'
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
      // Full house → only the organizer can start (organizer-gated on-chain).
      if (c.joined >= n) {
        if (youAreOrganizer) {
          return (
            <button onClick={startCircle} disabled={starting} className={ctaBtnClass} style={coralCta}>
              <CtaSheen />
              {starting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> Starting the rotation…
                </span>
              ) : (
                <>Start the circle — everyone’s in</>
              )}
            </button>
          )
        }
        return (
          <StatusPill>
            All {n} seats are in — {c.organizer} starts the rotation
          </StatusPill>
        )
      }
      // Open seats. The organizer signs invites THEMSELVES (self-custodied
      // circles carry the creator's signature in every link); everyone else
      // shares the plain link (relayer-organized circles mint on demand).
      if (youAreOrganizer) {
        return <OrganizerInviteButton circleId={c.id} seat={firstOpenSeat} title={c.title} />
      }
      return (
        <ShareLink
          variant="primary"
          url={inviteLinkFor(c.id, firstOpenSeat, c.title)}
          label="Invite the crew"
        />
      )
    }
    if (c.status === 'broken') {
      // Only promise money to someone we KNOW is owed it. A stranger (no
      // session / not a member) gets the honest verb: check, don't collect.
      return (
        <button onClick={() => openSheet('refund')} className={ctaBtnClass} style={coralCta}>
          <CtaSheen />
          {yourRefund > 0 ? `Get ${formatUsd(yourRefund)} back` : 'Check your refund'}
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
    if (potTaken) {
      return (
        <StatusPill>
          Round {(c.round ?? 0) + 1}’s pot went to {payee?.name ?? 'its payee'} ✓
        </StatusPill>
      )
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
              <Brand sub="Circles" />
            </div>
            {/* Static dot; two-word status vocabulary: Demo | Live on Arbitrum. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-faint">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'rgba(255,241,232,0.82)' }}
              />
              {c.live ? 'Live on Arbitrum' : 'Demo'}
            </span>
          </div>
        }
        cta={
          <div className="flex flex-col gap-2.5">
            {primary}
            <ShareLink variant="text" label="or copy the link" />
            {/* The demo fill spends the relayer — it stays folded behind a
                quiet disclosure (same pattern as the sheet's "Paying from")
                instead of greeting every visitor as a big button. */}
            {showDemoFill &&
              (demoOpen ? (
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
                <button
                  onClick={() => setDemoOpen(true)}
                  className="mx-auto flex items-center gap-1.5 py-0.5 text-[13px] text-faint transition-colors hover:text-muted"
                >
                  <Sparkles size={13} strokeWidth={2.25} /> Demo
                  <ChevronDown size={13} />
                </button>
              ))}
            {demoError && (
              <p className="text-center text-[13px] font-medium leading-relaxed text-warn">{demoError}</p>
            )}
            {startError && (
              <p className="text-center text-[13px] font-medium leading-relaxed text-warn">{startError}</p>
            )}
            {youAreOrganizer && c.status === 'filling' && (
              <p className="text-center text-[13px] leading-relaxed text-faint">
                You’re the organizer — invites carry your signature, and only you can start.
              </p>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6 pt-4">
          <div>
            <p className="text-sm text-faint">
              {youAreOrganizer ? 'You’re running' : `${c.organizer} is running`}
            </p>
            <h1
              className="mt-1.5 text-display font-semibold text-paper"
              style={{ fontFamily: 'var(--font-display)', wordSpacing: '0.08em' }}
            >
              {c.title}
            </h1>
          </div>

          {/* Broken: say it plainly, above the instrument. Calm, not alarm —
              a stopped circle is the safety rail WORKING, so the banner wears
              the dusk's muted mauve (settled moonlight), never warning amber. */}
          {c.status === 'broken' && (
            <div
              className="rounded-2xl border px-4 py-3.5 text-[13px] leading-relaxed text-muted"
              style={{
                borderColor: 'rgba(168,159,180,0.22)',
                background: 'rgba(168,159,180,0.06)',
              }}
            >
              <span className="font-semibold" style={{ color: '#cdc5da' }}>
                Round {(failedRound?.index ?? 0) + 1} went unfunded, so the circle stopped.
              </span>{' '}
              Everyone gets their money back — every deposit still in the pot returns to its
              owner, automatically. No one’s money stays stuck.
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
                {/* A broken circle is settled, not live — the dot goes still. */}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${c.status === 'broken' ? '' : 'animate-pulse-dot'}`}
                  style={
                    c.status === 'broken'
                      ? { background: 'rgba(168,159,180,0.85)' }
                      : { background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }
                  }
                />
                {pulseLabel}
              </span>
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="tnum font-display text-figure font-semibold leading-none text-paper"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {formatUsd(displayPot)}
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
                <div className="mt-1 flex flex-col gap-1 text-[13px] text-muted">
                  <span>
                    This round’s pot →{' '}
                    <span className="font-semibold text-paper">
                      {youMember?.isPayee ? 'you ✦' : payee.name}
                    </span>
                  </span>
                  {cd != null && (
                    // Urgency survives the black test as weight, not only amber.
                    <span className={cd.urgent ? 'font-medium text-warn' : 'text-faint'}>
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
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-faint transition-colors hover:border-white/15"
            >
              {/* One line at 393pt: the address never breaks mid-hex. */}
              <span className="min-w-0 truncate">
                Settled on-chain · vault{' '}
                <span className="tnum whitespace-nowrap text-muted">{ROTATING_VAULT_SHORT}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted">View ↗</span>
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
  `relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97] ${FOCUS_RING}`

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

/**
 * The organizer's invite action on a self-custodied circle: signs a fresh
 * EIP-712 invite for the next open seat with THEIR OWN wallet (Magic
 * signTypedData — no Rally key involved), then copies the signed link.
 * Mirrors ShareLink's copy feedback so the two feel like one family.
 */
function OrganizerInviteButton({
  circleId,
  seat,
  title,
}: {
  circleId: string
  seat: number
  title?: string
}) {
  const [state, setState] = useState<'idle' | 'signing' | 'copied' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const signAndCopy = async () => {
    if (state === 'signing') return
    setError(null)
    setState('signing')
    try {
      const invite = await mintSeatInviteAsOrganizer({ circleId, seat })
      const url = inviteLinkFor(circleId, seat, title, invite)
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard blocked (insecure ctx) — same optimistic fallback as ShareLink.
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8)
      setState('copied')
      setTimeout(() => setState('idle'), 1900)
    } catch (e) {
      setError(friendlyCircleError(e))
      setState('error')
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <button onClick={signAndCopy} disabled={state === 'signing'} className={ctaBtnClass} style={coralCta}>
        <CtaSheen />
        {state === 'signing' ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> Signing seat {seat + 1}’s invite…
          </span>
        ) : state === 'copied' ? (
          <>Invite signed + copied ✓</>
        ) : (
          <>Invite the crew — sign seat {seat + 1}’s link</>
        )}
      </button>
      {state === 'error' && error && (
        <p className="text-center text-[13px] font-medium leading-relaxed text-warn">{error}</p>
      )}
    </div>
  )
}
