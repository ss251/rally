/**
 * Rally brand lockup — the constructed mark + the wordmark.
 *
 * Mark geometry (documented in docs/design/MARK.md): one circle (the pool)
 * with a wall of R/6, and the pooled money as a solid segment whose meniscus
 * runs from the waterline (180°) to 30° — rising at exactly 15°, two-thirds
 * full. Ring inherits `currentColor`; the liquid is flat brand coral.
 */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      style={{ transform: 'translateY(-1px)' }}
    >
      {/* vessel: R=216; UI rung rides a step heavier — wall w=R/5=43.2
          (stroke path at R−w/2=194.4) so the ring holds its own against the
          semibold wordmark at header size */}
      <circle cx="256" cy="256" r="194.4" stroke="currentColor" strokeWidth="43.2" />
      {/* liquid: r=R−4w/3=158.4; chord 180°→30° ⇒ meniscus at 15° */}
      <path
        d="M 97.6 256 A 158.4 158.4 0 1 0 393.18 176.8 Z"
        fill="var(--color-rally-500)"
      />
    </svg>
  )
}

/**
 * Header lockup: mark + "Rally" (+ optional muted suffix, e.g. "Circles").
 * Same type treatment as the previous text-only wordmark — this is a lockup,
 * not a decoration. The mark is optically aligned to the cap-height mass of
 * "Rall", not the full bounding box (the y-descender would drag it low) —
 * hence the 1px lift.
 */
export function Brand({ sub }: { sub?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-paper">
      <BrandMark />
      <span
        className="text-lg font-semibold tracking-tight"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Rally{sub ? <> <span className="text-muted">{sub}</span></> : null}
      </span>
    </span>
  )
}

export default Brand
