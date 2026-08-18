/**
 * Rally · REAL backer-funded, GASLESS contribution (CLIENT-SIDE)
 * ---------------------------------------------------------------------------
 * After email login (Magic), the EOA is upgraded in place to a ZeroDev Kernel
 * via EIP-7702. The backer spends THEIR OWN testnet USDC; the paymaster pays
 * gas.
 *
 *   Base / Optimism → CCTP depositForBurn → relayer mints + recordContribution
 *   Arbitrum        → GoalVault.contribute (same-chain, no hop)
 *
 * Returns `{ funded: false }` when the email wallet has no USDC on the chosen
 * source chain so the sheet can offer the faucet on THAT chain.
 *
 * TESTNET ONLY.
 */
import {
  createPublicClient,
  encodeFunctionData,
  http,
  formatUnits,
  type Address,
  type Hex,
} from 'viem'

import { getMagicWalletClient, type RallyChainId } from '#/lib/auth/magic'
import {
  createRallyKernelClient,
  sendGaslessCctpContribution,
  sendSponsoredCalls,
} from '#/lib/auth/zerodev'
import { CCTP_V2_TESTNET, CctpDomain } from '#/lib/cctp/addresses'
import { getBurnFee } from '#/lib/cctp/cctp'
import { GOAL_VAULT } from '#/lib/campaign'
import type { Chain } from '#/design/chains'
import { CHIP_IN_META, asChipInSource } from '#/lib/chip-in-source'

const USDC_DECIMALS = 6

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

function alchemyHost(id: 'base' | 'optimism' | 'arbitrum'): string | undefined {
  const key =
    (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_ALCHEMY_API_KEY) ||
    undefined
  if (!key) return undefined
  return `https://${CHIP_IN_META[id].alchemySub}.g.alchemy.com/v2/${key}`
}

export type GaslessBurnResult =
  | {
      funded: false
      balanceUsd: number
    }
  | {
      funded: true
      backer: Address
      burnTx: Hex
      userOpHash: Hex
      sourceDomain: number
      amount: bigint
      path: 'cctp' | 'local'
    }

export async function tryGaslessBackerBurn(params: {
  amountUsd: number
  fromChain?: Chain
  campaignId?: string
}): Promise<GaslessBurnResult> {
  const from = asChipInSource(params.fromChain ?? 'base')
  const src = CHIP_IN_META[from]
  const amount = toUsdcUnits(params.amountUsd)

  const magicWallet = await getMagicWalletClient(src.chain.id as RallyChainId)
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
    chainId: src.chain.id as RallyChainId,
  })

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
