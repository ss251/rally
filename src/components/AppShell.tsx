import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
  /** Pinned thumb-zone action(s) — hugs the bottom safe-area, thumb-reachable. */
  cta?: ReactNode
  /** Optional top bar content (back button, title). */
  header?: ReactNode
  /** Constrain the reading column; the hero can still bleed via `bleed`. */
  className?: string
}

/**
 * Rally's mobile-first frame. A single centered column (max ~480px) on the dusk
 * canvas with an ambient bloom, notch-aware safe-area padding, and an optional
 * pinned thumb-zone CTA region that never sits under the home indicator.
 *
 * Desktop just centers the same phone-width column — the product is phone-first
 * (held at a party), never a stretched dashboard.
 */
export function AppShell({ children, cta, header, className }: AppShellProps) {
  return (
    <div className="relative flex min-h-[100dvh] justify-center">
      {/* No decorative background gradient. The only light in Rally comes from
          the liquid itself — the hero casts its own glow. Pure dusk canvas. */}
      <div className="relative z-10 flex w-full max-w-[480px] flex-col px-safe">
        {header && (
          <header className="pt-safe sticky top-0 z-20">
            <div className="flex items-center gap-3 px-5 py-3">{header}</div>
          </header>
        )}

        {/* Scroll region. Bottom padding leaves room for the pinned CTA. */}
        <main
          className={`flex-1 px-5 ${header ? '' : 'pt-safe'} ${
            cta ? 'pb-40' : 'pb-safe'
          } ${className ?? ''}`}
        >
          {children}
        </main>

        {/* Thumb-zone CTA region — pinned, frosted, safe-area aware. */}
        {cta && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
            <div className="pointer-events-auto w-full max-w-[480px] px-safe">
              <div
                className="pb-safe-cta px-5 pt-4"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, var(--color-ink-950) 55%)',
                }}
              >
                {cta}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppShell
