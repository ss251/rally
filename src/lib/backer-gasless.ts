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
  http,
  formatUnits,
  type Address,
  type Hex,
} from 'viem'
import { baseSepolia } from 'viem/chains'

import { getMagicWalletClient } from '#/lib/auth/magic'
import {
  createRallyKernelClient,
  sendGaslessCctpContribution,
} from '#/lib/auth/zerodev'
import { CCTP_V2_TESTNET, EVM_CHAINS, CctpDomain } from '#/lib/cctp/addresses'
import { GOAL_VAULT } from '#/lib/campaign'

const BASE = EVM_CHAINS.baseSepolia // CCTP source, domain 6
const USDC_DECIMALS = 6

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

/** Read a browser-safe RPC for Base Sepolia (Alchemy if a VITE key is present). */
function basePublicRpc(): string {
  const key =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ALCHEMY_API_KEY) ||
    undefined
  return key ? `https://base-sepolia.g.alchemy.com/v2/${key}` : 'https://sepolia.base.org'
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
      /** CCTP source domain (Base Sepolia = 6). */
      sourceDomain: number
      /** Base units burned. */
      amount: bigint
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
}): Promise<GaslessBurnResult> {
  const amount = toUsdcUnits(params.amountUsd)

  // 1. The Magic email wallet, as a viem client bound to Base Sepolia.
  const magicWallet = await getMagicWalletClient(baseSepolia.id)
  const backer = magicWallet.account?.address as Address | undefined
  if (!backer) throw new Error('Magic wallet has no account')

  // 2. Does the backer actually hold the USDC? Fresh email wallets don't.
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(basePublicRpc()),
  })
  const balance = (await publicClient.readContract({
    address: BASE.usdc,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [backer],
  })) as bigint
  if (balance < amount) {
    return { funded: false, balanceUsd: Number(formatUnits(balance, USDC_DECIMALS)) }
  }

  // 3. Upgrade the EOA to a gasless ZeroDev 7702 kernel account.
  const kernelClient = await createRallyKernelClient({
    magicWallet,
    chainId: baseSepolia.id,
  })

  // 4. Fast-transfer maxFee (bps of amount; safe fallback 1 bps, min 1 unit).
  let maxFee = amount / 10_000n
  if (maxFee === 0n) maxFee = 1n

  // 5. The money moment: approve + depositForBurn as ONE sponsored UserOp.
  const { userOpHash, transactionHash } = await sendGaslessCctpContribution({
    kernelClient,
    usdc: BASE.usdc,
    tokenMessenger: CCTP_V2_TESTNET.TokenMessengerV2,
    amount,
    destinationDomain: CctpDomain.ARBITRUM_SEPOLIA, // 3
    goalVaultOnHomeChain: GOAL_VAULT,
    maxFee,
    minFinalityThreshold: 1000, // Fast Transfer
  })

  return {
    funded: true,
    backer,
    burnTx: transactionHash,
    userOpHash,
    sourceDomain: CctpDomain.BASE_SEPOLIA, // 6
    amount,
  }
}
