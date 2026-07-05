import React from 'react'
import { interpolate, useCurrentFrame, Easing } from 'remotion'
import { T } from '../theme'

export type Seg = { t: string; c?: boolean } // c = coral highlight
export type Line = Seg[]

// A reveal that eases in (translateY + opacity) then holds. Scene-relative frame.
function reveal(frame: number, start: number, dur = 16) {
  const p = interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(...T.easeRally),
  })
  return { opacity: p, transform: `translateY(${(1 - p) * 22}px)` }
}

// Right-hand caption column: coral kicker, big Clash headline (line-staggered),
// a muted sub line. Enters staggered, sits legibly in the dusk gutter.
export function Caption({
  kicker,
  lines,
  sub,
  startAt = 6,
  outAt,
}: {
  kicker?: string
  lines: Line[]
  sub?: string
  startAt?: number
  outAt?: number
}) {
  const frame = useCurrentFrame()
  const out = outAt != null ? interpolate(frame, [outAt, outAt + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1

  return (
    <div
      style={{
        position: 'absolute',
        left: 700,
        right: 120,
        top: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: out,
      }}
    >
      {kicker && (
        <div
          style={{
            ...reveal(frame, startAt),
            fontFamily: T.sans,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: T.rally500,
            marginBottom: 26,
          }}
        >
          {kicker}
        </div>
      )}
      <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 76, lineHeight: 1.04, letterSpacing: '-0.015em', color: T.paper }}>
        {lines.map((segs, i) => (
          <div key={i} style={{ ...reveal(frame, startAt + 6 + i * 7), display: 'block' }}>
            {segs.map((s, j) => (
              <span
                key={j}
                style={
                  s.c
                    ? {
                        background: `linear-gradient(90deg, ${T.rally300}, ${T.rally500})`,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }
                    : undefined
                }
              >
                {s.t}
              </span>
            ))}
          </div>
        ))}
      </div>
      {sub && (
        <div
          style={{
            ...reveal(frame, startAt + 10 + lines.length * 7),
            fontFamily: T.sans,
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.42,
            color: T.muted,
            marginTop: 30,
            maxWidth: 900,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
