import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { AppShell } from '#/components/AppShell'
import { Confetti } from '#/components/Confetti'
import { formatUsd } from '#/design/chains'
import { loginWithEmail } from '#/lib/auth/magic'
import { fetchLiveCircle, friendlyCircleError, type CircleView } from '#/lib/circle'
import { joinCircleServerFn } from '#/lib/circle-actions'

interface InviteSearch {
  /** Circle id. Kept as it parsed (number for `?c=1`) so the URL stays clean —
   *  the router JSON-quotes coerced strings and 307s to the rewritten URL. */
  c: string | number
  /** Seat (payoutIndex). */
  i: number
  /** Optional human title carried from the create screen. */
  t?: string
  /** Optional pre-signed org invite: member + nonce (hex string) + signature. */
  m?: string
  n?: string | number
  s?: string
}

export const Route = createFileRoute('/invite')({
  validateSearch: (search: Record<string, unknown>): InviteSearch => ({
    c:
      typeof search.c === 'string' || typeof search.c === 'number'
        ? search.c
        : String(search.c ?? ''),
    i: Number.isFinite(Number(search.i)) ? Math.max(0, Math.floor(Number(search.i))) : 0,
    t: typeof search.t === 'string' && search.t ? search.t : undefined,
    m: typeof search.m === 'string' && search.m ? search.m : undefined,
    n:
      (typeof search.n === 'string' && search.n) || typeof search.n === 'number'
        ? (search.n as string | number)
        : undefined,
    s: typeof search.s === 'string' && search.s ? search.s : undefined,
  }),
  loaderDeps: ({ search }) => ({ c: search.c, t: search.t }),
  // Best-effort live read for the invite card; the screen still works if the
  // circle can't be read (deposit shown as "—").
  loader: async ({ deps }): Promise<CircleView | null> => {
    if (!deps.c) return null
    return fetchLiveCircle(String(deps.c), deps.t).catch(() => null)
  },
  component: InvitePage,
})

type Status = 'idle' | 'authing' | 'joining' | 'done' | 'error'

function InvitePage() {
  const circle = Route.useLoaderData()
  const { c, i: seat, t, m, n, s } = Route.useSearch()
  const circleId = String(c)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const title = circle?.title ?? t ?? 'a circle'
  const inFlight = status === 'authing' || status === 'joining'
  const canJoin = /.+@.+\..+/.test(email) && !!circleId && (status === 'idle' || status === 'error')

  const join = async () => {
    if (!canJoin) return
    setError(null)
    try {
      // 1. Email → embedded wallet. This address is where every right of the
      //    seat (deposits, the pot, refunds) accrues.
      setStatus('authing')
      const user = await loginWithEmail(email)

      // 2. Redeem the seat. If the link carries a pre-signed org invite
      //    (m/n/s), it is relayed as-is; otherwise the server mints an
      //    org-signed EIP-712 invite for this fresh address on demand and
      //    submits it — gasless either way (anyone may submit; the signature
      //    is the authorization).
      setStatus('joining')
      await joinCircleServerFn({
        data: {
          circleId,
          payoutIndex: seat,
          member: m ?? user.address,
          nonce: n != null ? String(n) : undefined,
          signature: s,
        },
      })
      setStatus('done')
    } catch (e) {
      setError(friendlyCircleError(e))
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <AppShell header={<InviteHeader />}>
        <div className="relative flex flex-col items-center gap-4 pt-16 text-center">
          <Confetti active skin="rally" particleCount={110} />
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
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              You’re in — seat {seat + 1} ✦
            </h1>
            <p className="mx-auto mt-1.5 max-w-[19rem] text-[15px] leading-relaxed text-muted">
              Round {seat + 1}’s pot is yours when your turn comes. Chip in each round and watch
              the bar fill.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: '/circle/$id', params: { id: circleId } })}
            className="mt-2 w-full rounded-full py-4 text-base font-semibold text-ink-950 transition-transform active:scale-[0.97]"
            style={{
              background:
                'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
            }}
          >
            Open the circle →
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={<InviteHeader />}
      cta={
        <button
          onClick={join}
          disabled={!canJoin && !inFlight}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97] disabled:opacity-45"
          style={{
            background:
              canJoin || inFlight
                ? 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))'
                : 'rgba(255,255,255,0.05)',
            color: canJoin || inFlight ? 'var(--color-ink-950)' : 'rgba(255,255,255,0.4)',
            boxShadow:
              canJoin || inFlight
                ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {(canJoin || inFlight) && (
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
          ) : status === 'joining' ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Taking your seat…
            </>
          ) : status === 'error' ? (
            <>Try again</>
          ) : (
            <>Take seat {seat + 1}</>
          )}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <p className="text-sm text-faint">You’ve got a seat in</p>
          <h1
            className="mt-1.5 text-[2.15rem] font-semibold leading-[1.04] tracking-[-0.01em] text-paper"
            style={{ fontFamily: 'var(--font-display)', wordSpacing: '0.08em' }}
          >
            {title}
          </h1>
        </div>

        {/* The deal, plainly. */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-end justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">
              Seat {seat + 1}
              {circle ? ` of ${circle.memberTarget}` : ''}
            </span>
            <span
              className="tnum font-display text-2xl font-semibold leading-none text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {circle ? formatUsd(circle.depositUsd) : '—'}
              <span className="ml-1 text-sm font-medium text-muted">each round</span>
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Everyone chips in the same amount each round, and each round one member takes the whole
            pot{circle ? ` — ${formatUsd(circle.potUsd)}` : ''}. Round {seat + 1} is{' '}
            <span className="font-semibold text-paper">yours</span>. If anyone misses a round,
            everyone’s refunded automatically.
          </p>
        </div>

        {/* Email */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Email</span>
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

        {status === 'error' && error && (
          <p className="-mt-2 text-[13px] leading-relaxed text-warn">{error}</p>
        )}

        <p className="text-center text-[12.5px] leading-relaxed text-faint">
          No wallet, no gas, no seed phrase — just your email.
        </p>
      </div>
    </AppShell>
  )
}

function InviteHeader() {
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
          Rally <span className="text-muted">Circles</span>
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-faint">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
          style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
        />
        Arbitrum testnet
      </span>
    </div>
  )
}
