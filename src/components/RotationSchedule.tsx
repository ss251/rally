import { Check, X } from 'lucide-react'
import type { CircleRoundView } from '#/lib/circle'

interface RotationScheduleProps {
  rounds: CircleRoundView[]
  className?: string
}

/**
 * The rotation, compact: one pill per round → payee, reading left to right in
 * payout order. Claimed rounds carry a check, the current round pulses coral,
 * a failed round is marked plainly. This is the "whose turn is it" strip that
 * makes the ROSCA mechanic legible at a glance.
 */
export function RotationSchedule({ rounds, className }: RotationScheduleProps) {
  return (
    <section className={className} aria-label="Rotation schedule">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-paper">
          {/* Static — one pulsing dot per screen, and it belongs to the hero.
              Same section-header anatomy as ContributorFeed/CircleMembers. */}
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: 'rgba(255,241,232,0.82)' }}
          />
          The rotation
        </h3>
        <span className="text-xs text-faint">one pot each round</span>
      </header>
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: 'none',
          // Fade the right edge so a long rotation reads as "scroll for more"
          // instead of getting hard-cropped by the viewport.
          WebkitMaskImage: 'linear-gradient(90deg, #000 88%, transparent)',
          maskImage: 'linear-gradient(90deg, #000 88%, transparent)',
        }}
      >
        {rounds.map((r, i) => {
          const current = r.state === 'current'
          const claimed = r.state === 'claimed'
          const ready = r.state === 'ready'
          const failed = r.state === 'failed'
          return (
            <span key={r.index} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-[10px] text-faint/70">
                  →
                </span>
              )}
              {/* Emphasis is warm-white lift, never the CTA's coral — the same
                  "raised row" grammar as the feed's newest contribution. */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                style={
                  current
                    ? {
                        borderColor: 'rgba(255,255,255,0.32)',
                        background: 'rgba(255,255,255,0.09)',
                        color: 'var(--color-paper)',
                      }
                    : ready
                      ? {
                          borderColor: 'rgba(255,255,255,0.22)',
                          background: 'rgba(255,255,255,0.03)',
                          color: 'var(--color-paper)',
                        }
                      : {
                          borderColor: 'var(--color-line)',
                          background: 'var(--color-surface)',
                          // Failed reads calm-muted (the × carries the fact) —
                          // a stopped circle is settled, never alarm-amber.
                          color: failed
                            ? 'var(--color-muted)'
                            : claimed
                              ? 'var(--color-muted)'
                              : 'var(--color-faint)',
                        }
                }
              >
                {current && (
                  <span
                    className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
                    style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
                  />
                )}
                {claimed && <Check size={11} strokeWidth={3} className="text-muted" />}
                {ready && <Check size={11} strokeWidth={3} style={{ color: 'rgba(255,241,232,0.9)' }} />}
                {failed && <X size={11} strokeWidth={3} />}
                {r.payeeName}
              </span>
            </span>
          )
        })}
      </div>
    </section>
  )
}

export default RotationSchedule
