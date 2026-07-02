import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-50 px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-bold tracking-tight">Rally</h1>
        <p className="mt-6 text-lg text-neutral-300">
          One link. A bar that fills itself from every chain. Hit the goal, or
          everyone gets their money back.
        </p>
        <p className="mt-4 text-sm text-neutral-500">
          Live cross-chain fundraising thermometer &middot; testnet only
        </p>
      </div>
    </main>
  )
}
