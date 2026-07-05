import React from 'react'
import { spring, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { Check } from './Check'
import { T } from '../theme'

// The money-moment payoff, composited over the live filled bar (path a): a
// "+$25" coral chip floats up into the tube, then a spring "You're in ✦" badge.
export function MoneyBadge({ startAt = 4, chipX = 300, chipY = 520 }: { startAt?: number; chipX?: number; chipY?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = Math.max(0, frame - startAt)

  // +$25 chip rises and fades near the tube
  const chipP = interpolate(t, [0, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(...T.easeRally) })
  const chipOpacity = interpolate(t, [0, 6, 26, 40], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // "You're in ✦" badge springs in a beat later
  const badge = spring({ frame: t - 22, fps, config: { damping: 12, stiffness: 180, mass: 0.9 }, durationInFrames: 26 })

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: chipX,
          top: chipY - chipP * 120,
          opacity: chipOpacity,
          transform: 'translateX(-50%)',
          fontFamily: T.display,
          fontWeight: 700,
          fontSize: 40,
          color: T.rally300,
          textShadow: `0 0 24px ${T.rallyGlow}`,
        }}
      >
        +$25
      </div>

      <div
        style={{
          position: 'absolute',
          left: 700,
          right: 120,
          top: '50%',
          transform: `translateY(-50%)`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 18,
            transform: `scale(${badge})`,
            transformOrigin: 'left center',
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: T.rally500,
              boxShadow: `0 16px 50px -8px ${T.rallyGlow}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={44} color={T.ink950} />
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 72, letterSpacing: '-0.02em', color: T.paper }}>
            You're in ✦
          </div>
        </div>
        <div
          style={{
            marginTop: 26,
            opacity: interpolate(t, [30, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            fontFamily: T.sans,
            fontSize: 30,
            color: T.muted,
            maxWidth: 860,
          }}
        >
          Your $25 lands on-chain and the bar rises — no app, no account, no wallet.
        </div>
      </div>
    </>
  )
}
