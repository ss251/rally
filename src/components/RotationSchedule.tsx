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
      <header className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-paper">The rotation</h3>
        <span className="text-xs text-faint">one pot each round</span>
      </header>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
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
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium"
                style={
                  current
                    ? {
                        borderColor: 'rgba(255,122,80,0.4)',
                        background: 'rgba(255,122,80,0.12)',
                        color: 'var(--color-paper)',
                      }
                    : ready
                      ? {
                          borderColor: 'rgba(255,122,80,0.35)',
                          background: 'rgba(255,255,255,0.03)',
                          color: 'var(--color-paper)',
                        }
                      : {
                          borderColor: 'var(--color-line)',
                          background: 'var(--color-surface)',
                          color: failed
                            ? 'var(--color-warn)'
                            : claimed
                              ? 'var(--color-muted)'
                              : 'var(--color-faint)',
                        }
                }
              >
                {current && (
                  <span
                    className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--color-rally-500)', color: 'var(--color-rally-500)' }}
                  />
                )}
                {claimed && <Check size={11} strokeWidth={3} style={{ color: 'var(--color-rally-500)' }} />}
                {ready && <Check size={11} strokeWidth={3} style={{ color: 'var(--color-rally-500)' }} />}
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
