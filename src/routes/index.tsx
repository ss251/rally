import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6">
      {/* Ambient dusk bloom — the page is dusk, the accent is warmth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, var(--color-rally-glow) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 max-w-xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-faint">
          Live cross-chain fundraising
        </p>
        <h1
          className="mt-5 text-6xl font-semibold tracking-tight text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Rally
        </h1>
        <p className="mt-6 text-lg text-muted">
          One link. A bar that fills itself from every chain. Hit the goal, or
          everyone gets their money back.
        </p>
        <p className="mt-4 text-sm text-faint">
          Deployed on Arbitrum Sepolia · testnet only
        </p>
      </div>
    </main>
  )
}
