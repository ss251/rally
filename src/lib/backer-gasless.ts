/**
 * Rally · REAL backer-funded, GASLESS cross-chain contribution (CLIENT-SIDE)
 * ---------------------------------------------------------------------------
 * This is the TRUE product path. After the backer logs in with email (Magic),
 * their Magic EOA is upgraded IN PLACE to a ZeroDev Kernel v3.3 smart account
 * via EIP-7702, and the CCTP `depositForBurn` is signed by THAT account with
 * the ZeroDev paymaster paying the gas. The backer burns THEIR OWN testnet
 * USDC on Base Sepolia and pays ZERO gas.
 *
 * The burn is the only step the backer's wallet signs. The rest of the CCTP hop
 * (poll Circle attestation → mint into the GoalVault on Arbitrum Sepolia →
 * recordContribution under the backer's address) is finished server-side by the
 * relayer, which only RELAYS — it does not front the money. See
 * ../lib/cctp/complete-fill.ts + ../lib/contribute.ts (completeContributionServerFn).
 *
 * Runs entirely in the browser (Magic + ZeroDev are browser SDKs). Returns
 * `{ funded: false }` when the backer's email wallet holds no USDC yet (the
 * common fresh-wallet demo case) so the caller can fall back to the honest
 * relayer-funded server path. Callers must treat `{ funded: false }` as "not an
 * error — take the fallback".
 *
 * TESTNET ONLY. Source chain = Base Sepolia (CCTP domain 6); destination =
 * Arbitrum Sepolia (domain 3), where the GoalVault lives.
 */
import {
  createPublicClient,
  encodeFunctionData,
  http,
  formatUnits,
  type Address,
  type Chain as ViemChain,
  type Hex,
} from 'viem'
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'viem/chains'

import { getMagicWalletClient, type RallyChainId } from '#/lib/auth/magic'
import {
  createRallyKernelClient,
  sendGaslessCctpContribution,
  sendSponsoredCalls,
} from '#/lib/auth/zerodev'
import { CCTP_V2_TESTNET, EVM_CHAINS, CctpDomain, type CctpDomainId } from '#/lib/cctp/addresses'
import { getBurnFee } from '#/lib/cctp/cctp'
import { GOAL_VAULT } from '#/lib/campaign'
import type { Chain } from '#/design/chains'

const USDC_DECIMALS = 6

const SOURCE: Record<
  'base' | 'optimism' | 'arbitrum',
  { chain: ViemChain; chainId: RallyChainId; usdc: `0x${string}`; domain: CctpDomainId; rpc: string }
> = {
  base: {
    chain: baseSepolia,
    chainId: baseSepolia.id,
    usdc: EVM_CHAINS.baseSepolia.usdc,
    domain: CctpDomain.BASE_SEPOLIA,
    rpc: 'https://sepolia.base.org',
  },
  optimism: {
    chain: optimismSepolia,
    chainId: optimismSepolia.id,
    usdc: EVM_CHAINS.opSepolia.usdc,
    domain: CctpDomain.OP_SEPOLIA,
    rpc: 'https://sepolia.optimism.io',
  },
  arbitrum: {
    chain: arbitrumSepolia,
    chainId: arbitrumSepolia.id,
    usdc: EVM_CHAINS.arbitrumSepolia.usdc,
    domain: CctpDomain.ARBITRUM_SEPOLIA,
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
  },
}

/** Human USD → USDC base units (6 dp), integer-safe. */
function toUsdcUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS))
}

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

function alchemyHost(chain: 'base' | 'optimism' | 'arbitrum'): string | undefined {
  const key =
    (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_ALCHEMY_API_KEY) ||
    undefined
  if (!key) return undefined
  const sub = chain === 'base' ? 'base-sepolia' : chain === 'optimism' ? 'opt-sepolia' : 'arb-sepolia'
  return `https://${sub}.g.alchemy.com/v2/${key}`
}

export type GaslessBurnResult =
  | {
      /** The backer's wallet had no USDC — caller must take the relayer fallback. */
      funded: false
      /** USDC the backer actually holds (for logging / UX). */
      balanceUsd: number
    }
  | {
      funded: true
      /** The backer's smart-account address (== their Magic EOA — 7702 in place). */
      backer: Address
      /** The gasless burn tx on Base Sepolia (backer's own USDC, paymaster gas). */
      burnTx: Hex
      /** ERC-4337 userOp hash for the sponsored burn. */
      userOpHash: Hex
      /** CCTP source domain, or Arbitrum (3) for a same-chain contribute. */
      sourceDomain: number
      /** Base units burned / contributed. */
      amount: bigint
      /** `local` = same-chain GoalVault.contribute; `cctp` = cross-chain burn. */
      path: 'cctp' | 'local'
    }

/**
 * Attempt the REAL backer-funded gasless burn. Returns `{ funded: false }` if the
 * backer's email wallet doesn't hold `amountUsd` of USDC on Base Sepolia (so the
 * caller falls back to the relayer path). Otherwise performs the sponsored
 * `approve + depositForBurn` as ONE gasless UserOp and returns the burn tx.
 *
 * A Fast Transfer is used (minFinalityThreshold 1000) so the mint lands in
 * seconds. `maxFee` covers Circle's fast-burn fee; it is fetched with a safe
 * fallback of 1 bps of the amount.
 */
export async function tryGaslessBackerBurn(params: {
  amountUsd: number
  fromChain?: Chain
  /** Required for the same-chain Arbitrum contribute path. */
  campaignId?: string
}): Promise<GaslessBurnResult> {
  const from = params.fromChain === 'optimism' || params.fromChain === 'arbitrum' ? params.fromChain : 'base'
  const src = SOURCE[from]
  const amount = toUsdcUnits(params.amountUsd)

  const magicWallet = await getMagicWalletClient(src.chainId)
  const backer = magicWallet.account?.address as Address | undefined
  if (!backer) throw new Error('Magic wallet has no account')

  const publicClient = createPublicClient({
    chain: src.chain,
    transport: http(alchemyHost(from) ?? src.rpc),
  })
  const balance = (await publicClient.readContract({
    address: src.usdc,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [backer],
  })) as bigint
  if (balance < amount) {
    return { funded: false, balanceUsd: Number(formatUnits(balance, USDC_DECIMALS)) }
  }

  const kernelClient = await createRallyKernelClient({
    magicWallet,
    chainId: src.chainId,
  })

  // Same-chain: the vault lives on Arbitrum — pull USDC directly, no CCTP hop.
  if (from === 'arbitrum') {
    if (!params.campaignId || !/^[0-9]{1,10}$/.test(params.campaignId)) {
      throw new Error('a campaign id is required')
    }
    const { userOpHash, transactionHash } = await sendSponsoredCalls(kernelClient, [
      {
        to: src.usdc,
        data: encodeFunctionData({
          abi: [
            {
              type: 'function',
              name: 'approve',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ type: 'bool' }],
            },
          ] as const,
          functionName: 'approve',
          args: [GOAL_VAULT, amount],
        }),
      },
      {
        to: GOAL_VAULT,
        data: encodeFunctionData({
          abi: [
            {
              type: 'function',
              name: 'contribute',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'campaignId', type: 'uint256' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [],
            },
          ] as const,
          functionName: 'contribute',
          args: [BigInt(params.campaignId), amount],
        }),
      },
    ])
    return {
      funded: true,
      backer,
      burnTx: transactionHash,
      userOpHash,
      sourceDomain: src.domain,
      amount,
      path: 'local',
    }
  }

  let feeBps = 3
  try {
    const tiers = (await getBurnFee(src.domain, CctpDomain.ARBITRUM_SEPOLIA)) as Array<{
      finalityThreshold: number
      minimumFee: number
    }>
    const fast = tiers.find((t) => t.finalityThreshold === 1000)
    if (fast && Number.isFinite(fast.minimumFee)) {
      feeBps = Math.max(Math.ceil(fast.minimumFee * 2), 1)
    }
  } catch {
    // fee endpoint down — keep the static fallback
  }
  let maxFee = (amount * BigInt(feeBps) + 9_999n) / 10_000n
  if (maxFee === 0n) maxFee = 1n

  const { userOpHash, transactionHash } = await sendGaslessCctpContribution({
    kernelClient,
    usdc: src.usdc,
    tokenMessenger: CCTP_V2_TESTNET.TokenMessengerV2,
    amount,
    destinationDomain: CctpDomain.ARBITRUM_SEPOLIA,
    goalVaultOnHomeChain: GOAL_VAULT,
    maxFee,
    minFinalityThreshold: 1000,
  })

  return {
    funded: true,
    backer,
    burnTx: transactionHash,
    userOpHash,
    sourceDomain: src.domain,
    amount,
    path: 'cctp',
  }
}
