import { AppShell } from './AppShell'

/**
 * The router's default pending screen — shown only when a navigation's loader
 * takes longer than `defaultPendingMs` (live RPC reads on a cold route).
 *
 * It mirrors the campaign-detail layout the user is almost always headed to:
 * an EMPTY glass tube (the real one keeps its shape, waiting to be poured
 * into) beside a shimmering readout, then two ghost feed rows. Quiet, no
 * spinner — the shimmer is the only motion, so the real screen lands as a
 * fill, not a flash.
 */
export function RouteSkeleton() {
  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.03]" />
            <span
              className="text-lg font-semibold tracking-tight text-paper"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rally
            </span>
          </div>
          <span className="inline-flex h-[26px] w-28 rounded-full border border-white/10 bg-white/[0.03]" />
        </div>
      }
    >
      <div aria-hidden className="flex animate-rise flex-col gap-6 pt-4">
        {/* Title block */}
        <div className="flex flex-col gap-3">
          <Shimmer className="h-3.5 w-28" />
          <div className="flex flex-col gap-2">
            <Shimmer className="h-9 w-64 rounded-xl" />
            <Shimmer className="h-9 w-44 rounded-xl" />
          </div>
        </div>

        {/* Hero row: the empty glass tube + shimmering readout */}
        <div className="flex items-center gap-6">
          <div
            className="shrink-0 border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
            style={{ width: 52, height: 248, borderRadius: 'var(--radius-tube)' }}
          />
          <div className="flex flex-1 flex-col justify-center gap-4">
            <Shimmer className="h-3 w-24" />
            <div className="flex flex-col gap-2.5">
              <div className="flex items-end gap-2.5">
                <Shimmer className="h-10 w-32 rounded-xl" />
                <Shimmer className="h-6 w-12" />
              </div>
              <Shimmer className="h-3.5 w-36" />
            </div>
            <div className="flex flex-col gap-2">
              <Shimmer className="h-3.5 w-40" />
              <Shimmer className="h-3.5 w-32" />
            </div>
            <Shimmer className="h-3.5 w-28" />
          </div>
        </div>

        {/* Feed: two ghost rows */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Shimmer className="h-3.5 w-36" />
            <Shimmer className="h-3 w-16" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border p-2.5 pr-3.5"
              style={{ borderColor: 'var(--color-line)', background: 'var(--color-surface)' }}
            >
              <span className="h-9 w-9 shrink-0 rounded-full bg-white/[0.06] ring-2 ring-white/10" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Shimmer className="h-3.5 w-28" />
                <Shimmer className="h-3 w-16" />
              </div>
              <Shimmer className="h-4 w-14 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

/** A soft shimmering placeholder bar (uses the shared `shimmer` keyframes). */
function Shimmer({ className = '' }: { className?: string }) {
  return (
    <span
      className={`block animate-shimmer rounded-lg ${className}`}
      style={{
        background:
          'linear-gradient(100deg, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 62%)',
        backgroundSize: '300% 100%',
      }}
    />
  )
}

export default RouteSkeleton
