import React from 'react'
import { T } from '../theme'

// The Rally mark — the CONSTRUCTED VESSEL (ring + coral fill rising at 15°),
// matching public/icons/icon.svg exactly (see docs/design/MARK.md). Flat paint:
// dusk vessel, paper ring, coral liquid. Kept in-file so the video carries no
// cross-dependency on the app's asset tree.
export function Mark({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" style={{ display: 'block' }}>
      <rect width="512" height="512" rx="114" fill="#130d1a" />
      <circle cx="256" cy="256" r="148.5" stroke="#f6f1f9" strokeWidth="27" />
      <path d="M 130.00 256.00 A 126.00 126.00 0 1 0 365.12 193.00 Z" fill="#ff7a50" />
    </svg>
  )
}

// Mark + "Rally" wordmark, matching the app header.
export function Wordmark({ markSize = 64, fontSize = 58 }: { markSize?: number; fontSize?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: markSize * 0.28 }}>
      <Mark size={markSize} />
      <span style={{ fontFamily: T.display, fontWeight: 600, fontSize, letterSpacing: '-0.02em', color: T.paper }}>Rally</span>
    </div>
  )
}
