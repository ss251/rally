import React from 'react'
import { interpolate, useCurrentFrame, Easing, spring, useVideoConfig } from 'remotion'
import { T } from '../theme'

// "You never saw a bridge." A quiet motion graphic: USDC burns on Base and
// mints on Arbitrum, one coral token arcing across. Lives in the right gutter.
function ChainChip({ name, color, label, active }: { name: string; color: string; label: string; active: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 200 }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: `radial-gradient(120% 120% at 30% 20%, ${color}, rgba(0,0,0,0.25))`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 18px 40px -14px ${color}, 0 0 ${28 * active}px ${-6}px ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: T.display,
          fontWeight: 700,
          fontSize: 40,
          color: '#fff',
        }}
      >
        {name[0]}
      </div>
      <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 24, color: T.paper }}>{name}</div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 17,
          letterSpacing: '0.04em',
          color: interpolateColor(active),
          opacity: 0.35 + active * 0.65,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function interpolateColor(a: number) {
  return a > 0.5 ? T.rally300 : T.faint
}

export function ChainHop({ startAt = 12 }: { startAt?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = Math.max(0, frame - startAt)

  // token travels Base -> Arbitrum between ~0.6s and ~2.4s
  const travel = interpolate(t, [18, 78], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(...T.easeRally),
  })
  const baseActive = 1 - interpolate(t, [10, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * 0.0 // stays labeled "burned"
  const burned = interpolate(t, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const minted = interpolate(t, [64, 88], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const enter = spring({ frame: t, fps, config: { damping: 200 }, durationInFrames: 20 })

  const railW = 300
  const tokenX = interpolate(travel, [0, 1], [0, railW])
  const tokenLift = -Math.sin(travel * Math.PI) * 46 // arc

  return (
    <div
      style={{
        position: 'absolute',
        left: 700,
        right: 120,
        top: '63%',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 20}px)`,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', width: railW + 200 }}>
        <ChainChip name="Base" color={T.chainBase} label={burned > 0.5 ? 'burned' : '·····'} active={burned} />
        {/* dashed rail */}
        <div style={{ position: 'absolute', left: 148, right: 52, top: 46, height: 2 }}>
          <div style={{ width: '100%', height: '100%', backgroundImage: `repeating-linear-gradient(90deg, ${T.faint} 0 10px, transparent 10px 20px)`, opacity: 0.6 }} />
          {/* traveling coral USDC token */}
          <div
            style={{
              position: 'absolute',
              left: tokenX,
              top: -13 + tokenLift,
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: `radial-gradient(120% 120% at 30% 25%, ${T.rally300}, ${T.rally600})`,
              boxShadow: `0 0 26px -2px ${T.rallyGlow}, 0 0 0 1px rgba(255,255,255,0.25)`,
              opacity: travel > 0.001 && travel < 0.999 ? 1 : travel >= 0.999 ? 0 : 0,
            }}
          />
        </div>
        <ChainChip name="Arbitrum" color={T.chainArb} label={minted > 0.5 ? 'minted' : '·····'} active={minted} />
      </div>
    </div>
  )
}
