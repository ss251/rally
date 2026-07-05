import React from 'react'
import {
  AbsoluteFill,
  Series,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  spring,
} from 'remotion'
import { Background } from './components/Background'
import { Phone, Clip, Still } from './components/Phone'
import { Caption } from './components/Caption'
import { Wordmark, Mark } from './components/Mark'
import { ChainHop } from './beats/ChainHop'
import { MoneyBadge } from './beats/MoneyBadge'
import { Check } from './beats/Check'
import { T, FPS } from './theme'
import { ensureFonts } from './load-fonts'

ensureFonts()

// ── Scene durations (frames @30fps) — total 1980 = 66.0s ────────────────────
export const DUR = {
  cold: 240, // 0:00–0:08
  chip: 300, // 0:08–0:18
  payoff: 180, // 0:18–0:24
  chain: 210, // 0:24–0:31
  circles: 360, // 0:31–0:43
  trust: 450, // 0:43–0:58
  close: 240, // 0:58–1:06
}
export const TOTAL = Object.values(DUR).reduce((a, b) => a + b, 0)

// A subtle entrance the phone plays on each cut so a hard editorial cut still
// feels alive (settle-scale + fade). Motion = transform/opacity only.
function phoneEnter(frame: number, fps: number) {
  const s = spring({ frame, fps, config: { damping: 200, mass: 0.7 }, durationInFrames: 22 })
  return { scale: interpolate(s, [0, 1], [0.965, 1]), opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }) }
}

// Slow ken-burns push-in for held beats.
function kenburns(frame: number, dur: number, from = 1, to = 1.06) {
  return interpolate(frame, [0, dur], [from, to], { extrapolateRight: 'clamp', easing: Easing.linear })
}

// ── 0:00 COLD OPEN ──────────────────────────────────────────────────────────
function ColdOpen() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = phoneEnter(frame, fps)
  const kb = kenburns(frame, DUR.cold, 1.04, 1.0) // gentle pull-back to reveal
  return (
    <AbsoluteFill>
      <Phone scale={e.scale * kb} opacity={e.opacity}>
        <Clip src="clips/landing.mp4" />
      </Phone>
      <Caption
        kicker="This is Rally"
        lines={[[{ t: 'Group money that' }], [{ t: 'pays out ' }, { t: 'together', c: true }, { t: '.' }]]}
        sub="Or refunds everyone — automatically. Live on Arbitrum."
        startAt={10}
        outAt={DUR.cold - 22}
      />
    </AbsoluteFill>
  )
}

// ── 0:08 CHIP IN ─────────────────────────────────────────────────────────────
function ChipIn() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = phoneEnter(frame, fps)
  return (
    <AbsoluteFill>
      <Phone scale={e.scale} opacity={e.opacity}>
        <Clip src="clips/chipin.mp4" />
      </Phone>
      <Caption
        kicker="Chip in"
        lines={[[{ t: 'Just an ' }, { t: 'email', c: true }, { t: '.' }], [{ t: 'From any chain.' }]]}
        sub="No wallet. No gas. No seed phrase. If your money's on-chain, you're in."
        startAt={8}
        outAt={DUR.chip - 20}
      />
    </AbsoluteFill>
  )
}

// ── 0:18 PAYOFF — money moment (path a): composited over the live filled bar ──
function Payoff() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = phoneEnter(frame, fps)
  // brief coral glow pulse over the whole device on the "cut" (the pour landing)
  const glow = interpolate(frame, [0, 10, 34], [0, 0.5, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Phone scale={e.scale} opacity={e.opacity}>
          <Clip src="clips/landing.mp4" />
        </Phone>
        {/* coral flash localized to the tube region */}
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 40,
            width: 486,
            height: 1026,
            borderRadius: 48,
            background: `radial-gradient(300px 320px at 22% 42%, rgba(255,138,91,${glow}), rgba(255,138,91,0) 70%)`,
            pointerEvents: 'none',
          }}
        />
      </div>
      <MoneyBadge startAt={6} chipX={252} chipY={470} />
    </AbsoluteFill>
  )
}

// ── 0:24 INVISIBLE CHAIN ─────────────────────────────────────────────────────
function Chain() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = phoneEnter(frame, fps)
  const kb = kenburns(frame, DUR.chain, 1.12, 1.2)
  return (
    <AbsoluteFill>
      <Phone scale={e.scale} opacity={e.opacity} focus={{ scale: kb, ox: 6, oy: -10 }}>
        <Clip src="clips/landing.mp4" />
      </Phone>
      <Caption
        kicker="The invisible chain"
        lines={[[{ t: 'You never saw' }], [{ t: 'a ' }, { t: 'bridge', c: true }, { t: '.' }]]}
        startAt={8}
        outAt={DUR.chain - 20}
      />
      <ChainHop startAt={40} />
    </AbsoluteFill>
  )
}

// ── 0:31 MODE SWITCH → CIRCLES ───────────────────────────────────────────────
function Circles() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = phoneEnter(frame, fps)
  const SWITCH = 246 // hand off mode-switch clip -> a held rotating circle
  const xf = interpolate(frame, [SWITCH - 8, SWITCH + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      {/* first: the actual tap Goals -> Circles + arrival on a rotating circle */}
      <Phone scale={e.scale} opacity={e.opacity * (1 - xf)}>
        <Clip src="clips/mode-switch.mp4" />
      </Phone>
      {/* then: rest on circle/1, the crew's first circle (rotating, mid-fill) */}
      {xf > 0 && (
        <Phone opacity={xf} focus={{ scale: kenburns(frame - SWITCH, DUR.circles - SWITCH, 1.02, 1.08) }}>
          <Clip src="clips/circle-1.mp4" />
        </Phone>
      )}
      <Caption
        kicker="Circles"
        lines={[[{ t: 'Same promise,' }], [{ t: 'second ' }, { t: 'shape', c: true }, { t: '.' }]]}
        sub="A savings circle. The pot rotates through the crew — a new payee every round."
        startAt={12}
        outAt={DUR.circles - 22}
      />
    </AbsoluteFill>
  )
}

// ── 0:43 TRUST PUNCHLINE — broken circle, auto-refunded ─────────────────────
function Trust() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const e = phoneEnter(frame, fps)
  const HANDOFF = 282 // circle-2 clip (~9.6s) -> its still for the held tail
  const xf = interpolate(frame, [HANDOFF - 10, HANDOFF + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      <Phone scale={e.scale} opacity={e.opacity * (1 - xf)}>
        <Clip src="clips/circle-2.mp4" />
      </Phone>
      {xf > 0 && (
        <Phone opacity={xf} focus={{ scale: kenburns(frame - HANDOFF, DUR.trust - HANDOFF, 1.0, 1.05) }}>
          <Still src="stills/circle-2.png" />
        </Phone>
      )}
      <Caption
        kicker="When something breaks"
        lines={[[{ t: 'Everyone gets' }], [{ t: 'their money ' }, { t: 'back', c: true }, { t: '.' }]]}
        startAt={10}
        outAt={132}
      />
      {/* the punchline sub arrives late, after the headline has cleared */}
      <Sequence from={152}>
        <TrustSub />
      </Sequence>
    </AbsoluteFill>
  )
}

function TrustSub() {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(...T.easeRally) })
  return (
    <div style={{ position: 'absolute', left: 700, right: 120, top: '40%', opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.rally500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={22} color={T.ink950} />
        </div>
        <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 34, color: T.paper }}>Refunded from the contract</span>
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 29, lineHeight: 1.45, color: T.muted, maxWidth: 900 }}>
        We broke this circle on purpose. Nobody holds the money —{' '}
        <span style={{ color: T.paper }}>including us</span>.
      </div>
    </div>
  )
}

// ── 0:58 CLOSE ───────────────────────────────────────────────────────────────
function Close() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const markIn = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 1 }, durationInFrames: 34 })
  const lineP = interpolate(frame, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(...T.easeRally) })
  const pillP = interpolate(frame, [40, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const out = interpolate(frame, [DUR.close - 18, DUR.close], [1, 0], { extrapolateLeft: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {/* centered glow for the logo lockup */}
      <AbsoluteFill style={{ background: 'radial-gradient(900px 700px at 50% 46%, rgba(255,138,91,0.16), rgba(255,138,91,0) 60%)' }} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <div style={{ transform: `scale(${markIn})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Mark size={112} />
            <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 108, letterSpacing: '-0.02em', color: T.paper }}>Rally</span>
          </div>
        </div>
        <div
          style={{
            opacity: lineP,
            transform: `translateY(${(1 - lineP) * 16}px)`,
            fontFamily: T.display,
            fontWeight: 500,
            fontSize: 40,
            letterSpacing: '-0.01em',
            color: T.paper,
            textAlign: 'center',
          }}
        >
          One link. Pays out <span style={{ color: T.rally500 }}>together</span>, or refunds everyone — automatically.
        </div>
        <div
          style={{
            opacity: pillP,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 22px',
            borderRadius: 999,
            border: `1px solid ${T.line}`,
            background: 'rgba(255,255,255,0.03)',
            fontFamily: T.sans,
            fontSize: 24,
            color: T.muted,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,241,232,0.85)' }} />
          Live on Arbitrum
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export const RallyDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: T.ink950 }}>
      <Background glowX={480} />
      <Series>
        <Series.Sequence durationInFrames={DUR.cold}><ColdOpen /></Series.Sequence>
        <Series.Sequence durationInFrames={DUR.chip}><ChipIn /></Series.Sequence>
        <Series.Sequence durationInFrames={DUR.payoff}><Payoff /></Series.Sequence>
        <Series.Sequence durationInFrames={DUR.chain}><Chain /></Series.Sequence>
        <Series.Sequence durationInFrames={DUR.circles}><Circles /></Series.Sequence>
        <Series.Sequence durationInFrames={DUR.trust}><Trust /></Series.Sequence>
        <Series.Sequence durationInFrames={DUR.close}><Close /></Series.Sequence>
      </Series>
      {/* global film grain / vignette for cohesion */}
      <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(1500px 1000px at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)' }} />
    </AbsoluteFill>
  )
}
