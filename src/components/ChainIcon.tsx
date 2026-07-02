import NetworkBase from '@web3icons/react/icons/networks/NetworkBase'
import NetworkArbitrumOne from '@web3icons/react/icons/networks/NetworkArbitrumOne'
import NetworkOptimism from '@web3icons/react/icons/networks/NetworkOptimism'
import NetworkSolana from '@web3icons/react/icons/networks/NetworkSolana'
import type { IconComponent } from '@web3icons/react'
import type { Chain } from '#/design/chains'

// Real, official chain marks (sourced from each project's brand kit via
// @web3icons/react). We swap the old plain colored dots for these so the
// thermometer legend + contributor feed read as genuine multi-chain, not
// generic bullets. `branded` carries each mark's official geometry + colors:
//   Base     — the cobalt Basemark square
//   Arbitrum — the Arbitrum One 3D hex (navy + blues)
//   Optimism — the red Optimism "O"
//   Solana   — the three bars in the signature purple→green gradient
const ICON: Record<Chain, IconComponent> = {
  base: NetworkBase,
  arbitrum: NetworkArbitrumOne,
  optimism: NetworkOptimism,
  solana: NetworkSolana,
}

// Optical-size balance: each mark fills its 24px grid differently. Base is a
// solid filled tile (heaviest), so nudge it down a touch; the others are open
// glyphs and read at full size. Keeps the set feeling designed, not dropped-in.
const OPTICAL: Record<Chain, number> = {
  base: 0.9,
  arbitrum: 1,
  optimism: 1,
  solana: 1,
}

interface ChainIconProps {
  chain: Chain
  /** Rendered square size in px. Keep small (12–18) so it sits like a glyph. */
  size?: number
  className?: string
}

/**
 * The single source for a chain's visual mark. Drop it anywhere a chain used to
 * be a colored dot (legend rows, feed badges). Presentational only.
 */
export function ChainIcon({ chain, size = 16, className }: ChainIconProps) {
  const Icon = ICON[chain]
  const px = Math.round(size * OPTICAL[chain])
  return (
    <Icon
      variant="branded"
      size={px}
      className={className}
      aria-hidden="true"
      // Crisp at small sizes; the marks are drawn on a 24px grid.
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}

export default ChainIcon
