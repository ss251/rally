import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { AppShell } from '#/components/AppShell'
import { CampaignCard, type Campaign } from '#/components/CampaignCard'

export const Route = createFileRoute('/demo')({
  // Internal component showcase — dev-only. In prod it redirects home so a
  // judge (or anyone) can't stumble onto an internal kitchen-sink page.
  beforeLoad: () => {
    if (import.meta.env.PROD) throw redirect({ to: '/' })
  },
  component: Demo,
})

const DAY = 24 * 60 * 60 * 1000

// Two shareable cards — the artifact that lands in a group chat. Both wear the
// slim horizontal liquid; the second is re-skinned as a Potluck (group gift).
const RALLY: Campaign = {
  id: '1',
  title: 'Send the crew to Tokyo',
  organizer: 'Maya',
  raised: 3120,
  goal: 4000,
  deadline: Date.now() + 2 * DAY,
  backerCount: 23,
  segments: [
    { chain: 'base', amount: 1400 },
    { chain: 'arbitrum', amount: 720 },
    { chain: 'optimism', amount: 400 },
    { chain: 'solana', amount: 600 },
  ],
  backers: [{ name: 'Maya' }, { name: 'Tom Vidal' }, { name: 'Emma' }, { name: 'Chris' }],
  mode: 'rally',
}

const POTLUCK: Campaign = {
  id: '2',
  title: 'Kate’s surprise send-off',
  organizer: 'The design team',
  raised: 620,
  goal: 800,
  deadline: Date.now() + 3 * DAY,
  backerCount: 14,
  segments: [
    { chain: 'base', amount: 300 },
    { chain: 'arbitrum', amount: 140 },
    { chain: 'optimism', amount: 80 },
    { chain: 'solana', amount: 100 },
  ],
  backers: [{ name: 'Diego' }, { name: 'Hannah Cole' }, { name: 'Marcus' }, { name: 'Jordan' }],
  mode: 'potluck',
}

function Demo() {
  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between">
          <span
            className="text-lg font-semibold tracking-tight text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Rally
          </span>
          <span className="text-xs font-medium text-faint">Share cards</span>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1
            className="text-display font-semibold text-paper"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            One link, dropped in the chat
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            A fundraiser and a group gift — same card, two moods.
          </p>
        </div>

        <CampaignCard campaign={RALLY} href="/c/1" />
        <CampaignCard campaign={POTLUCK} href="/c/2?skin=potluck" />

        <Link to="/" className="pb-6 text-center text-sm text-muted hover:text-paper">
          ← back home
        </Link>
      </div>
    </AppShell>
  )
}
