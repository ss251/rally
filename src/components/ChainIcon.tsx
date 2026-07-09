import type { ReactElement } from 'react'
import type { Chain } from '#/design/chains'

// Official chain brand marks — inlined verbatim from each project's OFFICIAL
// brand kit (geometry preserved; only normalized to a viewBox so `size` scales
// them cleanly). These replace the community-approximated @web3icons marks.
//
//   Base     — base-org/brand-kit → logo/TheSquare/Digital/Base_square_blue.svg
//              The brand SVG ships `fill: blue` (#00F) as a placeholder; the real
//              Base Blue is #0052FF (base.org brand guide + base.org favicon).
//   Arbitrum — OffchainLabs/arbitrum-token-bridge → public/images/ArbitrumLogo.svg
//              The official full-color hex icon (navy #213147 + #12AAFF + white).
//   Optimism — optimism.io/brand → the OP isotype (red disc + white "OP"), the
//              canonical Optimism token mark. NOT the bare italic "OP" text that
//              @web3icons rendered. Disc uses the documented #FF0420 (asset ships
//              #FF0421 — a 1-unit, imperceptible difference; kept in sync w/ meta).
//   Solana   — solana.com/branding → solanaLogoMark.svg (three stacked bars in the
//              signature purple→green gradient, #9945FF → #19FB9B).
//
// The glyph is the ONLY thing swapped here — CHAIN_META colors (mercury bands +
// amounts) and every layout/spacing value elsewhere are untouched.

interface MarkProps {
  size: number
  className?: string
}

const baseStyle = { display: 'block', flexShrink: 0 } as const

function BaseMark({ size, className }: MarkProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1280 1280"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={baseStyle}
    >
      <path
        fill="#0052FF"
        d="M0,101.12c0-34.64,0-51.95,6.53-65.28,6.25-12.76,16.56-23.07,29.32-29.32C49.17,0,66.48,0,101.12,0h1077.76c34.63,0,51.96,0,65.28,6.53,12.75,6.25,23.06,16.56,29.32,29.32,6.52,13.32,6.52,30.64,6.52,65.28v1077.76c0,34.63,0,51.96-6.52,65.28-6.26,12.75-16.57,23.06-29.32,29.32-13.32,6.52-30.65,6.52-65.28,6.52H101.12c-34.64,0-51.95,0-65.28-6.52-12.76-6.26-23.07-16.57-29.32-29.32-6.53-13.32-6.53-30.65-6.53-65.28V101.12Z"
      />
    </svg>
  )
}

function ArbitrumMark({ size, className }: MarkProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 2500 2500"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={baseStyle}
    >
      <path
        fill="#213147"
        d="M226,760v980c0,63,33,120,88,152l849,490c54,31,121,31,175,0l849-490c54-31,88-89,88-152V760c0-63-33-120-88-152l-849-490c-54-31-121-31-175,0L314,608c-54,31-87,89-87,152H226z"
      />
      <path
        fill="#12AAFF"
        d="M1435,1440l-121,332c-3,9-3,19,0,29l208,571l241-139l-289-793C1467,1422,1442,1422,1435,1440z"
      />
      <path
        fill="#12AAFF"
        d="M1678,882c-7-18-32-18-39,0l-121,332c-3,9-3,19,0,29l341,935l241-139L1678,883V882z"
      />
      <path
        fill="#9DCCED"
        d="M1250,155c6,0,12,2,17,5l918,530c11,6,17,18,17,30v1060c0,12-7,24-17,30l-918,530c-5,3-11,5-17,5s-12-2-17-5l-918-530c-11-6-17-18-17-30V719c0-12,7-24,17-30l918-530c5-3,11-5,17-5l0,0V155z M1250,0c-33,0-65,8-95,25L237,555c-59,34-95,96-95,164v1060c0,68,36,130,95,164l918,530c29,17,62,25,95,25s65-8,95-25l918-530c59-34,95-96,95-164V719c0-68-36-130-95-164L1344,25c-29-17-62-25-95-25l0,0H1250z"
      />
      <polygon fill="#213147" points="642,2179 727,1947 897,2088 738,2234" />
      <path
        fill="#FFFFFF"
        d="M1172,644H939c-17,0-33,11-39,27L401,2039l241,139l550-1507c5-14-5-28-19-28L1172,644z"
      />
      <path
        fill="#FFFFFF"
        d="M1580,644h-233c-17,0-33,11-39,27L738,2233l241,139l620-1701c5-14-5-28-19-28V644z"
      />
    </svg>
  )
}

function OptimismMark({ size, className }: MarkProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 817 817"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={baseStyle}
    >
      <g transform="translate(-841 -529)">
        <circle cx="1249.5" cy="937.5" r="408.5" fill="#FF0420" />
        <path
          fill="#FAFAF9"
          d="M1441.19 816.786h-146.16l-34.39 243.924h69.97l8.31-59.08h79.58c71.88 0 107.7-28.819 115.82-90.515 8.37-63.6-21.73-94.329-93.14-94.329h.01Zm22.21 90.045c-2.87 26.205-17.91 37.636-48 37.636h-68.43l9.92-70.509h71.64c27.23 0 37.5 9.292 34.87 32.873Zm-340.8-95.759c-95.29 0-145.204 40.02-156.91 125.775-11.941 87.663 29.137 129.583 126.81 129.583 97.68 0 144.97-40.02 156.67-125.772 11.95-87.661-28.89-129.586-126.57-129.586Zm55.4 125.775c-6.45 48.359-30.8 70.033-81.67 70.033-47.76 0-65.68-19.055-59.47-66.222 6.45-48.594 31.29-70.035 81.68-70.035 50.38 0 65.67 19.297 59.46 66.224Z"
        />
      </g>
    </svg>
  )
}

function SolanaMark({ size, className }: MarkProps): ReactElement {
  // Native art is 101×88 (wider than tall). Center it in a square viewBox so the
  // bar stack keeps its exact proportions and aligns with the other marks.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -6.5 101 101"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={baseStyle}
    >
      <path
        fill="url(#rally-solana-mark)"
        d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0067 100.84 67.3436C100.99 67.6806 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 34.3032C83.4444 33.9248 83.0058 33.6231 82.5185 33.4169C82.0312 33.2108 81.5055 33.1045 80.9743 33.1048H1.93563C1.55849 33.1048 1.18957 33.2121 0.874202 33.4136C0.558829 33.6151 0.31074 33.9019 0.160416 34.2388C0.0100923 34.5758 -0.0359181 34.9482 0.0280382 35.3103C0.0919944 35.6723 0.263131 36.0083 0.520422 36.277L17.2061 53.6968C17.5676 54.0742 18.0047 54.3752 18.4904 54.5814C18.9762 54.7875 19.5002 54.8944 20.0301 54.8952H99.0644C99.4415 54.8952 99.8104 54.7879 100.126 54.5864C100.441 54.3849 100.689 54.0981 100.84 53.7612C100.99 53.4242 101.036 53.0518 100.972 52.6897C100.908 52.3277 100.737 51.9917 100.48 51.723L83.8068 34.3032ZM1.93563 21.7905H80.9743C81.5055 21.7907 82.0312 21.6845 82.5185 21.4783C83.0058 21.2721 83.4444 20.9704 83.8068 20.592L100.48 3.17219C100.737 2.90357 100.908 2.56758 100.972 2.2055C101.036 1.84342 100.99 1.47103 100.84 1.13408C100.689 0.79713 100.441 0.510296 100.126 0.308823C99.8104 0.107349 99.4415 1.24074e-05 99.0644 0L20.0301 0C19.5002 0.000878397 18.9762 0.107699 18.4904 0.313848C18.0047 0.519998 17.5676 0.821087 17.2061 1.19848L0.524723 18.6183C0.267681 18.8866 0.0966198 19.2223 0.0325185 19.5839C-0.0315829 19.9456 0.0140624 20.3177 0.163856 20.6545C0.31365 20.9913 0.561081 21.2781 0.875804 21.4799C1.19053 21.6817 1.55886 21.7896 1.93563 21.7905Z"
      />
      <defs>
        <linearGradient
          id="rally-solana-mark"
          x1="8.52558"
          y1="90.0973"
          x2="88.9933"
          y2="-3.01622"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.08" stopColor="#9945FF" />
          <stop offset="0.3" stopColor="#8752F3" />
          <stop offset="0.5" stopColor="#5497D5" />
          <stop offset="0.6" stopColor="#43B4CA" />
          <stop offset="0.72" stopColor="#28E0B9" />
          <stop offset="0.97" stopColor="#19FB9B" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const MARK: Record<Chain, (props: MarkProps) => ReactElement> = {
  base: BaseMark,
  arbitrum: ArbitrumMark,
  optimism: OptimismMark,
  solana: SolanaMark,
}

// Optical-size balance: the solid marks (Base square, Optimism disc) fill their
// whole box and read heavy at 13–16px, so nudge them down a hair; the open marks
// (Arbitrum hex, Solana bars) read at full size. Subtle — official artwork is
// never redrawn, only scaled.
const OPTICAL: Record<Chain, number> = {
  base: 0.86,
  arbitrum: 1,
  optimism: 0.94,
  solana: 1,
}

interface ChainIconProps {
  chain: Chain
  /** Rendered square size in px (the CONTAINER size when `contained`). */
  size?: number
  /**
   * Wrap the mark in the shared identity container: one rounded surface, one
   * ring, one optical size for all four marks — so the solid Base square, the
   * Optimism disc, the Arbitrum hex and the Solana bars sit as one family in
   * legends and meta rows instead of four differently-shaped strays.
   */
  contained?: boolean
  className?: string
}

/**
 * The single source for a chain's visual mark. Drop it anywhere a chain used to
 * be a colored dot (legend rows, feed badges). Presentational only.
 */
export function ChainIcon({ chain, size = 16, contained, className }: ChainIconProps): ReactElement {
  const Mark = MARK[chain]
  if (contained) {
    const inner = Math.round(size * 0.62 * OPTICAL[chain])
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md bg-white/[0.06] ring-1 ring-inset ring-white/10 ${className ?? ''}`}
        style={{ width: size, height: size }}
      >
        <Mark size={inner} />
      </span>
    )
  }
  const px = Math.round(size * OPTICAL[chain])
  return <Mark size={px} className={className} />
}

export default ChainIcon
