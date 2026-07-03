/**
 * Rally · Circles — REAL gasless member actions (CLIENT-SIDE)
 * ---------------------------------------------------------------------------
 * The Circles twin of lib/backer-gasless.ts. After the member logs in with
 * email (Magic), their EOA is upgraded IN PLACE to a ZeroDev Kernel v3.3 smart
 * account via EIP-7702 and the RotatingVault call is sent as ONE sponsored
 * UserOp — the member pays ZERO gas. Because 7702 keeps kernel address == EOA
 * address, `msg.sender` inside the vault IS the member, so the contract's
 * member-only rules (deposit slots, payee-only claim) hold unchanged.
 *
 *   deposit: [approve(vault, amount), deposit(circleId)] — the member's OWN
 *            USDC on Arbitrum Sepolia. Fresh email wallets hold none, so this
 *            returns { funded: false } and the caller falls back to the honest
 *            relayer path (chipInCircleServerFn → depositFor).
 *   claim:   [claim(circleId)] — needs no funds at all, only sponsorship, so a
 *            brand-new email wallet can pull its pot with $0 gas. This is the
 *            money moment of Circles.
 *
 * Runs entirely in the browser (Magic + ZeroDev are browser SDKs).
 * TESTNET ONLY. Chain: Arbitrum Sepolia (421614) — where RotatingVault lives.
 */
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  type Address,
  type Hex,
} from 'viem'
import { arbitrumSepolia } from 'viem/chains'

import { getMagicWalletClient } from '#/lib/auth/magic'
import { createRallyKernelClient, sendSponsoredCalls } from '#/lib/auth/zerodev'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { ROTATING_VAULT, ROTATING_VAULT_ABI } from '#/lib/circle'

const USDC_ARB = EVM_CHAINS.arbitrumSepolia.usdc
const USDC_DECIMALS = 6

const ERC20_ABI = [
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
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

/** Browser-safe RPC for Arbitrum Sepolia (Alchemy if a VITE key is present). */
function arbPublicRpc(): string {
  const key =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ALCHEMY_API_KEY) ||
    undefined
  return key
    ? `https://arb-sepolia.g.alchemy.com/v2/${key}`
    : 'https://sepolia-rollup.arbitrum.io/rpc'
}

export type GaslessDepositResult =
  | {
      /** The member's wallet holds too little USDC — take the relayer fallback. */
      funded: false
      member: Address
      balanceUsd: number
    }
  | {
      funded: true
      member: Address
      /** The sponsored approve+deposit tx on Arbitrum Sepolia. */
      tx: Hex
      userOpHash: Hex
    }

/**
 * Attempt the REAL member-funded gasless deposit: approve + deposit as ONE
 * sponsored UserOp from the member's 7702 kernel. Returns { funded: false }
 * when the email wallet doesn't hold `amountUnits` of Arbitrum-Sepolia USDC
 * (the common fresh-wallet case) so the caller can fall back to the relayer.
 */
export async function tryGaslessCircleDeposit(params: {
  circleId: string
  amountUsd: number
}): Promise<GaslessDepositResult> {
  const amount = BigInt(Math.round(params.amountUsd * 10 ** USDC_DECIMALS))
  const circleId = BigInt(params.circleId)

  const magicWallet = await getMagicWalletClient(arbitrumSepolia.id)
  const member = magicWallet.account?.address as Address | undefined
  if (!member) throw new Error('Magic wallet has no account')

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(arbPublicRpc()),
  })
  const balance = (await publicClient.readContract({
    address: USDC_ARB,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [member],
  })) as bigint
  if (balance < amount) {
    return { funded: false, member, balanceUsd: Number(formatUnits(balance, USDC_DECIMALS)) }
  }

  const kernelClient = await createRallyKernelClient({
    magicWallet,
    chainId: arbitrumSepolia.id,
  })

  const { userOpHash, transactionHash } = await sendSponsoredCalls(kernelClient, [
    {
      to: USDC_ARB,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ROTATING_VAULT, amount],
      }),
    },
    {
      to: ROTATING_VAULT,
      data: encodeFunctionData({
        abi: ROTATING_VAULT_ABI,
        functionName: 'deposit',
        args: [circleId],
      }),
    },
  ])

  return { funded: true, member, tx: transactionHash, userOpHash }
}

export interface GaslessClaimResult {
  member: Address
  tx: Hex
  userOpHash: Hex
}

/**
 * The Circles money moment: the payee claims their whole pot with ZERO gas and
 * ZERO prior funds — a fresh email wallet can do this. The contract derives
 * the claimed round from msg.sender's own payout index and pays msg.sender,
 * so there is structurally no way this claims (or pays) anyone else.
 */
export async function gaslessCircleClaim(params: { circleId: string }): Promise<GaslessClaimResult> {
  const circleId = BigInt(params.circleId)

  const magicWallet = await getMagicWalletClient(arbitrumSepolia.id)
  const member = magicWallet.account?.address as Address | undefined
  if (!member) throw new Error('Magic wallet has no account')

  const kernelClient = await createRallyKernelClient({
    magicWallet,
    chainId: arbitrumSepolia.id,
  })

  const { userOpHash, transactionHash } = await sendSponsoredCalls(kernelClient, [
    {
      to: ROTATING_VAULT,
      data: encodeFunctionData({
        abi: ROTATING_VAULT_ABI,
        functionName: 'claim',
        args: [circleId],
      }),
    },
  ])

  return { member, tx: transactionHash, userOpHash }
}
