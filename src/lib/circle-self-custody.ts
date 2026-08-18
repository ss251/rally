/**
 * Rally · Circles — SELF-CUSTODIED circle creation (CLIENT-SIDE)
 * ---------------------------------------------------------------------------
 * The real-create lane. The CREATOR's own Magic email wallet — not the Rally
 * relayer — is the on-chain organizer:
 *
 *   1. `createCircle` is sent from the creator's ZeroDev 7702 kernel (gasless,
 *      exactly like deposits/claims in circle-gasless.ts). 7702 keeps kernel
 *      address == EOA address, so `msg.sender` inside the vault IS the creator
 *      and `organizer = the creator's EOA`.
 *   2. The N seat invites are EIP-712 typed-data signatures minted HERE, in
 *      the creator's browser, by the creator's key (Magic signTypedData —
 *      a 7702-delegated EOA still signs plain ECDSA, which is exactly what
 *      RotatingVault.redeemInvite recovers). Rally's server never holds a key
 *      that could sign an invite or call `start` on this circle.
 *   3. Seat 0 is redeemed for the creator through their own kernel (sponsored).
 *   4. `start` — organizer-only on-chain — also goes through the creator's
 *      kernel (see startSelfCustodiedCircle).
 *
 * SEAT BINDING: an EIP-712 invite binds its `member` address at signing time.
 * A friend's email-wallet address only exists once they log in, so open seats
 * are NOT pre-bound to derived localStorage keys. The share link is unsigned;
 * the joiner logs in with Magic, then the organizer countersigns an invite
 * bound to THAT wallet (`mintSeatInviteAsOrganizer({ member })`). Seat 0 is
 * still redeemed for the creator at create time. The organizer role (invite
 * signing + start/cancel) stays fully self-custodied.
 *
 * Runs entirely in the browser (Magic + ZeroDev are browser SDKs).
 * TESTNET ONLY. Chain: Arbitrum Sepolia (421614) — where RotatingVault lives.
 */
import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  hashTypedData,
  http,
  recoverTypedDataAddress,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { getMagicWalletClient } from '#/lib/auth/magic'
import { createRallyKernelClient, sendSponsoredCalls } from '#/lib/auth/zerodev'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import {
  INVITE_DOMAIN,
  INVITE_TYPES,
  ROTATING_VAULT,
  ROTATING_VAULT_ABI,
  defaultInviteExpirySec,
  type SignedInvite,
} from '#/lib/circle'

const USDC_ARB = EVM_CHAINS.arbitrumSepolia.usdc
const USDC_DECIMALS = 6
const EXPLORER = EVM_CHAINS.arbitrumSepolia.explorer
const vault = { address: ROTATING_VAULT, abi: ROTATING_VAULT_ABI } as const

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

function publicClient() {
  return createPublicClient({ chain: arbitrumSepolia, transport: http(arbPublicRpc()) })
}

/** Random 256-bit invite nonce (viem's key generator is a fine CSPRNG source). */
const randomNonceHex = (): Hex => generatePrivateKey()

// ─── Invite signing (the creator's key, in the creator's browser) ────────────

async function signInviteAsCreator(params: {
  circleId: bigint
  member: Address
  payoutIndex: number
  organizer: Address
  expiresAt?: bigint
}): Promise<SignedInvite> {
  const { circleId, member, payoutIndex, organizer } = params
  const magicWallet = await getMagicWalletClient(arbitrumSepolia.id)
  const account = magicWallet.account
  if (!account) throw new Error('Magic wallet has no account')
  if (account.address.toLowerCase() !== organizer.toLowerCase()) {
    throw new Error('Sign in with the organizer’s email to mint invites for this circle.')
  }

  const nonceHex = randomNonceHex()
  const expiresAt = params.expiresAt ?? defaultInviteExpirySec()
  const message = {
    circleId,
    member,
    payoutIndex: BigInt(payoutIndex),
    nonce: BigInt(nonceHex),
    expiresAt,
  }
  const typedData = {
    domain: INVITE_DOMAIN,
    types: INVITE_TYPES,
    primaryType: 'Invite',
    message,
  } as const

  const signature = await magicWallet.signTypedData({ account, ...typedData })

  // Trust nothing until verified: the recovered signer must BE the organizer —
  // exactly the ECDSA.recover check redeemInvite runs on-chain.
  const recovered = await recoverTypedDataAddress({ ...typedData, signature })
  if (recovered.toLowerCase() !== organizer.toLowerCase()) {
    throw new Error('Invite signature did not recover to your wallet — nothing was shared.')
  }

  return { seat: payoutIndex, member, nonce: nonceHex, expiresAt: expiresAt.toString(), signature }
}

/**
 * Cross-check our locally-built EIP-712 digest against the contract's own
 * `inviteDigest` view. Run once per create (any mismatch means links would be
 * dead on arrival — fail loudly BEFORE shipping them).
 */
async function assertDigestMatchesContract(invite: SignedInvite, circleId: bigint) {
  const expiresAt = BigInt(invite.expiresAt)
  const local = hashTypedData({
    domain: INVITE_DOMAIN,
    types: INVITE_TYPES,
    primaryType: 'Invite',
    message: {
      circleId,
      member: invite.member as Address,
      payoutIndex: BigInt(invite.seat),
      nonce: BigInt(invite.nonce),
      expiresAt,
    },
  })
  const onchain = await publicClient().readContract({
    ...vault,
    functionName: 'inviteDigest',
    args: [circleId, invite.member as Address, BigInt(invite.seat), BigInt(invite.nonce), expiresAt],
  })
  if (local.toLowerCase() !== (onchain as Hex).toLowerCase()) {
    throw new Error('Invite digest mismatch between app and contract — invites not shared.')
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

export type CreatePhase = 'creating' | 'signing' | 'seating'

export interface SelfCustodyCreateResult {
  circleId: string
  /** The creator's EOA == kernel address == the on-chain organizer. */
  organizer: Address
  /** The sponsored createCircle tx (from the creator's 7702 kernel). */
  createTx: Hex
  /** The sponsored seat-0 redemption tx (creator takes their own seat). */
  seatTx: Hex
  /** Org-signed invites for the open seats (1..N-1) — go straight into links. */
  invites: SignedInvite[]
  started: boolean
  explorer: string
}

/**
 * Create a circle with the LOGGED-IN creator's wallet as the on-chain
 * organizer. Caller must have completed Magic login first (loginWithEmail).
 */
export async function createSelfCustodiedCircle(params: {
  depositUsd: number
  roundSeconds: number
  seats: number
  onPhase?: (phase: CreatePhase) => void
}): Promise<SelfCustodyCreateResult> {
  const { onPhase } = params
  const depositUnits = BigInt(Math.round(params.depositUsd * 10 ** USDC_DECIMALS))
  // Mirror the contract's own bounds (it enforces them anyway; fail early).
  const roundSeconds = Math.min(365 * 24 * 60 * 60, Math.max(1, Math.floor(params.roundSeconds)))
  const seats = Math.min(256, Math.max(2, Math.floor(params.seats)))
  if (depositUnits <= 0n) throw new Error('a deposit amount is required')

  onPhase?.('creating')
  const magicWallet = await getMagicWalletClient(arbitrumSepolia.id)
  const organizer = magicWallet.account?.address as Address | undefined
  if (!organizer) throw new Error('Magic wallet has no account')

  const kernelClient = await createRallyKernelClient({
    magicWallet,
    chainId: arbitrumSepolia.id,
  })

  // 1. createCircle from the creator's kernel — organizer = msg.sender = the
  //    creator's EOA (7702 keeps them identical). Gas: ZeroDev paymaster.
  const { transactionHash: createTx } = await sendSponsoredCalls(kernelClient, [
    {
      to: ROTATING_VAULT,
      data: encodeFunctionData({
        abi: ROTATING_VAULT_ABI,
        functionName: 'createCircle',
        args: [USDC_ARB, depositUnits, roundSeconds, seats],
      }),
    },
  ])

  // 2. The circle id comes from the CircleCreated event in the receipt — a
  //    bundler tx can carry several userOps, so match on OUR organizer too.
  const rcpt = await publicClient().waitForTransactionReceipt({ hash: createTx })
  let circleId: bigint | null = null
  for (const log of rcpt.logs) {
    if (log.address.toLowerCase() !== ROTATING_VAULT.toLowerCase()) continue
    try {
      const parsed = decodeEventLog({ abi: ROTATING_VAULT_ABI, data: log.data, topics: log.topics })
      if (
        parsed.eventName === 'CircleCreated' &&
        (parsed.args as { organizer: Address }).organizer.toLowerCase() === organizer.toLowerCase()
      ) {
        circleId = (parsed.args as { circleId: bigint }).circleId
        break
      }
    } catch {
      /* other event — ignore */
    }
  }
  if (circleId == null) throw new Error('circle created but CircleCreated event not found')
  const idStr = circleId.toString()

  // 3. Seat 0 binds the creator's own Magic address. Open seats stay unsigned
  //    until a joiner logs in and the organizer countersigns that wallet.
  onPhase?.('signing')
  const seatZeroInvite = await signInviteAsCreator({
    circleId,
    member: organizer,
    payoutIndex: 0,
    organizer,
  })
  await assertDigestMatchesContract(seatZeroInvite, circleId)
  const invites: SignedInvite[] = []

  // 4. The creator takes seat 0 through their own kernel (sponsored). The
  //    signature — not the submitter — is the authorization on-chain.
  onPhase?.('seating')
  const { transactionHash: seatTx } = await sendSponsoredCalls(kernelClient, [
    {
      to: ROTATING_VAULT,
      data: encodeFunctionData({
        abi: ROTATING_VAULT_ABI,
        functionName: 'redeemInvite',
        args: [
          circleId,
          organizer,
          0n,
          BigInt(seatZeroInvite.nonce),
          BigInt(seatZeroInvite.expiresAt),
          seatZeroInvite.signature as Hex,
        ],
      }),
    },
  ])

  return {
    circleId: idStr,
    organizer,
    createTx,
    seatTx,
    invites,
    started: false, // starts when full — organizer-only, see startSelfCustodiedCircle
    explorer: `${EXPLORER}/tx/${createTx}`,
  }
}

// ─── Start (organizer-only, through the organizer's kernel) ─────────────────

export interface SelfCustodyStartResult {
  tx: Hex
  userOpHash: Hex
  explorer: string
}

/**
 * Start a full circle as its organizer — `start` is organizer-only on-chain,
 * so this MUST come from the creator's wallet; the relayer structurally
 * cannot do it for self-custodied circles. Gasless via the 7702 kernel.
 */
export async function startSelfCustodiedCircle(params: {
  circleId: string
}): Promise<SelfCustodyStartResult> {
  const magicWallet = await getMagicWalletClient(arbitrumSepolia.id)
  if (!magicWallet.account) throw new Error('Magic wallet has no account')
  const kernelClient = await createRallyKernelClient({
    magicWallet,
    chainId: arbitrumSepolia.id,
  })
  const { userOpHash, transactionHash } = await sendSponsoredCalls(kernelClient, [
    {
      to: ROTATING_VAULT,
      data: encodeFunctionData({
        abi: ROTATING_VAULT_ABI,
        functionName: 'start',
        args: [BigInt(params.circleId)],
      }),
    },
  ])
  return { tx: transactionHash, userOpHash, explorer: `${EXPLORER}/tx/${transactionHash}` }
}

// ─── Organizer re-mints an invite (lost the create screen, burned link…) ────

/**
 * Sign a fresh invite for an open seat of a circle the logged-in user
 * organizes, bound to the joiner's Magic wallet. Returns the SignedInvite.
 */
export async function mintSeatInviteAsOrganizer(params: {
  circleId: string
  seat: number
  /** The joiner's Magic wallet — required. Never a derived placeholder. */
  member: Address
}): Promise<SignedInvite> {
  const circleId = BigInt(params.circleId)
  const magicWallet = await getMagicWalletClient(arbitrumSepolia.id)
  const organizer = magicWallet.account?.address as Address | undefined
  if (!organizer) throw new Error('Magic wallet has no account')

  const onchain = await publicClient().readContract({
    ...vault,
    functionName: 'getCircle',
    args: [circleId],
  })
  if (onchain.organizer.toLowerCase() !== organizer.toLowerCase()) {
    throw new Error('Only this circle’s organizer can sign invites.')
  }
  if (!params.member || params.member.toLowerCase() === organizer.toLowerCase()) {
    // seat 0 is the organizer; open seats bind a different wallet
    if (params.seat !== 0) {
      throw new Error('Countersign the joiner’s own email wallet, not a placeholder.')
    }
  }

  const invite = await signInviteAsCreator({
    circleId,
    member: params.member,
    payoutIndex: params.seat,
    organizer,
  })
  await assertDigestMatchesContract(invite, circleId)
  return invite
}
