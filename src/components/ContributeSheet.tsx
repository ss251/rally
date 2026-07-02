import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from './BottomSheet'
import { Confetti } from './Confetti'
import { CHAIN_META, formatUsd, type Chain } from '#/design/chains'
import { loginWithEmail } from '#/lib/auth/magic'
import { tryGaslessBackerBurn } from '#/lib/backer-gasless'
import { contributeServerFn, completeContributionServerFn } from '#/lib/contribute'

interface ContributeSheetProps {
  open: boolean
  onClose: () => void
  campaignTitle?: string
  /** The chain the backer's money is auto-detected on (the CCTP source). */
  fromChain?: Chain
  /** Fired after a real contribution lands on-chain — refresh the live bar. */
  onContributed?: () => void
}

// Real contribution tiers. A FUNDED backer burns their own USDC for the full
// selected amount, gaslessly (ZeroDev 7702). A fresh (empty) email wallet falls
// back to the demo relayer, which caps the move to its finite testnet treasury
// and reports the real amount moved — the UI shows what actually landed.
const AMOUNTS = [10, 25, 100]
type Status = 'idle' | 'authing' | 'sending' | 'done' | 'error'

/**
 * The money moment. Email login (real Magic OTP) + amount → REAL gasless
 * cross-chain CCTP contribution into the live GoalVault. The CCTP hop, the
 * wallet, the gas — all invisible. Never says wallet / seed / gas.
 * CTA states: "Chip in $1" → "Check your email…" → "Sending…" → "You're in ✦".
 */
export function ContributeSheet({
  open,
  onClose,
  campaignTitle = 'the Tokyo fund',
  fromChain = 'base',
  onContributed,
}: ContributeSheetProps) {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState(AMOUNTS[0])
  const [status, setStatus] = useState<Status>('idle')
  const [movedUsd, setMovedUsd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chain = CHAIN_META[fromChain]

  // Reset the flow whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStatus('idle')
        setEmail('')
        setAmount(AMOUNTS[0])
        setMovedUsd(null)
        setError(null)
      }, 250)
      return () => clearTimeout(t)
    }
  }, [open])

  const inFlight = status === 'authing' || status === 'sending'
  const canSend =
    /.+@.+\..+/.test(email) && amount > 0 && (status === 'idle' || status === 'error')

  const send = async () => {
    if (!canSend) return
    setError(null)
    try {
      // 1. Real Magic email login — pops Magic's OTP overlay; a human types the
      //    code from their inbox. Resolves to the backer's embedded-wallet EOA.
      setStatus('authing')
      const user = await loginWithEmail(email)

      setStatus('sending')

      // 2. THE REAL PRODUCT PATH — backer-funded, gasless, cross-chain.
      //    Upgrade the Magic EOA to a ZeroDev 7702 kernel and, IF the backer
      //    holds enough USDC on Base Sepolia, burn THEIR OWN money for the full
      //    selected amount with the ZeroDev paymaster covering gas (they pay
      //    nothing). The server then finishes the CCTP hop (attest → mint →
      //    record) — relaying only, not funding.
      //
      //    A fresh email wallet holds no USDC (the common demo case), so
      //    tryGaslessBackerBurn returns { funded: false } and we fall back to
      //    the honest relayer-funded server path below. The UI does NOT expose
      //    which path ran; the difference is only in who paid — see the code +
      //    lib/backer-gasless.ts / lib/cctp/complete-fill.ts.
      let res
      const gasless = await tryGaslessBackerBurn({ amountUsd: amount })
      if (gasless.funded) {
        // Backer burned their own USDC gaslessly — finish it server-side.
        res = await completeContributionServerFn({
          data: {
            backer: gasless.backer,
            burnTxHash: gasless.burnTx,
            sourceDomain: gasless.sourceDomain,
          },
        })
      } else {
        // Fresh/empty wallet → relayer fronts the source USDC (capped to its
        // finite testnet treasury), recorded under the backer's real address.
        res = await contributeServerFn({
          data: { backer: user.address, amountUsd: amount },
        })
      }

      setMovedUsd(res.movedUsd)
      setStatus('done')
      // 3. Bar rises for real — re-read the live GoalVault.
      onContributed?.()
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Something went wrong. Please try again.',
      )
      setStatus('error')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={status === 'done' ? undefined : 'Chip in'}>
      {status === 'done' ? (
        <SuccessView amount={movedUsd ?? amount} campaignTitle={campaignTitle} onDone={onClose} />
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <p className="-mt-1 text-[15px] leading-relaxed text-muted">
            Enter your email and pick an amount — you're in from whatever chain your
            money's on. No wallet, no gas, no seed phrase.
          </p>

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

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">Amount</span>
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
                        ? { background: 'var(--color-rally-500)', color: 'var(--color-ink-950)' }
                        : { background: 'rgba(255,255,255,0.04)', color: 'var(--color-paper)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {active && (
                      <motion.span
                        layoutId="amount-pill-glow"
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-xl"
                        style={{ boxShadow: '0 8px 26px -8px var(--color-rally-glow)' }}
                      />
                    )}
                    ${a}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 pt-0.5 text-[13px] text-faint">
              Paying from
              <span className="inline-flex items-center gap-1.5 font-medium capitalize text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: chain.to }} />
                {chain.label ?? fromChain}
              </span>
            </div>
          </div>

          {/* Error line — honest, quiet. */}
          {status === 'error' && error && (
            <p className="-mb-1 text-[13px] leading-relaxed text-warn">{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={send}
            disabled={!canSend}
            className="relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-all duration-150 ease-[var(--ease-spring)] active:scale-[0.97] disabled:opacity-45"
            style={{
              background: 'var(--color-rally-500)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.35) inset, 0 10px 34px -10px var(--color-rally-glow)',
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
            ) : status === 'sending' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Sending…
              </>
            ) : status === 'error' ? (
              <>Try again</>
            ) : (
              <>Chip in {formatUsd(amount)}</>
            )}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}

function SuccessView({
  amount,
  campaignTitle,
  onDone,
}: {
  amount: number
  campaignTitle: string
  onDone: () => void
}) {
  return (
    <div className="relative flex flex-col items-center gap-4 py-4 text-center">
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
        <h3
          className="text-2xl font-semibold tracking-tight text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          You're in ✦
        </h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
          Your {formatUsd(amount)} is on its way to {campaignTitle}. Watch the bar rise.
        </p>
      </div>
      <button
        onClick={onDone}
        className="mt-1 w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-base font-semibold text-paper transition-colors active:scale-[0.98]"
      >
        Back to the rally
      </button>
    </div>
  )
}

export default ContributeSheet
