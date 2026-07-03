import { Link } from '@tanstack/react-router'
import { RotateCw, Target } from 'lucide-react'

/**
 * The two shapes of group money, one tap apart — Goals fill toward a target,
 * Circles rotate a pot through the crew. Lives directly under the header on
 * both landings so discovering the second mode never depends on scrolling
 * past the feed. Selected state is the canonical quiet white inset ring
 * (ContributeSheet's amount chips) — coral stays reserved for the CTA.
 */
export function ModeSwitch({ active }: { active: 'goals' | 'circles' }) {
  const opts = [
    { key: 'goals' as const, label: 'Goals', Icon: Target, to: '/' },
    { key: 'circles' as const, label: 'Circles', Icon: RotateCw, to: '/circles' },
  ]
  return (
    <nav
      aria-label="Rally modes"
      className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5"
    >
      {opts.map(({ key, label, Icon, to }) => {
        const isActive = active === key
        return (
          <Link
            key={key}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex items-center justify-center gap-2 rounded-[10px] py-2 text-[13px] font-semibold transition-colors"
            style={{ color: isActive ? 'var(--color-paper)' : 'var(--color-faint)' }}
          >
            {isActive && (
              <span
                aria-hidden
                // Concentric with the frame: 16px row radius − 6px inset = 10px.
                className="pointer-events-none absolute inset-0 rounded-[10px]"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)',
                }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon size={14} strokeWidth={2.5} /> {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

export default ModeSwitch
