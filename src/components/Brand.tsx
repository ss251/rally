/**
 * Rally brand lockup — the constructed mark + the wordmark.
 *
 * Mark geometry (documented in docs/design/MARK.md): one circle (the pool)
 * with a wall of R/6, and the pooled money as a solid segment whose meniscus
 * runs from the waterline (180°) to 30° — rising at exactly 15°, two-thirds
 * full. Ring inherits `currentColor`; the liquid is flat brand coral.
 */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* vessel: R=216, wall w=R/6=36 (stroke path at R−w/2=198) */}
      <circle cx="256" cy="256" r="198" stroke="currentColor" strokeWidth="36" />
      {/* liquid: r=7R/9=168; chord 180°→30° ⇒ meniscus at 15° */}
      <path
        d="M 88 256 A 168 168 0 1 0 401.49 172 Z"
        fill="var(--color-rally-500)"
      />
    </svg>
  )
}

/**
 * Header lockup: mark + "Rally" (+ optional muted suffix, e.g. "Circles").
 * Same type treatment as the previous text-only wordmark — this is a lockup,
 * not a decoration: the mark sits at the wordmark's optical cap height.
 */
export function Brand({ sub }: { sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-paper">
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
