/**
 * GitHub OAuth landing — the dispenser popup returns here.
 * Reads ?code&state, redeems the claim server-side, then hands the result to
 * the opener (the chip-in sheet) via postMessage and closes itself. Kept
 * deliberately quiet: a real user sees it for ~a second.
 */
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { redeemClaimServerFn } from '#/lib/dispense-actions'

export const Route = createFileRoute('/oauth/github')({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === 'string' ? s.code : '',
    state: typeof s.state === 'string' ? s.state : '',
  }),
  component: OAuthGithub,
})

type Phase = 'working' | 'done' | 'failed'

function OAuthGithub() {
  const { code, state } = Route.useSearch()
  const [phase, setPhase] = useState<Phase>('working')
  const [detail, setDetail] = useState('Verifying with GitHub…')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!code || !state) throw new Error('missing code/state')
        const res = await redeemClaimServerFn({ data: { code, state } })
        if (cancelled) return
        window.opener?.postMessage({ source: 'rally-dispenser', ...res }, window.location.origin)
        if (res.ok) {
          setPhase('done')
          setDetail(`$${res.amountUsd} of test USDC is on its way to your wallet.`)
          setTimeout(() => window.close(), 1200)
        } else if (res.reason === 'already-claimed') {
          setPhase('failed')
          setDetail('This GitHub account has already claimed its test funds.')
          setTimeout(() => window.close(), 2600)
        } else if (res.reason === 'treasury-empty') {
          setPhase('failed')
          setDetail('The faucet is empty right now — check back soon.')
          setTimeout(() => window.close(), 2600)
        } else {
          setPhase('failed')
          setDetail(res.message ?? 'Something went wrong — close this window and try again.')
        }
      } catch (e) {
        if (cancelled) return
        window.opener?.postMessage(
          { source: 'rally-dispenser', ok: false, reason: 'error', message: String(e) },
          window.location.origin,
        )
        setPhase('failed')
        setDetail('Something went wrong — you can close this window and try again.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, state])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 px-8 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          background:
            phase === 'failed'
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-600))',
        }}
      >
        {phase === 'working' ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
        ) : phase === 'done' ? (
          <span className="text-xl text-ink-950">✓</span>
        ) : (
          <span className="text-xl text-muted">·</span>
        )}
      </span>
      <p className="max-w-xs text-[15px] leading-relaxed text-muted">{detail}</p>
      <p className="text-xs text-faint">Testnet only — no real money. You can close this window.</p>
    </main>
  )
}
