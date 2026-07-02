import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '#/components/AppShell'
import { BottomSheet } from '#/components/BottomSheet'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <AppShell
        cta={
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97]"
            style={{
              background:
                'linear-gradient(90deg, var(--color-rally-600), var(--color-rally-300))',
              boxShadow: '0 8px 30px -8px var(--color-rally-glow)',
            }}
          >
            Start a Rally
          </button>
        }
      >
        <div className="flex min-h-[70dvh] flex-col justify-center py-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-faint">
            Live cross-chain fundraising
          </p>
          <h1
            className="vt-hero mt-4 text-6xl font-semibold leading-[0.95] tracking-tight text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Rally
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            One link. A bar that fills itself from every chain. Hit the goal, or
            everyone gets their money back.
          </p>
          <p className="mt-4 text-sm text-faint">
            Deployed on Arbitrum Sepolia · testnet only
          </p>
        </div>
      </AppShell>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Start a Rally"
      >
        <p className="pb-4 text-muted">
          Name it, set a goal and a deadline, and share one link. The bar fills
          itself as friends chip in from any chain.
        </p>
        <div className="grid gap-2 pb-2 text-sm text-faint">
          <span>Drag this sheet down, tap outside, or press Esc to close.</span>
        </div>
      </BottomSheet>
    </>
  )
}
