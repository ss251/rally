import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Gift, Loader2, PartyPopper } from 'lucide-react'
import { motion } from 'motion/react'
import { AppShell } from '#/components/AppShell'
import { CampaignCard, type Campaign } from '#/components/CampaignCard'
import { ShareLink } from '#/components/ShareLink'
import { FOCUS_RING, type Skin } from '#/design/chains'
import { loginWithEmail } from '#/lib/auth/magic'
import { createCampaignServerFn } from '#/lib/campaign-actions'
import { loadCampaign, type CampaignView } from '#/lib/campaign'

export const Route = createFileRoute('/create')({
  // `?created=<id>` is the post-create success state (PRG: we navigate here
  // after the on-chain create lands, so refresh/share keeps the real screen).
  validateSearch: (search: Record<string, unknown>): { created?: string } =>
    typeof search.created === 'string' && /^[0-9]{1,10}$/.test(search.created)
      ? { created: search.created }
      : {},
  loaderDeps: ({ search }) => ({ created: search.created }),
  // Load the REAL campaign for the success screen — the link we hand out is
  // backed by a live read, not a copy of someone else's fund.
  loader: async ({ deps }): Promise<CampaignView | null> => {
    if (!deps.created) return null
    const load = await loadCampaign(deps.created)
    return load.kind === 'view' ? load.view : null
  },
  component: CreateCampaign,
})

const DAY = 24 * 60 * 60 * 1000
const DEADLINES: { label: string; days: number }[] = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '30 days', days: 30 },
]

// Skin-aware copy — the same form previews a fundraiser or a group gift.
// Rally creates for REAL (Magic login → GoalVault campaign on Arbitrum
// Sepolia). Potluck is an honest preview of the gift skin — it ships next.
const COPY: Record<Skin, { titlePh: string; goalLabel: string; goalPh: string; verb: string; kicker: string }> = {
  rally: {
    titlePh: 'Send the crew to Tokyo',
    goalLabel: 'Goal',
    goalPh: '4,000',
    verb: 'Start the rally',
    kicker: 'A goal bar your friends fill together.',
  },
  potluck: {
    titlePh: 'Kate’s surprise send-off',
    goalLabel: 'Gift pool',
    goalPh: '600',
    verb: 'Preview the potluck',
    kicker: 'A group gift everyone chips into.',
  },
}

type Status = 'idle' | 'authing' | 'creating' | 'error'

/** "sailesh.e123@gmail.com" → "Sailesh" — a warm organizer label, never hex. */
function organizerFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const token = local.split(/[._+\-]/).find((t) => /[a-zA-Z]/.test(t)) ?? ''
  const word = token.replace(/[^a-zA-Z]/g, '')
  if (!word) return 'The crew'
  return word[0].toUpperCase() + word.slice(1).toLowerCase()
}

function CreateCampaign() {
  const navigate = useNavigate()
  const createdView = Route.useLoaderData()
  const [mode, setMode] = useState<Skin>('rally')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [goal, setGoal] = useState('')
  const [days, setDays] = useState(7)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const copy = COPY[mode]
  const goalNum = Math.max(0, Number(goal.replace(/[^0-9.]/g, '')) || 0)
  const inFlight = status === 'authing' || status === 'creating'
  const canCreate =
    title.trim().length > 1 && goalNum > 0 && /.+@.+\..+/.test(email) && !inFlight

  // The live preview card, re-skinning in place as you type + toggle.
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

  const create = async () => {
    if (!canCreate) return
    setError(null)
    try {
      // 1. Real Magic email login — the creator's embedded wallet is the
      //    beneficiary: the money is theirs on success.
      setStatus('authing')
      const user = await loginWithEmail(email)

      // 2. createCampaign on the live GoalVault (the Rally relayer pays the
      //    testnet gas to open it; the fund itself belongs to the creator).
      setStatus('creating')
      const res = await createCampaignServerFn({
        data: {
          title: title.trim(),
          organizer: organizerFromEmail(email),
          goalUsd: goalNum,
          days,
          beneficiary: user.address,
        },
      })

      // 3. PRG to the success state — the loader re-reads the REAL campaign.
      setStatus('idle')
      navigate({
        to: '/create',
        search: { created: res.campaignId },
        replace: true,
      })
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  // —— Success: a REAL fund, a REAL link ————————————————————————————————
  if (createdView) {
    const c = createdView
    const path = `/c/${c.id}`
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    const card: Campaign = {
      id: c.id,
      title: c.title,
      organizer: 'You',
      raised: c.raised,
      goal: c.goal,
      deadline: c.deadline,
      backerCount: c.backerCount,
      segments: c.segments,
      mode: 'rally',
    }
    return (
      <AppShell header={<CreateHeader />}>
        <div className="flex flex-col gap-6 pt-6">
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-muted"
            >
              Your rally is live ✦
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-1.5 text-display font-semibold text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Drop this in the group chat
            </motion.h1>
            <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-muted">
              One tap for anyone to chip in — from whatever chain their money's on.
              Just their email — nothing to install, nothing to set up.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <CampaignCard
              campaign={card}
              onOpen={() => navigate({ to: '/c/$id', params: { id: c.id } })}
            />
          </motion.div>

          <div className="flex flex-col gap-2.5">
            <ShareLink variant="primary" url={shareUrl} label="Copy the link" />
            <Link
              to="/c/$id"
              params={{ id: c.id }}
              className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3.5 text-center text-base font-semibold text-paper transition-transform active:scale-[0.98]"
            >
              Open the rally →
            </Link>
          </div>

          {c.live && (
            <p className="text-center text-[13px] leading-relaxed text-faint">
              Fund #{c.id}, live on Arbitrum — the bar fills the moment
              money lands.
            </p>
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={<CreateHeader />}
      cta={
        mode === 'potluck' ? (
          // Honest: potluck creation ships next — this opens the live preview.
          <div className="flex flex-col items-center gap-2.5">
            <Link
              to="/c/$id"
              params={{ id: '1' }}
              search={{ skin: 'potluck' }}
              className={`relative flex w-full items-center justify-center overflow-hidden rounded-full py-4 text-base font-semibold text-ink-950 transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97] ${FOCUS_RING}`}
              style={{
                background: 'linear-gradient(180deg, #ff7db0, #ff5c9a 58%, #f0457f)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
              />
              {copy.verb} →
            </Link>
            <p className="text-center text-[13px] leading-relaxed text-faint">
              A live preview of the gift skin — potluck creation ships next.
            </p>
          </div>
        ) : (
          // Matches ContributeSheet's CTA exactly: coral only when it can act;
          // a quiet gray rest state while the form is incomplete — never dimmed
          // coral (a muddy 45%-opacity primary reads "broken", not "waiting").
          <button
            onClick={create}
            disabled={!canCreate}
            className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold transition-all duration-150 ease-[var(--ease-spring)] active:scale-[0.97] ${FOCUS_RING}`}
            style={{
              background:
                canCreate || inFlight
                  ? 'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))'
                  : 'rgba(255,255,255,0.05)',
              color: canCreate || inFlight ? 'var(--color-ink-950)' : 'rgba(255,255,255,0.4)',
              boxShadow:
                canCreate || inFlight
                  ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {(canCreate || inFlight) && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
              />
            )}
            {status === 'authing' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Check your email…
              </>
            ) : status === 'creating' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Opening the fund…
              </>
            ) : status === 'error' ? (
              <>Try again</>
            ) : (
              <>{copy.verb}</>
            )}
          </button>
        )
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1
            className="text-display font-semibold text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Start something
          </h1>
          <p className="mt-1.5 text-sm text-muted">{copy.kicker}</p>
        </div>

        {/* Mode toggle — flips the preview below between fundraiser + group gift. */}
        <ModeToggle mode={mode} onChange={setMode} disabled={inFlight} />

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
            disabled={inFlight}
            className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60 ${FOCUS_RING}`}
          />
        </label>

        {/* Email — the fund pays out to the creator's email wallet. */}
        {mode === 'rally' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">
              Your email — the goal pays out to you
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              disabled={inFlight}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60 ${FOCUS_RING}`}
            />
          </label>
        )}

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
              disabled={inFlight}
              className={`tnum w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-8 pr-16 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-white/30 focus:bg-white/[0.06] disabled:opacity-60 ${FOCUS_RING}`}
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
                  disabled={inFlight}
                  className={`relative rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${FOCUS_RING}`}
                  style={
                    active
                      ? { background: 'rgba(255,255,255,0.10)', color: 'var(--color-paper)' }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-muted)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="deadline-glow"
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)' }}
                    />
                  )}
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        {status === 'error' && error && (
          <p className="-mt-2 text-[13px] font-medium leading-relaxed text-warn">{error}</p>
        )}
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

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: Skin
  onChange: (m: Skin) => void
  disabled?: boolean
}) {
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
            disabled={disabled}
            className={`relative flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${FOCUS_RING}`}
            style={{ color: active ? 'var(--color-paper)' : 'var(--color-faint)' }}
          >
            {active && (
              // The canonical selected state (ContributeSheet's amount chips):
              // a quiet white inset ring — the accent stays reserved for the CTA.
              <motion.span
                layoutId="mode-toggle-pill"
                // Concentric with the frame: 16px row radius − 6px inset = 10px.
                className="absolute inset-0 rounded-[10px]"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)',
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
