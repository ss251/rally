import { Check, Crown } from 'lucide-react'
import { avatarGradient, formatUsd, initials } from '#/design/chains'
import type { CircleMemberView, CircleStatusView } from '#/lib/circle'

interface CircleMembersProps {
  members: CircleMemberView[]
  status: CircleStatusView
  /** Per-member per-round contribution, whole USDC units. */
  depositUsd: number
  /** The signed-in member's address (marks their row "You"). */
  youAddress?: string | null
  className?: string
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

function Avatar({ name, open }: { name: string; open: boolean }) {
  if (open) {
    return (
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/20 text-xs font-bold text-faint"
      >
        ?
      </span>
    )
  }
  const g = avatarGradient(name)
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      {initials(name)}
    </span>
  )
}

/**
 * The circle's cast, in payout order — who's in this round, who's waiting,
 * whose pot it is. On a broken circle each row flips to what that member gets
 * back. Mirrors ContributorFeed's row anatomy so the two products read as one
 * family.
 */
export function CircleMembers({
  members,
  status,
  depositUsd,
  youAddress,
  className,
}: CircleMembersProps) {
  const broken = status === 'broken'
  const filling = status === 'filling'

  return (
    <section className={`flex flex-col ${className ?? ''}`} aria-label="Circle members">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-paper">
          <span
            className="animate-pulse-dot h-2 w-2 rounded-full"
            style={{ background: 'rgba(255,241,232,0.82)', color: 'rgba(255,241,232,0.82)' }}
          />
          {broken ? 'Everyone gets back' : filling ? 'Seats' : 'This round'}
        </h3>
        <span className="tnum text-xs text-faint">
          {members.filter((m) => m.address !== ZERO_ADDR).length} of {members.length} members
        </span>
      </header>

      <ul className="flex flex-col gap-2">
        {members.map((m) => {
          const open = m.address === ZERO_ADDR
          const you =
            !!youAddress && !open && m.address.toLowerCase() === youAddress.toLowerCase()
          const name = you ? `${m.name} · You` : m.name
          const highlight = m.isPayee && !broken && !filling
          return (
            <li
              key={m.seat}
              className="flex items-center gap-3 rounded-2xl border p-2.5 pr-3.5"
              style={{
                borderColor: highlight ? 'rgba(255,122,80,0.35)' : 'var(--color-line)',
                background: highlight ? 'rgba(255,122,80,0.07)' : 'var(--color-surface)',
                boxShadow: highlight ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : undefined,
              }}
            >
              <Avatar name={m.name} open={open} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`truncate text-sm font-semibold ${open ? 'text-faint' : 'text-paper'}`}>
                    {open ? 'Open seat' : name}
                  </span>
                  {highlight && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-rally-500)', background: 'rgba(255,122,80,0.12)' }}
                    >
                      <Crown size={11} strokeWidth={2.5} /> this pot
                    </span>
                  )}
                </div>
                <p className="text-xs text-faint">
                  {open ? 'waiting for an invite' : `takes round ${m.seat + 1}’s pot`}
                </p>
              </div>
              {broken ? (
                <span className="tnum shrink-0 text-sm font-bold text-paper">
                  {m.refundableUsd > 0 ? formatUsd(m.refundableUsd) : '—'}
                </span>
              ) : filling || open ? (
                <span className="shrink-0 text-xs text-faint">{open ? '' : 'in'}</span>
              ) : m.fundedThisRound ? (
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-paper">
                  <Check size={14} strokeWidth={3} style={{ color: 'var(--color-rally-500)' }} />
                  <span className="tnum">+{formatUsd(depositUsd)}</span>
                </span>
              ) : (
                <span className="shrink-0 text-xs text-faint">waiting</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default CircleMembers
