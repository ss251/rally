/**
 * Rally · Goals settle (SERVER-ONLY) — withdraw / refund / refundCrossChain
 * ---------------------------------------------------------------------------
 * GoalVault already has these; this module is the relayer-keyed wallet that
 * the email-wallet UX calls so a backer never holds gas. Funds still only
 * ever move to the beneficiary (withdraw) or the backer (refund*).
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { loadRelayerKey } from '#/lib/cctp/contribute-fill'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { GOAL_VAULT } from '#/lib/campaign'

const EXPLORER = EVM_CHAINS.arbitrumSepolia.explorer
const USDC_DECIMALS = 6

const SETTLE_ABI = [
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'campaignId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'campaignId', type: 'uint256' },
      { name: 'backer', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundCrossChain',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'campaignId', type: 'uint256' },
      { name: 'backer', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundableAmount',
    stateMutability: 'view',
    inputs: [
      { name: 'campaignId', type: 'uint256' },
      { name: 'backer', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCampaign',
    stateMutability: 'view',
    inputs: [{ name: 'campaignId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'beneficiary', type: 'address' },
      { name: 'goal', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'raised', type: 'uint256' },
      { name: 'withdrawn', type: 'bool' },
      { name: 'contributionCount', type: 'uint32' },
    ],
  },
] as const

async function clients() {
  const pk = await loadRelayerKey()
  const relayer = privateKeyToAccount(pk)
  const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
  const rpcUrl = alchemy
    ? `https://arb-sepolia.g.alchemy.com/v2/${alchemy}`
    : 'https://sepolia-rollup.arbitrum.io/rpc'
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({
    account: relayer,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  })
  return { relayer, publicClient, walletClient }
}

const vault = { address: GOAL_VAULT, abi: SETTLE_ABI } as const
const toUsd = (raw: bigint) => Number(formatUnits(raw, USDC_DECIMALS))

export interface SettleResult {
  tx: Hex
  amountUsd: number
  explorer: string
}

export async function withdrawCampaign(campaignId: bigint): Promise<SettleResult> {
  const { publicClient, walletClient } = await clients()
  const c = await publicClient.readContract({ ...vault, functionName: 'getCampaign', args: [campaignId] })
  if (c[5]) throw new Error('AlreadyWithdrawn')
  if (c[4] < c[2]) throw new Error('GoalNotReached')
  const tx = await walletClient.writeContract({ ...vault, functionName: 'withdraw', args: [campaignId] })
  await publicClient.waitForTransactionReceipt({ hash: tx })
  return { tx, amountUsd: toUsd(c[4]), explorer: `${EXPLORER}/tx/${tx}` }
}

export async function refundBacker(campaignId: bigint, backer: Address): Promise<SettleResult> {
  const { publicClient, walletClient } = await clients()
  const owed = (await publicClient.readContract({
    ...vault,
    functionName: 'refundableAmount',
    args: [campaignId, backer],
  })) as bigint
  if (owed === 0n) throw new Error('NothingToRefund')
  const tx = await walletClient.writeContract({
    ...vault,
    functionName: 'refundFor',
    args: [campaignId, backer],
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
  return { tx, amountUsd: toUsd(owed), explorer: `${EXPLORER}/tx/${tx}` }
}

export async function refundBackerCrossChain(campaignId: bigint, backer: Address): Promise<SettleResult> {
  const { publicClient, walletClient } = await clients()
  const owed = (await publicClient.readContract({
    ...vault,
    functionName: 'refundableAmount',
    args: [campaignId, backer],
  })) as bigint
  if (owed === 0n) throw new Error('NothingToRefund')
  const tx = await walletClient.writeContract({
    ...vault,
    functionName: 'refundCrossChain',
    args: [campaignId, backer],
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
  return { tx, amountUsd: toUsd(owed), explorer: `${EXPLORER}/tx/${tx}` }
}
