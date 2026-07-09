import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'

// The dusk canvas with a soft coral light-source behind the phone — the app's
// core motif ("the page is dusk; the thermometer is the light"). The glow sits
// roughly behind the device (left third) and breathes almost imperceptibly.
export function Background({ glowX = 480, glowStrength = 1 }: { glowX?: number; glowStrength?: number }) {
  const frame = useCurrentFrame()
  const breathe = interpolate(Math.sin(frame / 42), [-1, 1], [0.82, 1]) * glowStrength
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${T.ink850} 0%, ${T.ink900} 42%, ${T.ink950} 100%)` }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 900px at ${glowX}px 540px, rgba(255,138,91,${0.16 * breathe}), rgba(255,138,91,0) 62%)`,
        }}
      />
      {/* faint top sheen + bottom vignette so the frame has depth */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(1400px 700px at 60% -8%, rgba(255,255,255,0.05), rgba(255,255,255,0) 55%), radial-gradient(1600px 900px at 50% 118%, rgba(0,0,0,0.5), rgba(0,0,0,0) 60%)',
        }}
      />
    </AbsoluteFill>
  )
}
