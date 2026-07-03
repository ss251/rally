import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { AppShell } from '#/components/AppShell'
import { Confetti } from '#/components/Confetti'
import { ShareLink } from '#/components/ShareLink'
import { formatUsd } from '#/design/chains'
import { loginWithEmail } from '#/lib/auth/magic'
import { inviteLinkFor, type SignedInvite } from '#/lib/circle'
import { createCircleServerFn, type CreateCircleFnInput } from '#/lib/circle-actions'
import { createSelfCustodiedCircle } from '#/lib/circle-self-custody'

export const Route = createFileRoute('/circles/new')({ component: CreateCircle })

const AMOUNTS = [1, 2, 5]
const CADENCES: { label: string; seconds: number }[] = [
  { label: '5 min', seconds: 300 },
  { label: '1 day', seconds: 86_400 },
  { label: '1 week', seconds: 604_800 },
  { label: '1 month', seconds: 30 * 86_400 },
]
const SEAT_OPTIONS = [3, 4, 5, 6]

type Status = 'idle' | 'authing' | 'creating' | 'signing' | 'seating' | 'error'

interface Created {
  circleId: string
  openSeats: number[]
  started: boolean
  /** true = the creator's own wallet is the on-chain organizer (real lane);
   *  false = the Rally crew's relayer organizes it (the demo lane). */
  selfCustodied: boolean
  /** Org-signed invites, one per open seat (self-custodied lane only). */
  invites?: SignedInvite[]
}

function CreateCircle() {
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState(1)
  const [cadence, setCadence] = useState(CADENCES[0].seconds)
  const [seats, setSeats] = useState(4)
  const [demoFill, setDemoFill] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  const inFlight =
    status === 'authing' || status === 'creating' || status === 'signing' || status === 'seating'
  const canCreate =
    title.trim().length > 1 && /.+@.+\..+/.test(email) && !inFlight && created == null

  const create = async () => {
    if (!canCreate) return
    setError(null)
    try {
      // 1. Real Magic email login — the creator's embedded wallet takes seat 1.
      setStatus('authing')
      const user = await loginWithEmail(email)

      if (demoFill) {
        // 2a. DEMO LANE — the Rally crew's relayer is the on-chain organizer,
        //     so it can seat the demo friends and start the rotation for a
        //     solo walkthrough (see lib/circle-relayer.ts). Honest and labeled:
        //     the Rally crew runs the demo; real circles take the lane below.
        setStatus('creating')
        const input: CreateCircleFnInput = {
          depositUsd: amount,
          roundSeconds: cadence,
          seats,
          creator: user.address,
          demoFill: true,
        }
        const res = await createCircleServerFn({ data: input })
        setCreated({
          circleId: res.circleId,
          openSeats: res.seats.filter((s) => s.member == null).map((s) => s.seat),
          started: res.started,
          selfCustodied: false,
        })
      } else {
        // 2b. REAL LANE — self-custodied. createCircle is sent from the
        //     creator's own 7702 kernel (organizer = their EOA), every seat
        //     invite is signed by THEIR key right here in the browser, and
        //     only they can start the circle. Rally never holds a key that
        //     could sign an invite or touch this circle.
        const res = await createSelfCustodiedCircle({
          depositUsd: amount,
          roundSeconds: cadence,
          seats,
          onPhase: setStatus,
        })
        setCreated({
          circleId: res.circleId,
          openSeats: (res.invites ?? []).map((i) => i.seat),
          started: res.started,
          selfCustodied: true,
          invites: res.invites,
        })
      }
      setStatus('idle')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (created) {
    const pot = amount * seats
    const hasSeats = created.openSeats.length > 0
    return (
      <AppShell header={<CreateHeader />}>
        {/* The payoff. Mirrors the Pools "You're in ✦" moment — spring-in
            check + confetti — then puts the seat invites front and center:
            the circle only becomes real when the crew opens these. */}
        <div className="relative flex flex-col gap-6 pt-6">
          {/* The burst frames the check + headline (the payoff), not the tall
              link list below — its stage is pinned to the first ~half screen
              so the two popper corners sit beside the artifact card and the
              confetti arcs up around "Your circle is live ✦". */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[55dvh]">
            <Confetti active skin="rally" particleCount={150} />
          </div>

          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 480, damping: 20 }}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: 'var(--color-rally-500)',
                boxShadow: '0 12px 40px -8px var(--color-rally-glow)',
              }}
            >
              <Check size={30} strokeWidth={3} className="text-ink-950" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-4 text-[1.9rem] font-semibold leading-tight tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Your circle is live ✦
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-muted"
            >
              {created.selfCustodied
                ? 'Seat 1 is yours — and you are the organizer. Every invite below carries your signature, not ours. Whoever opens one joins with just their email.'
                : created.started
                  ? 'Seat 1 is yours and the crew is in. Chip into round 1 and watch the pot fill.'
                  : 'Seat 1 is yours. One link per seat below — whoever opens one joins with just their email, nothing to install.'}
            </motion.p>
          </div>

          {/* The circle, summarized — the artifact they just made. */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.12 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
          >
            <p className="text-sm font-semibold text-paper">{title.trim()}</p>
            <p className="mt-1 text-[13px] text-muted">
              {seats} members · <span className="font-medium text-paper/90">{formatUsd(amount)}</span>{' '}
              each round · the <span className="font-medium text-paper/90">{formatUsd(pot)}</span> pot
              rotates
            </p>
            {/* The custody line — who holds this circle's keys, plainly. */}
            <p className="mt-2 border-t border-white/[0.06] pt-2 text-[12.5px] leading-relaxed text-faint">
              {created.selfCustodied
                ? 'Self-custodied: your wallet is the on-chain organizer — invites carry your signature, and only you can start the circle.'
                : 'Demo circle: the Rally crew runs it so you can watch a full rotation solo.'}
            </p>
          </motion.div>

          {/* The invites — the hero action of this screen. */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            {hasSeats && (
              <span className="text-center text-xs font-medium uppercase tracking-wide text-faint">
                Share these with the crew — one per seat
              </span>
            )}
            {created.openSeats.map((seat) => (
              <ShareLink
                key={seat}
                variant={seat === created.openSeats[0] ? 'primary' : 'ghost'}
                url={inviteLinkFor(
                  created.circleId,
                  seat,
                  title.trim(),
                  // Self-custodied lane: the link carries the creator-signed
                  // EIP-712 invite inline, so no Rally key is ever involved.
                  created.invites?.find((i) => i.seat === seat),
                )}
                label={`Copy seat ${seat + 1}’s invite`}
              />
            ))}
            <Link
              to="/circle/$id"
              params={{ id: created.circleId }}
              className={
                hasSeats
                  ? 'w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-center text-base font-semibold text-paper transition-transform active:scale-[0.98]'
                  : 'relative w-full overflow-hidden rounded-full py-4 text-center text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]'
              }
              style={
                hasSeats
                  ? undefined
                  : {
                      background:
                        'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
                    }
              }
            >
              {!hasSeats && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
                />
              )}
              View the circle →
            </Link>
          </motion.div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={<CreateHeader />}
      cta={
        // Matches ContributeSheet's CTA exactly: coral only when it can act; a
        // quiet gray rest state while the form is incomplete — never dimmed coral.
        <button
          onClick={create}
          disabled={!canCreate}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold transition-all duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
          style={{
            background:
              canCreate || inFlight
                ? 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))'
                : 'rgba(255,255,255,0.05)',
            color: canCreate || inFlight ? 'var(--color-ink-950)' : 'rgba(255,255,255,0.4)',
            boxShadow:
              canCreate || inFlight
                ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {(canCreate || inFlight) && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
            />
          )}
          {status === 'authing' ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Check your email…
            </>
          ) : status === 'creating' ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {demoFill ? 'Setting up the circle…' : 'Creating on-chain — you’re the organizer…'}
            </>
          ) : status === 'signing' ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Signing the crew’s invites…
            </>
          ) : status === 'seating' ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Taking seat 1…
            </>
          ) : status === 'error' ? (
            <>Try again</>
          ) : (
            <>Start the circle</>
          )}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1
            className="text-[2rem] font-semibold leading-[1.05] tracking-tight text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Start a circle
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            A savings pot that rotates through the crew — everyone in, every round.
          </p>
        </div>

        {/* Name */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            What’s the circle called?
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The cousins’ savings circle"
            maxLength={60}
            disabled={inFlight}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60"
          />
        </label>

        {/* Email — the creator takes seat 1. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Your email — seat 1 is yours
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            disabled={inFlight}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60"
          />
        </label>

        {/* Amount per round */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Everyone puts in, each round
          </span>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map((a) => {
              const active = amount === a
              return (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  disabled={inFlight}
                  className="relative rounded-xl py-3 text-base font-semibold transition-colors disabled:opacity-60"
                  style={
                    active
                      ? { background: 'rgba(255,255,255,0.10)', color: 'var(--color-paper)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-muted)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="circle-amount-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)' }}
                    />
                  )}
                  ${a}
                </button>
              )
            })}
          </div>
        </div>

        {/* Cadence */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Rounds run</span>
          <div className="grid grid-cols-4 gap-2">
            {CADENCES.map((cad) => {
              const active = cadence === cad.seconds
              return (
                <button
                  key={cad.seconds}
                  onClick={() => setCadence(cad.seconds)}
                  disabled={inFlight}
                  className="relative rounded-xl px-1 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
                  style={
                    active
                      ? { background: 'rgba(255,255,255,0.10)', color: 'var(--color-paper)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-muted)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="circle-cadence-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)' }}
                    />
                  )}
                  {cad.label}
                </button>
              )
            })}
          </div>
          {cadence === 300 && (
            <p className="text-[12.5px] leading-relaxed text-faint">
              5-minute rounds are perfect for a demo rotation.
            </p>
          )}
        </div>

        {/* Seats */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Members</span>
          <div className="grid grid-cols-4 gap-2">
            {SEAT_OPTIONS.map((s) => {
              const active = seats === s
              return (
                <button
                  key={s}
                  onClick={() => setSeats(s)}
                  disabled={inFlight}
                  className="relative rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
                  style={
                    active
                      ? { background: 'rgba(255,255,255,0.10)', color: 'var(--color-paper)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-muted)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="circle-seats-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)' }}
                    />
                  )}
                  {s}
                </button>
              )
            })}
          </div>
          <p className="text-[12.5px] leading-relaxed text-faint">
            The pot each round: <span className="tnum text-muted">{formatUsd(amount * seats)}</span> —
            every member gets exactly one turn.
          </p>
        </div>

        {/* Demo fill — selected state speaks the quiet white ring, like every
            other chip on this form. Coral stays reserved for the one CTA. */}
        <button
          onClick={() => setDemoFill((v) => !v)}
          disabled={inFlight}
          className="flex items-center justify-between rounded-2xl border p-4 text-left transition-colors disabled:opacity-60"
          style={{
            borderColor: demoFill ? 'transparent' : 'var(--color-line)',
            background: demoFill ? 'rgba(255,255,255,0.06)' : 'var(--color-surface)',
            boxShadow: demoFill ? 'inset 0 0 0 1.5px rgba(255,255,255,0.45)' : undefined,
          }}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <Sparkles size={15} strokeWidth={2.25} style={{ color: 'var(--color-muted)' }} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-paper">Fill seats with demo friends</span>
              <span className="block text-[12.5px] leading-relaxed text-faint">
                so you can watch a full rotation solo — real on-chain, testnet money
              </span>
            </span>
          </span>
          <span
            className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
            style={{ background: demoFill ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)' }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: demoFill ? 18 : 2 }}
            />
          </span>
        </button>

        {/* Who organizes the circle — the custody line, stated before the tap.
            Real create = the creator's wallet; demo = the Rally crew, plainly. */}
        <p className="-mt-3 text-[12.5px] leading-relaxed text-faint">
          {demoFill ? (
            <>
              Demo circles are run by <span className="font-medium text-muted">the Rally crew</span>{' '}
              so the rotation can play out solo.
            </>
          ) : (
            <>
              <span className="font-medium text-muted">You’ll be the organizer</span> — the circle is
              created from your wallet, invites carry your signature, and only you can start it.
              Nobody holds the money, including us.
            </>
          )}
        </p>

        {status === 'error' && error && (
          <p className="-mt-2 text-[13px] leading-relaxed text-warn">{error}</p>
        )}
      </div>
    </AppShell>
  )
}

function CreateHeader() {
  return (
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
          New circle
        </span>
      </div>
    </div>
  )
}
