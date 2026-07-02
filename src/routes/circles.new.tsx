import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { AppShell } from '#/components/AppShell'
import { ShareLink } from '#/components/ShareLink'
import { formatUsd } from '#/design/chains'
import { loginWithEmail } from '#/lib/auth/magic'
import { inviteLinkFor } from '#/lib/circle'
import { createCircleServerFn, type CreateCircleFnInput } from '#/lib/circle-actions'

export const Route = createFileRoute('/circles/new')({ component: CreateCircle })

const AMOUNTS = [1, 2, 5]
const CADENCES: { label: string; seconds: number }[] = [
  { label: '5 min', seconds: 300 },
  { label: '1 day', seconds: 86_400 },
  { label: '1 week', seconds: 604_800 },
  { label: '1 month', seconds: 30 * 86_400 },
]
const SEAT_OPTIONS = [3, 4, 5, 6]

type Status = 'idle' | 'authing' | 'creating' | 'error'

interface Created {
  circleId: string
  openSeats: number[]
  started: boolean
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

  const inFlight = status === 'authing' || status === 'creating'
  const canCreate =
    title.trim().length > 1 && /.+@.+\..+/.test(email) && !inFlight && created == null

  const create = async () => {
    if (!canCreate) return
    setError(null)
    try {
      // 1. Real Magic email login — the creator's embedded wallet takes seat 1.
      setStatus('authing')
      const user = await loginWithEmail(email)

      // 2. createCircle on the live RotatingVault. The Rally concierge relayer
      //    is the organizer, so it can mint org-signed EIP-712 invites on
      //    demand for the emails that join later (see lib/circle-relayer.ts).
      setStatus('creating')
      const input: CreateCircleFnInput = {
        depositUsd: amount,
        roundSeconds: cadence,
        seats,
        creator: user.address,
        demoFill,
      }
      const res = await createCircleServerFn({ data: input })
      setCreated({
        circleId: res.circleId,
        openSeats: res.seats.filter((s) => s.member == null).map((s) => s.seat),
        started: res.started,
      })
      setStatus('idle')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (created) {
    const pot = amount * seats
    return (
      <AppShell header={<CreateHeader />}>
        <div className="flex flex-col gap-6 pt-6">
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-muted"
            >
              Your circle is live ✦
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-1.5 text-[1.9rem] font-semibold leading-tight tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {created.started ? 'The rotation has begun' : 'Drop the seats in the group chat'}
            </motion.h1>
            <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-muted">
              {created.started
                ? 'Seat 1 is yours and the crew is in. Chip into round 1 and watch the pot fill.'
                : 'One link per seat. Whoever opens it joins with just their email — no wallet, no gas.'}
            </p>
          </div>

          {/* The circle, summarized — the artifact they just made. */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
          >
            <p className="text-sm font-semibold text-paper">{title.trim()}</p>
            <p className="mt-1 text-[13px] text-muted">
              {seats} members · <span className="font-medium text-paper/90">{formatUsd(amount)}</span>{' '}
              each round · the <span className="font-medium text-paper/90">{formatUsd(pot)}</span> pot
              rotates
            </p>
          </motion.div>

          <div className="flex flex-col gap-2.5">
            {created.openSeats.map((seat) => (
              <ShareLink
                key={seat}
                variant={seat === created.openSeats[0] ? 'primary' : 'ghost'}
                url={inviteLinkFor(created.circleId, seat, title.trim())}
                label={`Copy seat ${seat + 1}’s invite`}
              />
            ))}
            <Link
              to="/circle/$id"
              params={{ id: created.circleId }}
              className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-center text-base font-semibold text-paper transition-transform active:scale-[0.98]"
            >
              Open the circle →
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={<CreateHeader />}
      cta={
        <button
          onClick={create}
          disabled={!canCreate}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97] disabled:opacity-45"
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
          {status === 'authing' ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Check your email…
            </>
          ) : status === 'creating' ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Setting up the circle…
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
            placeholder="The cousins’ chit fund"
            maxLength={60}
            disabled={inFlight}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-rally-500/70 focus:bg-white/[0.06] disabled:opacity-60"
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
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-rally-500/70 focus:bg-white/[0.06] disabled:opacity-60"
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
                      ? { background: 'var(--color-rally-500)', color: 'var(--color-ink-950)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-paper)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="circle-cadence-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: '0 8px 26px -8px var(--color-rally-glow)' }}
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
                      ? { background: 'var(--color-rally-500)', color: 'var(--color-ink-950)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-paper)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="circle-seats-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: '0 8px 26px -8px var(--color-rally-glow)' }}
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

        {/* Demo fill */}
        <button
          onClick={() => setDemoFill((v) => !v)}
          disabled={inFlight}
          className="flex items-center justify-between rounded-2xl border p-4 text-left transition-colors disabled:opacity-60"
          style={{
            borderColor: demoFill ? 'rgba(255,122,80,0.35)' : 'var(--color-line)',
            background: demoFill ? 'rgba(255,122,80,0.07)' : 'var(--color-surface)',
          }}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <Sparkles size={15} strokeWidth={2.25} style={{ color: 'var(--color-rally-500)' }} />
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
            style={{ background: demoFill ? 'var(--color-rally-500)' : 'rgba(255,255,255,0.12)' }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: demoFill ? 18 : 2 }}
            />
          </span>
        </button>

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
