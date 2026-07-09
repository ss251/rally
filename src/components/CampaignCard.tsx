import { useEffect, useState, type ElementType } from 'react'
import { ArrowUpRight, Clock, Gift, Users } from 'lucide-react'
import {
  ACCENT,
  CHAIN_META,
  CHAIN_ORDER,
  avatarGradient,
  countdown,
  initials,
  pct as pctOf,
  type CampaignStatus,
  type Chain,
  type ChainSegment,
  type Skin,
} from '#/design/chains'
import { Thermometer } from './Thermometer'
import { ChainIcon } from './ChainIcon'

export interface Backer {
  name: string
  avatarUrl?: string
}

export interface Campaign {
  id: string
  title: string
  organizer: string
  /** Whole USDC units. */
  raised: number
  goal: number
  currency?: string
  /** Epoch ms. */
  deadline: number
  backerCount: number
  segments?: ChainSegment[]
  /** For the avatar stack (a few sample backers). */
  backers?: Backer[]
  coverUrl?: string
  status?: CampaignStatus
  /** 'rally' = fundraiser, 'potluck' = group gift. */
  mode?: Skin
}

interface CampaignCardProps {
  campaign: Campaign
  href?: string
  /** Called on card / CTA activation (wire to router). */
  onOpen?: (id: string) => void
  /** Shorter cover — for tight spaces like the create-flow live preview. */
  compact?: boolean
  className?: string
}

function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Overlapping avatar stack + count. */
function BackerStack({ backers, count }: { backers?: Backer[]; count: number }) {
  const shown = (backers ?? []).slice(0, 4)
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2.5">
        {shown.map((b, i) => {
          const g = avatarGradient(b.name)
          return b.avatarUrl ? (
            <img
              key={i}
              src={b.avatarUrl}
              alt={b.name}
              className="h-6 w-6 rounded-full object-cover ring-2 ring-ink-900"
            />
          ) : (
            <span
              key={i}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-ink-900"
              style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
              aria-hidden="true"
            >
              {initials(b.name)}
            </span>
          )
        })}
      </div>
      <span className="tnum inline-flex items-center gap-1 text-xs text-muted">
        <Users size={12} /> {count}
      </span>
    </div>
  )
}

/**
 * The shareable "one link" surface — the thing that lands in a group chat. Reads
 * like a consumer share card: cover, goal, a live mini-thermometer, who's in,
 * which chains are flowing, and time left. Tapping opens the full campaign.
 *
 * Presentational only — pass a `campaign` and wire `onOpen`/`href`.
 */
export function CampaignCard({ campaign, href, onOpen, compact, className }: CampaignCardProps) {
  const now = useNow()
  const skin: Skin = campaign.mode ?? 'rally'
  const accent = ACCENT[skin]
  const currency = campaign.currency ?? 'USDC'
  const realPct = pctOf(campaign.raised, campaign.goal, 9999)
  const funded = campaign.status === 'funded' || realPct >= 100
  const cd = now == null ? null : countdown(campaign.deadline, now)

  // Which chains have flowed in (for the badge row).
  const activeChains: Chain[] = CHAIN_ORDER.filter((ch) =>
    (campaign.segments ?? []).some((s) => s.chain === ch && s.amount > 0),
  )

  const handleOpen = () => onOpen?.(campaign.id)

  const Wrapper = (href ? 'a' : 'div') as ElementType
  const wrapperProps: Record<string, unknown> = href ? { href } : {}

  return (
    <Wrapper
      {...wrapperProps}
      onClick={handleOpen}
      className={`group block overflow-hidden border border-white/10 bg-ink-900 text-left no-underline shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-[var(--ease-rally)] hover:-translate-y-1 hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className ?? ''}`}
      style={{ borderRadius: 'var(--radius-card)', outlineColor: accent.solid }}
    >
      {/* Cover */}
      <div className={`relative overflow-hidden ${compact ? 'h-16' : 'h-28'}`}>
        {campaign.coverUrl ? (
          <img src={campaign.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full animate-sheen"
            style={{
              // The cover wears the WARM brand ramp (coral→amber for rally,
              // magenta→gold for potluck), not raw chain blue/purple — the
              // artifact that lands in a group chat has to read human, not like
              // a generic crypto gradient. Chain identity lives in the "from"
              // badge row below, never in the cover wash.
              background: `radial-gradient(120% 140% at 15% 0%, ${accent.from}, transparent 55%), radial-gradient(120% 140% at 100% 100%, ${accent.to}, ${accent.from})`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />

        {/* Mode + status chips */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {skin === 'potluck' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold text-paper backdrop-blur">
              <Gift size={11} /> Group gift
            </span>
          )}
          {funded && (
            <span className="rounded-full bg-white/[0.14] px-2 py-1 text-[10px] font-bold text-paper backdrop-blur">
              FUNDED
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold leading-snug text-paper">
            {campaign.title}
          </h3>
          <p className="mt-0.5 text-xs text-faint">
            by <span className="text-muted">{campaign.organizer}</span>
          </p>
        </div>

        {/* Mini live thermometer */}
        <Thermometer
          raised={campaign.raised}
          goal={campaign.goal}
          segments={campaign.segments}
          currency={currency}
          skin={skin}
          orientation="horizontal"
          status={campaign.status}
          showReadout
        />

        {/* Meta row */}
        <div className="flex items-center justify-between pt-1">
          <BackerStack backers={campaign.backers} count={campaign.backerCount} />
          <span
            className={`tnum inline-flex items-center gap-1 text-xs ${
              cd?.urgent ? 'font-medium text-warn' : 'text-muted'
            }`}
          >
            <Clock size={12} /> {cd == null ? '—' : cd.label}
          </span>
        </div>

        {/* Chain flow + CTA */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-faint">from</span>
            {activeChains.length ? (
              activeChains.map((ch) => (
                <span key={ch} title={CHAIN_META[ch].label} className="flex">
                  <ChainIcon chain={ch} size={15} />
                </span>
              ))
            ) : (
              <span className="text-[10px] text-faint">any chain</span>
            )}
          </div>
          {/* Paper, not coral — the card's whole surface is the press target,
              and coral is reserved for the screen's one real CTA. */}
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-paper transition-transform group-hover:translate-x-0.5">
            {funded ? 'View rally' : 'Chip in'}
            <ArrowUpRight size={15} strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Wrapper>
  )
}

export default CampaignCard
