import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'viem/chains'
import type { Chain as ViemChain } from 'viem'

import type { Chain } from '#/design/chains'
import { CctpDomain, EVM_CHAINS, type CctpDomainId } from '#/lib/cctp/addresses'

export type ChipInSource = 'base' | 'optimism' | 'arbitrum'

export const CHIP_IN_SOURCES: ChipInSource[] = ['base', 'optimism', 'arbitrum']

export function parseChipInSource(v: unknown): ChipInSource {
  return v === 'optimism' || v === 'arbitrum' ? v : 'base'
}

const CCTP_SOURCE_DOMAINS = new Set<number>([
  CctpDomain.OP_SEPOLIA,
  CctpDomain.ARBITRUM_SEPOLIA,
  CctpDomain.BASE_SEPOLIA,
  CctpDomain.SOLANA_DEVNET,
])

/** Server-fn payloads sometimes rehydrate `2` as `"2"`. Never default here —
 *  a wrong domain makes Iris miss the burn. */
export function parseCctpSourceDomain(v: unknown): CctpDomainId | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return CCTP_SOURCE_DOMAINS.has(n) ? (n as CctpDomainId) : undefined
}

export interface ChipInSourceMeta {
  id: ChipInSource
  chain: ViemChain
  usdc: `0x${string}`
  domain: CctpDomainId
  rpc: string
  alchemySub: string
}

export const CHIP_IN_META: Record<ChipInSource, ChipInSourceMeta> = {
  base: {
    id: 'base',
    chain: baseSepolia,
    usdc: EVM_CHAINS.baseSepolia.usdc,
    domain: CctpDomain.BASE_SEPOLIA,
    rpc: 'https://sepolia.base.org',
    alchemySub: 'base-sepolia',
  },
  optimism: {
    id: 'optimism',
    chain: optimismSepolia,
    usdc: EVM_CHAINS.opSepolia.usdc,
    domain: CctpDomain.OP_SEPOLIA,
    rpc: 'https://sepolia.optimism.io',
    alchemySub: 'opt-sepolia',
  },
  arbitrum: {
    id: 'arbitrum',
    chain: arbitrumSepolia,
    usdc: EVM_CHAINS.arbitrumSepolia.usdc,
    domain: CctpDomain.ARBITRUM_SEPOLIA,
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    alchemySub: 'arb-sepolia',
  },
}

export function isChipInSource(v: unknown): v is ChipInSource {
  return v === 'base' || v === 'optimism' || v === 'arbitrum'
}

/** Design-system chain ids that are valid chip-in sources (excludes solana). */
export function asChipInSource(chain: Chain): ChipInSource {
  return parseChipInSource(chain)
}
