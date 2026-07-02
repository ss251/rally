import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Gift, PartyPopper } from 'lucide-react'
import { motion } from 'motion/react'
import { AppShell } from '#/components/AppShell'
import { CampaignCard, type Campaign } from '#/components/CampaignCard'
import { ShareLink } from '#/components/ShareLink'
import type { Skin } from '#/design/chains'

export const Route = createFileRoute('/create')({ component: CreateCampaign })

const DAY = 24 * 60 * 60 * 1000
const DEADLINES: { label: string; days: number }[] = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '30 days', days: 30 },
]

// Skin-aware copy — the same form builds a fundraiser or a group gift.
const COPY: Record<Skin, { titlePh: string; goalLabel: string; goalPh: string; verb: string; kicker: string }> = {
  rally: {
    titlePh: 'Send the crew to Tokyo',
    goalLabel: 'Goal',
    goalPh: '4,000',
    verb: 'Start the rally',
    kicker: 'A goal bar your friends fill together.',
  },
  potluck: {
    titlePh: 'Priya’s surprise send-off',
    goalLabel: 'Gift pool',
    goalPh: '600',
    verb: 'Start the potluck',
    kicker: 'A group gift everyone chips into.',
  },
}

function CreateCampaign() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Skin>('rally')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [days, setDays] = useState(7)
  const [created, setCreated] = useState(false)

  const copy = COPY[mode]
  const goalNum = Math.max(0, Number(goal.replace(/[^0-9.]/g, '')) || 0)
  const canCreate = title.trim().length > 1 && goalNum > 0

  // The live preview (also the artifact shown on success). Re-skins in place as
  // the Rally/Potluck toggle flips — same card, different accent + voice.
  const preview: Campaign = useMemo(
    () => ({
      id: 'preview',
      title: title.trim() || copy.titlePh,
      organizer: 'You',
      raised: 0,
      goal: goalNum || Number(copy.goalPh.replace(/[^0-9.]/g, '')),
      deadline: Date.now() + days * DAY,
      backerCount: 0,
      segments: [],
      mode,
    }),
    [title, goalNum, days, mode, copy.titlePh, copy.goalPh],
  )

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/c/1` : '/c/1'

  if (created) {
    return (
      <AppShell header={<CreateHeader />}>
        <div className="flex flex-col gap-6 pt-6">
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-muted"
            >
              {mode === 'potluck' ? 'Your potluck is live ✦' : 'Your rally is live ✦'}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-1.5 text-[1.9rem] font-semibold leading-tight tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Drop this in the group chat
            </motion.h1>
            <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-muted">
              One tap for anyone to chip in — from whatever chain their money's on.
              No wallet, no gas, no seed phrase.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <CampaignCard campaign={preview} onOpen={() => navigate({ to: '/c/$id', params: { id: '1' } })} />
          </motion.div>

          <div className="flex flex-col gap-2.5">
            <ShareLink variant="primary" url={shareUrl} label="Copy the link" />
            <Link
              to="/c/$id"
              params={{ id: '1' }}
              className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-center text-base font-semibold text-paper transition-transform active:scale-[0.98]"
            >
              Open the rally →
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={<CreateHeader />}
      cta={
        <button
          onClick={() => canCreate && setCreated(true)}
          disabled={!canCreate}
          className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97] disabled:opacity-45"
          style={{
            background: 'var(--color-rally-500)',
            boxShadow:
              '0 1px 0 0 rgba(255,255,255,0.35) inset, 0 10px 34px -10px var(--color-rally-glow)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
          />
          {copy.verb}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1
            className="text-[2rem] font-semibold leading-[1.05] tracking-tight text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Start something
          </h1>
          <p className="mt-1.5 text-sm text-muted">{copy.kicker}</p>
        </div>

        {/* Mode toggle — flips the preview below between fundraiser + group gift. */}
        <ModeToggle mode={mode} onChange={setMode} />

        {/* Live preview — the shareable card, re-skinning as you type + toggle. */}
        <CampaignCard campaign={preview} compact />

        {/* Title */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            What are you raising for?
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.titlePh}
            maxLength={60}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-rally-500/70 focus:bg-white/[0.06]"
          />
        </label>

        {/* Goal */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            {copy.goalLabel}
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted">
              $
            </span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              inputMode="decimal"
              placeholder={copy.goalPh}
              className="tnum w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-8 pr-16 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-rally-500/70 focus:bg-white/[0.06]"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-faint">
              USDC
            </span>
          </div>
        </label>

        {/* Deadline */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Runs for</span>
          <div className="grid grid-cols-4 gap-2">
            {DEADLINES.map((d) => {
              const active = days === d.days
              return (
                <button
                  key={d.days}
                  onClick={() => setDays(d.days)}
                  className="relative rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  style={
                    active
                      ? { background: 'var(--color-rally-500)', color: 'var(--color-ink-950)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-paper)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="deadline-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: '0 8px 26px -8px var(--color-rally-glow)' }}
                    />
                  )}
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function CreateHeader() {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Link
          to="/"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted transition-colors active:scale-95 hover:text-paper"
        >
          <ArrowLeft size={18} />
        </Link>
        <span
          className="text-lg font-semibold tracking-tight text-paper"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          New rally
        </span>
      </div>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: Skin; onChange: (m: Skin) => void }) {
  const opts: { key: Skin; label: string; Icon: typeof Gift }[] = [
    { key: 'rally', label: 'Rally', Icon: PartyPopper },
    { key: 'potluck', label: 'Potluck', Icon: Gift },
  ]
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
      {opts.map(({ key, label, Icon }) => {
        const active = mode === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors"
            style={{ color: active ? 'var(--color-paper)' : 'var(--color-faint)' }}
          >
            {active && (
              <motion.span
                layoutId="mode-toggle-pill"
                className="absolute inset-0 rounded-xl border border-white/10"
                style={{
                  background:
                    key === 'potluck'
                      ? 'linear-gradient(90deg, rgba(255,92,154,0.22), rgba(255,194,75,0.14))'
                      : 'linear-gradient(90deg, rgba(255,122,80,0.22), rgba(255,176,32,0.12))',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon size={15} strokeWidth={2.5} /> {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
