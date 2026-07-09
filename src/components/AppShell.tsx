import { useEffect, useRef, useState, type ReactNode } from 'react'

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
 * The pinned CTA zone's real rendered height (it varies: one button, button +
 * ghost link, button + helper line…). The scroll region pads by THIS + 24px so
 * the last row of content can always scroll fully clear of the buttons —
 * a docked CTA must never decapitate content (design roast #3).
 */
function useMeasuredHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [h, setH] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    setH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])
  return [ref, h]
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
  const [ctaRef, ctaHeight] = useMeasuredHeight<HTMLDivElement>()
  return (
    <div className="relative flex min-h-[100dvh] justify-center">
      {/* No decorative background gradient. The only light in Rally comes from
          the liquid itself — the hero casts its own glow. Pure dusk canvas. */}
      <div className="relative z-10 flex w-full max-w-[480px] flex-col px-safe">
        {header && (
          <header className="pt-safe sticky top-0 z-20 bg-ink-950/72 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-5 py-3">{header}</div>
          </header>
        )}

        {/* Scroll region. Bottom padding = the MEASURED pinned-CTA height + 24px
            breathing room (pb-48 fallback until the first measurement lands). */}
        <main
          className={`flex-1 px-5 ${header ? '' : 'pt-safe'} ${
            cta ? (ctaHeight ? '' : 'pb-48') : 'pb-safe'
          } ${className ?? ''}`}
          style={cta && ctaHeight ? { paddingBottom: ctaHeight + 24 } : undefined}
        >
          {children}
        </main>

        {/* Thumb-zone CTA region — pinned, safe-area aware, over its own scrim
            so scrolled content dips into shadow before it reaches the buttons. */}
        {cta && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
            <div className="pointer-events-auto w-full max-w-[480px] px-safe">
              <div
                ref={ctaRef}
                className="pb-safe-cta px-5 pt-10"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-ink-950) 86%, transparent) 26%, var(--color-ink-950) 52%)',
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
