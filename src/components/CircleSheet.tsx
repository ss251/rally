import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from './BottomSheet'
import { Confetti } from './Confetti'
import { formatUsd } from '#/design/chains'
import { isLoggedIn, loginWithEmail, getMagicUser } from '#/lib/auth/magic'
import { friendlyCircleError } from '#/lib/circle'
import { gaslessCircleClaim, tryGaslessCircleDeposit } from '#/lib/circle-gasless'
import { chipInCircleServerFn, refundCircleServerFn } from '#/lib/circle-actions'

export type CircleSheetMode = 'chip' | 'claim' | 'refund'

interface CircleSheetProps {
  open: boolean
  onClose: () => void
  mode: CircleSheetMode
  circleId: string
  circleTitle: string
  /** Per-member per-round contribution (chip mode). */
  depositUsd: number
  /** The full rotating pot (claim mode). */
  potUsd: number
  /** What this member gets back on a broken circle (refund mode). */
  refundableUsd?: number
  /** Fired after the action lands on-chain — refresh the live circle. */
  onDone?: () => void
}

type Status = 'idle' | 'authing' | 'sending' | 'done' | 'error'

const COPY: Record<
  CircleSheetMode,
  {
    title: string
    lead: string
    reassure: string
    doneTitle: string
    done: (amount: number, title: string) => string
  }
> = {
  chip: {
    title: 'Chip in',
    lead: 'Everyone puts in the same amount each round. Just your email — nothing to install, nothing to set up.',
    reassure: 'If anyone misses a round, the circle stops and everyone’s refunded — automatically.',
    doneTitle: 'You’re in this round ✦',
    done: (a, t) => `Your ${formatUsd(a)} is in the pot for ${t}. Watch the bar fill.`,
  },
  claim: {
    title: 'Your turn',
    lead: 'Everyone’s in — this round’s pot is yours. Enter your email to take it. No gas, ever.',
    reassure: 'The whole pot, in one tap. That’s the deal — every member gets a turn.',
    doneTitle: 'You got the pot ✦',
    done: () => 'Straight to your wallet, gas-free. That’s your round — the rotation moves on.',
  },
  refund: {
    title: 'Get your money back',
    lead: 'The circle broke — a round went unfunded. Everything you put in that didn’t already pay out comes straight back.',
    reassure: 'That’s the promise: the pot pays in full, or everyone’s made whole.',
    doneTitle: 'Money’s back ✦',
    done: (a) => `${formatUsd(a)} is back in your wallet. No one’s money stays stuck.`,
  },
}

/**
 * The Circles money sheet — one component, three moments: chipping into the
 * round, claiming your pot, and pulling your refund on a break. Email login
 * (real Magic OTP) → the action lands on the live RotatingVault, gasless.
 * Mirrors ContributeSheet's states: idle → "Check your email…" → "Sending…" →
 * success + confetti. Never says wallet / seed / gas.
 */
export function CircleSheet({
  open,
  onClose,
  mode,
  circleId,
  circleTitle,
  depositUsd,
  potUsd,
  refundableUsd = 0,
  onDone,
}: CircleSheetProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [movedUsd, setMovedUsd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[mode]
  const amount = mode === 'chip' ? depositUsd : mode === 'claim' ? potUsd : refundableUsd

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStatus('idle')
        setEmail('')
        setMovedUsd(null)
        setError(null)
      }, 250)
      return () => clearTimeout(t)
    }
  }, [open])

  const inFlight = status === 'authing' || status === 'sending'
  const canSend = /.+@.+\..+/.test(email) && (status === 'idle' || status === 'error')

  const send = async () => {
    if (!canSend) return
    setError(null)
    try {
      // 1. Real Magic email login (OTP overlay). If a session is already live
      //    for this browser, reuse it without a fresh code.
      setStatus('authing')
      let address = (await isLoggedIn()) ? (await getMagicUser())?.address : undefined
      if (!address) address = (await loginWithEmail(email)).address

      setStatus('sending')

      // 2. The on-chain action — gasless-first, honest fallback.
      if (mode === 'chip') {
        // REAL product path: the member's own USDC, gasless via ZeroDev 7702.
        // Fresh email wallets hold none → the relayer fronts it (depositFor),
        // credited on-chain to the member's real address — same honest pattern
        // as the CCTP contribute fallback.
        const gasless = await tryGaslessCircleDeposit({ circleId, amountUsd: depositUsd })
        if (!gasless.funded) {
          await chipInCircleServerFn({ data: { circleId, member: address } })
        }
        setMovedUsd(depositUsd)
      } else if (mode === 'claim') {
        // Claim is member-only by construction (the vault pays msg.sender), so
        // it ALWAYS goes through the member's gasless 7702 kernel — a fresh
        // email wallet claims its whole pot with $0 gas and $0 balance.
        await gaslessCircleClaim({ circleId })
        setMovedUsd(potUsd)
      } else {
        // refundFor is permissionless and pays only the member — relayed
        // server-side so refunds cost the member nothing.
        const res = await refundCircleServerFn({ data: { circleId, member: address } })
        setMovedUsd(res.amountUsd)
      }

      setStatus('done')
      onDone?.()
    } catch (e) {
      setError(friendlyCircleError(e))
      setStatus('error')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={status === 'done' ? undefined : copy.title}>
      {status === 'done' ? (
        <SuccessView
          title={copy.doneTitle}
          body={copy.done(movedUsd ?? amount, circleTitle)}
          // Claiming the pot is the biggest moment in a circle's life — the
          // whole point of the rotation. Name the amount, huge, and let the
          // burst be bigger than a routine chip-in.
          figure={mode === 'claim' ? (movedUsd ?? amount) : undefined}
          particleCount={mode === 'claim' ? 190 : 110}
          onDoneLabel="Back to the circle"
          onDone={onClose}
        />
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <p className="-mt-1 text-[15px] leading-relaxed text-muted">{copy.lead}</p>

          {/* The figure — circles have exact amounts, so no tier picker. A $0
              refund is a sentence, not a dangling em-dash: don't promise a
              stranger money the vault doesn't owe them. */}
          {mode === 'refund' && amount <= 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-[13px] leading-relaxed text-muted">
              This email isn’t in this circle — nothing is owed here. If you chipped in,
              use the email you joined with.
            </div>
          ) : (
            <div className="flex items-end justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
              <span className="text-xs font-medium uppercase tracking-wide text-faint">
                {mode === 'chip' ? 'Your share this round' : mode === 'claim' ? 'This round’s pot' : 'Coming back to you'}
              </span>
              <span
                className="tnum font-display text-2xl font-semibold leading-none text-paper"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {formatUsd(amount)}
              </span>
            </div>
          )}

          {/* Email — the nag lives on the field, not on the reassure line. */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-faint">Email</span>
              {!/.+@.+\..+/.test(email) && (
                <span className="text-xs text-faint">enter yours to continue</span>
              )}
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

          {status === 'error' && error && (
            <p className="-mb-1 text-[13px] font-medium leading-relaxed text-warn">{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={send}
            disabled={!canSend && !inFlight}
            className="relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold transition-[transform,background-color,color,box-shadow] duration-150 ease-[var(--ease-rally)] active:scale-[0.97]"
            style={{
              background:
                canSend || inFlight
                  ? 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))'
                  : 'rgba(255,255,255,0.05)',
              color: canSend || inFlight ? 'var(--color-ink-950)' : 'rgba(255,255,255,0.4)',
              boxShadow:
                canSend || inFlight
                  ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {(canSend || inFlight) && (
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
            ) : status === 'sending' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Sending…
              </>
            ) : status === 'error' ? (
              <>Try again</>
            ) : mode === 'chip' ? (
              <>Chip in {formatUsd(amount)}</>
            ) : mode === 'claim' ? (
              <>Claim {formatUsd(amount)}</>
            ) : amount > 0 ? (
              <>Get {formatUsd(amount)} back</>
            ) : (
              <>Check your refund</>
            )}
          </button>

          {/* The safety promise stays visible unconditionally — it's the line
              that converts a stranger, so it never yields to a form nag. */}
          <p className="-mt-1 text-center text-[13px] leading-relaxed text-faint">
            {copy.reassure}
          </p>
        </div>
      )}
    </BottomSheet>
  )
}

function SuccessView({
  title,
  body,
  figure,
  particleCount = 110,
  onDoneLabel,
  onDone,
}: {
  title: string
  body: string
  /** Optional hero amount — rendered as the money-shot figure (claim mode). */
  figure?: number
  particleCount?: number
  onDoneLabel: string
  onDone: () => void
}) {
  return (
    <div className="relative flex flex-col items-center gap-4 py-4 text-center">
      <Confetti active skin="rally" particleCount={particleCount} />
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
        <h3
          className="text-2xl font-semibold tracking-tight text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h3>
        {figure != null && (
          <motion.p
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.1 }}
            className="tnum mt-3 text-figure font-semibold text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formatUsd(figure)}
          </motion.p>
        )}
        <p className={`${figure != null ? 'mt-3' : 'mt-1.5'} text-[15px] leading-relaxed text-muted`}>
          {body}
        </p>
      </div>
      <button
        onClick={onDone}
        className="mt-1 w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-base font-semibold text-paper transition-[color,background-color,transform] duration-150 ease-[var(--ease-rally)] active:scale-[0.98]"
      >
        {onDoneLabel}
      </button>
    </div>
  )
}

export default CircleSheet
