import { useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from './BottomSheet'
import { Confetti } from './Confetti'
import { CHAIN_META, FOCUS_RING, formatUsd, type Chain } from '#/design/chains'
import { loginWithEmail } from '#/lib/auth/magic'
import { tryGaslessBackerBurn } from '#/lib/backer-gasless'

// Money errors must read like a product, never like a stack trace. Raw
// viem/RPC reverts (with contract addresses and calldata) reached this sheet
// live on 2026-07-03 — map the known failure shapes to human words and give
// everything else one honest fallback. The full error still lands in the
// console for us.
function friendlyMoneyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '')
  // eslint-disable-next-line no-console
  console.error('[chip-in]', raw)
  const m = raw.toLowerCase()
  if (m.includes('allowance') || m.includes('insufficient') || m.includes('exceeds'))
    return 'The money rail hiccuped — nothing left your account. Try again in a few seconds.'
  if (m.includes('deadline') || m.includes('ended'))
    return 'This rally already ended — nothing was sent.'
  if (m.includes('withdrawn'))
    return 'This rally already paid out — nothing was sent.'
  if (m.includes('timeout') || m.includes('network') || m.includes('fetch'))
    return 'The network hiccuped — nothing left your account. Try again.'
  if (m.includes('denied') || m.includes('rejected'))
    return 'The request was cancelled — nothing was sent.'
  return 'Something went wrong on our side — nothing left your account. Try again.'
}
import { contributeServerFn, completeContributionServerFn } from '#/lib/contribute'
import {
  dispenserStatusServerFn,
  beginClaimServerFn,
  type DispenserStatus,
} from '#/lib/dispense-actions'

interface DispenseMessage {
  source?: string
  ok?: boolean
  amountUsd?: number
  reason?: 'already-claimed' | 'treasury-empty' | 'error'
  message?: string
}

/** Open GitHub's authorize page in a popup and resolve when the callback tab
 *  posts the claim result back (or the user closes the window). */
function openClaimPopup(url: string): Promise<DispenseMessage> {
  return new Promise((resolve) => {
    const w = window.open(url, 'rally-github', 'width=520,height=720,noopener=no')
    let settled = false
    const done = (r: DispenseMessage) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMsg)
      clearInterval(poll)
      resolve(r)
    }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data as DispenseMessage
      if (d?.source !== 'rally-dispenser') return
      done(d)
    }
    window.addEventListener('message', onMsg)
    const poll = setInterval(() => {
      if (w?.closed) done({ ok: false, reason: 'error', message: 'window closed' })
    }, 600)
  })
}

function claimFailMessage(r: DispenseMessage): string {
  if (r.reason === 'already-claimed')
    return 'This GitHub account already claimed its starter funds. Sign in with a different account, or fund your wallet directly.'
  if (r.reason === 'treasury-empty')
    return 'The testnet faucet is empty right now — check back in a bit.'
  if (r.message === 'window closed') return 'GitHub sign-in was cancelled — nothing happened.'
  return 'GitHub sign-in didn’t complete — you can try again.'
}

interface ContributeSheetProps {
  open: boolean
  onClose: () => void
  campaignTitle?: string
  /** The on-chain campaign this sheet funds — ALWAYS the one on screen. */
  campaignId?: string
  /** The chain the backer's money is auto-detected on (the CCTP source). */
  fromChain?: Chain
  /** Amount pre-selected when the sheet opens — carried from the entry CTA so
   *  "Chip in $25" opens to $25, not a silent $10 switch. */
  initialAmount?: number
  /** Fired after a real contribution lands on-chain — refresh the live bar. */
  onContributed?: () => void
}

// Real contribution tiers. A FUNDED backer burns their own USDC for the full
// selected amount, gaslessly (ZeroDev 7702). A fresh (empty) email wallet falls
// back to the demo relayer, which caps the move to its finite testnet treasury
// and reports the real amount moved — the UI shows what actually landed.
const AMOUNTS = [10, 25, 100]
type Status = 'idle' | 'authing' | 'sending' | 'needs-funds' | 'funding' | 'done' | 'error'

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
  campaignId = '1',
  fromChain = 'base',
  initialAmount = AMOUNTS[0],
  onContributed,
}: ContributeSheetProps) {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState(initialAmount)
  // A typed custom amount. Non-empty ⇒ the preset chips deselect and `amount`
  // is driven by this field, so a stranger who wants $42 isn't boxed into
  // 10/25/100.
  const [customAmount, setCustomAmount] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [movedUsd, setMovedUsd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromOpen, setFromOpen] = useState(false)
  const chain = CHAIN_META[fromChain]
  // The backer's embedded-wallet address, learned at login — needed to bind the
  // GitHub faucet grant to the wallet that will spend it.
  const [walletAddr, setWalletAddr] = useState<string | null>(null)
  const [dispenser, setDispenser] = useState<DispenserStatus | null>(null)

  // Learn once whether the faucet is available, so the empty-wallet path can
  // decide instantly (offer GitHub) instead of stalling mid-flow.
  useEffect(() => {
    if (!open || dispenser) return
    dispenserStatusServerFn().then(setDispenser).catch(() => setDispenser({ enabled: false, claimUsd: 0, fallback: 'none' }))
  }, [open, dispenser])

  // Reset the flow whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStatus('idle')
        setEmail('')
        setAmount(initialAmount)
        setCustomAmount('')
        setMovedUsd(null)
        setError(null)
        setWalletAddr(null)
      }, 250)
      return () => clearTimeout(t)
    }
  }, [open])

  const inFlight = status === 'authing' || status === 'sending' || status === 'funding'
  const emailValid = /.+@.+\..+/.test(email)
  const canSend = emailValid && amount > 0 && (status === 'idle' || status === 'error')

  const send = async () => {
    if (!canSend) return
    setError(null)
    try {
      // 1. Real Magic email login — pops Magic's OTP overlay; a human types the
      //    code from their inbox. Resolves to the backer's embedded-wallet EOA.
      setStatus('authing')
      const user = await loginWithEmail(email)
      setWalletAddr(user.address)

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
      const gasless = await tryGaslessBackerBurn({ amountUsd: amount })
      if (gasless.funded) {
        // Backer burned their own USDC gaslessly — finish it server-side.
        const res = await completeContributionServerFn({
          data: {
            backer: gasless.backer,
            burnTxHash: gasless.burnTx,
            sourceDomain: gasless.sourceDomain,
            campaignId,
          },
        })
        finish(res.movedUsd)
        return
      }

      // Fresh/empty wallet. The honest product path: offer the GitHub-gated
      // testnet faucet so the backer funds THEIR OWN wallet, then spends it.
      const ds = dispenser ?? (await dispenserStatusServerFn())
      setDispenser(ds)
      if (ds.enabled && ds.fallback !== 'relayer') {
        setStatus('needs-funds')
        return
      }

      // Fallback (faucet off, or kill-switch DISPENSER_FALLBACK=relayer): the
      // old demo behavior — relayer fronts the source USDC, capped to its
      // finite treasury, recorded under the backer's real address.
      const res = await contributeServerFn({
        data: { backer: user.address, amountUsd: amount, campaignId },
      })
      finish(res.movedUsd)
    } catch (e) {
      setError(friendlyMoneyError(e))
      setStatus('error')
    }
  }

  const finish = (moved: number) => {
    setMovedUsd(moved)
    setStatus('done')
    onContributed?.()
  }

  // The GitHub faucet round-trip: sign a wallet-bound state, pop GitHub, and on
  // a granted claim retry the REAL gasless burn (now the wallet holds funds).
  const claimAndSend = async () => {
    if (!walletAddr) return
    setError(null)
    setStatus('funding')
    try {
      const { authorizeUrl } = await beginClaimServerFn({ data: { wallet: walletAddr } })
      const claim = await openClaimPopup(authorizeUrl)
      if (!claim.ok) {
        setError(claimFailMessage(claim))
        setStatus('needs-funds')
        return
      }

      // Funds are landing — spend up to what the faucet granted, from the
      // backer's own wallet, gaslessly. Retry through RPC lag.
      setStatus('sending')
      const spend = Math.min(amount, claim.amountUsd ?? dispenser?.claimUsd ?? amount)
      let gasless = await tryGaslessBackerBurn({ amountUsd: spend })
      for (let i = 0; i < 5 && !gasless.funded; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        gasless = await tryGaslessBackerBurn({ amountUsd: spend })
      }
      if (!gasless.funded) throw new Error('the faucet funds are still settling — try again in a moment')

      const res = await completeContributionServerFn({
        data: {
          backer: gasless.backer,
          burnTxHash: gasless.burnTx,
          sourceDomain: gasless.sourceDomain,
          campaignId,
        },
      })
      finish(res.movedUsd)
    } catch (e) {
      setError(friendlyMoneyError(e))
      setStatus('error')
    }
  }

  const grant = dispenser?.claimUsd ?? 5

  return (
    <BottomSheet open={open} onClose={onClose} title={status === 'done' ? undefined : 'Chip in'}>
      {status === 'done' ? (
        <SuccessView amount={movedUsd ?? amount} campaignTitle={campaignTitle} onDone={onClose} />
      ) : status === 'needs-funds' || status === 'funding' ? (
        <div className="flex flex-col gap-5 pb-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-paper" style={{ fontFamily: 'var(--font-display)' }}>
              First time? Grab test funds
            </h3>
            <p className="text-[15px] leading-relaxed text-muted">
              Rally runs on test money while it's pre-launch. Verify once with GitHub and we'll
              put <span className="font-medium text-paper">${grant}</span> of testnet USDC in
              your wallet — then it's <span className="font-medium text-paper">your</span> money
              moving, gaslessly, from Base to Arbitrum.
            </p>
          </div>

          {error ? (
            <p className="-mt-1 text-[13px] font-medium leading-relaxed text-warn">{error}</p>
          ) : null}

          <button
            onClick={claimAndSend}
            disabled={status === 'funding'}
            className={`relative flex w-full items-center justify-center gap-2.5 rounded-full py-4 text-base font-semibold transition-transform duration-150 ease-[var(--ease-rally)] active:scale-[0.97] disabled:opacity-70 ${FOCUS_RING}`}
            style={{
              background: 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
              color: 'var(--color-ink-950)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
            }}
          >
            {status === 'funding' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Waiting for GitHub…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z" />
                </svg>
                Verify with GitHub · get ${grant}
              </>
            )}
          </button>

          <p className="text-center text-xs text-faint">
            One grant per GitHub account. Testnet only — no real money, ever.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <p className="-mt-1 text-[15px] leading-relaxed text-muted">
            Enter your email and pick an amount — you're in from whatever chain your
            money's on. Nothing to install, nothing to set up.
          </p>

          {/* Email — the nag lives on the field, not on the thesis line. */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-faint">Email</span>
              {!emailValid && (
                <span className="text-xs text-faint">enter yours to chip in</span>
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
              className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60 ${FOCUS_RING}`}
            />
          </label>

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">Amount</span>
            <div className="grid grid-cols-3 gap-2">
              {AMOUNTS.map((a) => {
                // A preset reads as chosen only while no custom amount is typed.
                const active = customAmount === '' && amount === a
                return (
                  <button
                    key={a}
                    onClick={() => {
                      setAmount(a)
                      setCustomAmount('')
                    }}
                    disabled={inFlight}
                    className={`relative rounded-xl py-3 text-base font-semibold transition-colors disabled:opacity-60 ${FOCUS_RING}`}
                    style={
                      active
                        ? { background: 'rgba(255,255,255,0.10)', color: 'var(--color-paper)' }
                        : { background: 'rgba(255,255,255,0.04)', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {active && (
                      <motion.span
                        layoutId="amount-pill-glow"
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
            {/* Custom amount — nobody who wants $42 should hit a 10/25/100 wall.
                Same field grammar as the create-flow goal input ($ lead, tabular
                figures, decimal keypad); typing here drives `amount` and quietly
                deselects the presets above. */}
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted">
                $
              </span>
              <input
                inputMode="decimal"
                placeholder="Other amount"
                value={customAmount}
                disabled={inFlight}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '')
                  setCustomAmount(raw)
                  setAmount(Math.max(0, Number(raw) || 0))
                }}
                className={`tnum w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-8 pr-4 text-base text-paper outline-none transition-colors placeholder:font-normal placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60 ${FOCUS_RING}`}
              />
            </div>
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setFromOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-muted"
              >
                Paying from
                <span className="inline-flex items-center gap-1.5 font-medium capitalize text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: chain.to }} />
                  {chain.label ?? fromChain}
                </span>
                <ChevronDown
                  size={13}
                  className="transition-transform"
                  style={{ transform: fromOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {fromOpen && (
                <p className="mt-1.5 max-w-[19rem] text-[13px] leading-relaxed text-faint">
                  Your USDC moves as a Circle CCTP transfer and lands on Arbitrum — no network
                  to switch, no bridge to figure out.
                </p>
              )}
            </div>
          </div>

          {/* Error line — honest, quiet. */}
          {status === 'error' && error && (
            <p className="-mb-1 text-[13px] font-medium leading-relaxed text-warn">{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={send}
            disabled={!canSend}
            className={`relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold transition-[transform,background-color,color,box-shadow] duration-150 ease-[var(--ease-rally)] active:scale-[0.97] ${FOCUS_RING}`}
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
                <Loader2 size={18} className="animate-spin [animation-duration:0.6s]" /> Check your email…
              </>
            ) : status === 'sending' ? (
              <>
                <Loader2 size={18} className="animate-spin [animation-duration:0.6s]" /> Sending…
              </>
            ) : status === 'error' ? (
              <>Try again</>
            ) : !emailValid ? (
              // A disabled CTA should teach what's missing, not just sit gray
              // repeating the amount — the email is the one thing between a
              // stranger and chipping in.
              <>Enter your email to chip in</>
            ) : amount <= 0 ? (
              <>Enter an amount</>
            ) : (
              <>Chip in {formatUsd(amount)}</>
            )}
          </button>

          {/* One quiet line, UNCONDITIONAL — the whole thesis, placed where a
              stranger decides to hand over money: all-or-nothing, refunded
              automatically if the goal misses. It never yields to a form nag;
              this safety line is what converts someone who owes us nothing. */}
          <p className="-mt-1 text-center text-[13px] leading-relaxed text-faint">
            Hit the goal or everyone's refunded —{' '}
            <span className="text-muted">automatically</span>.
          </p>
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
  // One quiet haptic tick, same frame as the check appearing — the money
  // landed. The ONLY haptic in the app: feedback reserved for the moment
  // that earns it, fired together with its visual so the senses agree.
  useEffect(() => {
    try {
      navigator.vibrate?.(10)
    } catch {
      // haptics are a bonus, never a requirement
    }
  }, [])
  return (
    // The phase swap is a hard conditional — a 6px rise bridges it so success
    // arrives instead of teleporting in (the check's spring rides on top).
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative flex flex-col items-center gap-4 py-4 text-center"
    >
      <Confetti active skin="rally" particleCount={110} />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
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
        className="mt-1 w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-base font-semibold text-paper transition-[color,background-color,transform] duration-150 ease-[var(--ease-rally)] active:scale-[0.98]"
      >
        Back to the rally
      </button>
    </motion.div>
  )
}

export default ContributeSheet
