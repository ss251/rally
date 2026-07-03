/**
 * Rally · Circles — relayer-side RotatingVault actions (SERVER-ONLY)
 * ---------------------------------------------------------------------------
 * The Circles twin of lib/cctp/contribute-fill.ts. The funded Rally relayer key
 * (server-side, never shipped to the client) drives the on-chain circle
 * lifecycle so ONE person with an email can experience a full rotation:
 *
 *   createCircle → EIP-712 signed invites → redeemInvite → start
 *   → depositFor (relayer fronts testnet USDC — the honest demo pattern,
 *     same as the CCTP contribute fallback) → refundFor on a break.
 *
 * HONEST DEMO PATTERN — THE DEMO LANE ONLY: circles created here have the
 * RELAYER as organizer, so the server can mint org-signed EIP-712 invites ON
 * DEMAND for member addresses that only become known when an invitee logs in
 * with their email (Magic). The signature flow, verification, and every state
 * transition run on the REAL deployed RotatingVault. This lane is reached
 * exclusively through the "demo friends" toggle on /circles/new — the Rally
 * crew runs the demo, and the UI says so. REAL in-app creates are
 * SELF-CUSTODIED (lib/circle-self-custody.ts): the creator's own 7702 email
 * wallet is the organizer, signs every invite client-side, and alone can call
 * start. For those circles this relayer can only SUBMIT already-signed
 * invites (redeemSeat below) — it cannot mint one, and start/cancel revert
 * for it on-chain. Claims are NEVER relayed — the contract pays msg.sender
 * only, so claiming goes through the client-side gasless path
 * (lib/circle-gasless.ts).
 *
 * SERVER-ONLY: loads the relayer private key. Only ever reached through the
 * createServerFn handlers in ./circle-actions.ts (dynamic import).
 */
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatUnits,
  http,
  maxUint256,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import { keccak256, concatHex, toHex } from 'viem'

import { loadRelayerKey } from '#/lib/cctp/contribute-fill'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import {
  INVITE_DOMAIN,
  INVITE_TYPES,
  ROTATING_VAULT,
  ROTATING_VAULT_ABI,
} from '#/lib/circle'

const USDC_ARB = EVM_CHAINS.arbitrumSepolia.usdc
const USDC_DECIMALS = 6
const EXPLORER = EVM_CHAINS.arbitrumSepolia.explorer

// Guardrails — the relayer treasury is small, finite testnet USDC.
const MIN_DEPOSIT_USD = 0.1
const MAX_DEPOSIT_USD = 5
const MIN_SEATS = 2
const MAX_SEATS = 8
const MIN_ROUND_S = 300 // 5 minutes (demo cadence)
const MAX_ROUND_S = 365 * 24 * 60 * 60
/** Hard ceiling on relayer USDC moved by a single fill-the-round call. */
const MAX_FILL_SPEND_USD = 10
/** Keep this much USDC in the relayer as headroom (mirrors the CCTP fill). */
const RELAYER_RESERVE_USD = 1

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

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
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
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
  return { relayer, pk, publicClient, walletClient }
}

const vault = { address: ROTATING_VAULT, abi: ROTATING_VAULT_ABI } as const
const toUnits = (usd: number) => BigInt(Math.round(usd * 10 ** USDC_DECIMALS))
const toUsd = (raw: bigint) => Number(formatUnits(raw, USDC_DECIMALS))

/**
 * Deterministic demo-member accounts, derived from the relayer key — they need
 * no funds (redeemInvite is org-signed; deposits arrive via depositFor), and
 * being derived means any refunds routed to them remain recoverable.
 */
function simAccount(relayerPk: Hex, i: number) {
  return privateKeyToAccount(keccak256(concatHex([relayerPk, toHex(`rally-circle-sim-${i}`)])))
}

/** Random 256-bit invite nonce (viem's key generator is a fine CSPRNG source). */
const randomNonce = () => BigInt(generatePrivateKey())

async function signInviteAsOrganizer(
  relayer: ReturnType<typeof privateKeyToAccount>,
  msg: { circleId: bigint; member: Address; payoutIndex: bigint; nonce: bigint },
): Promise<Hex> {
  return relayer.signTypedData({
    domain: INVITE_DOMAIN,
    types: INVITE_TYPES,
    primaryType: 'Invite',
    message: msg,
  })
}

export interface CreateCircleInput {
  /** Per-member per-round USDC. Clamped to [0.1, 5] (testnet treasury). */
  depositUsd: number
  /** Seconds per round. Clamped to [300, 365d]. */
  roundSeconds: number
  /** Rotation size N. Clamped to [2, 8] for the demo. */
  seats: number
  /** The creator's email-wallet address — seat 0 is redeemed for them. */
  creator?: Address
  /** Fill the remaining seats with demo members + start the circle. */
  demoFill?: boolean
}

export interface CreateCircleResult {
  circleId: string
  createTx: Hex
  /** Seats after creation: address per seat (null = still open, share a link). */
  seats: { seat: number; member: Address | null; demo: boolean }[]
  started: boolean
  explorer: string
}

export async function createCircleOnchain(input: CreateCircleInput): Promise<CreateCircleResult> {
  const depositUsd = Math.min(MAX_DEPOSIT_USD, Math.max(MIN_DEPOSIT_USD, input.depositUsd))
  const roundSeconds = Math.min(MAX_ROUND_S, Math.max(MIN_ROUND_S, Math.floor(input.roundSeconds)))
  const seats = Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.floor(input.seats)))
  const { pk, publicClient, walletClient } = await clients()

  // 1. createCircle — the relayer is the organizer (see file header).
  const createTx = await walletClient.writeContract({
    ...vault,
    functionName: 'createCircle',
    args: [USDC_ARB, toUnits(depositUsd), roundSeconds, seats],
  })
  const rcpt = await publicClient.waitForTransactionReceipt({ hash: createTx })

  let circleId: bigint | null = null
  for (const log of rcpt.logs) {
    if (log.address.toLowerCase() !== ROTATING_VAULT.toLowerCase()) continue
    try {
      const parsed = decodeEventLog({ abi: ROTATING_VAULT_ABI, data: log.data, topics: log.topics })
      if (parsed.eventName === 'CircleCreated') {
        circleId = (parsed.args as { circleId: bigint }).circleId
        break
      }
    } catch {
      /* other event — ignore */
    }
  }
  if (circleId == null) throw new Error('circle created but CircleCreated event not found')

  const seatsOut: CreateCircleResult['seats'] = Array.from({ length: seats }, (_, i) => ({
    seat: i,
    member: null,
    demo: false,
  }))

  // 2. Seat 0 → the creator (org-signed EIP-712 invite, redeemed gaslessly).
  if (input.creator) {
    await redeemSeatInternal({ circleId, payoutIndex: 0, member: input.creator }, false)
    seatsOut[0] = { seat: 0, member: input.creator, demo: false }
  }

  // 3. Demo fill: the remaining seats become derived demo members so one
  //    person can watch a full rotation solo.
  let started = false
  if (input.demoFill) {
    for (let i = 0; i < seats; i++) {
      if (seatsOut[i].member) continue
      const sim = simAccount(pk, i)
      await redeemSeatInternal({ circleId, payoutIndex: i, member: sim.address }, false)
      seatsOut[i] = { seat: i, member: sim.address, demo: true }
    }
  }

  // 4. Start the moment the rotation is full (the relayer is the organizer).
  const circle = await publicClient.readContract({
    ...vault,
    functionName: 'getCircle',
    args: [circleId],
  })
  if (Number(circle.joined) === seats) {
    const startTx = await walletClient.writeContract({ ...vault, functionName: 'start', args: [circleId] })
    await publicClient.waitForTransactionReceipt({ hash: startTx })
    started = true
  }

  return {
    circleId: circleId.toString(),
    createTx,
    seats: seatsOut,
    started,
    explorer: `${EXPLORER}/tx/${createTx}`,
  }
}

export interface RedeemSeatInput {
  circleId: bigint
  payoutIndex: number
  member: Address
  /** A pre-signed org invite (URL-encoded form). When present it is relayed
   *  as-is; when absent the relayer must BE the organizer and signs one now. */
  nonce?: bigint
  signature?: Hex
}

export interface RedeemSeatResult {
  tx: Hex
  seat: number
  member: Address
  /** True when redeeming this seat completed the rotation and started it. */
  started: boolean
}

async function redeemSeatInternal(
  input: RedeemSeatInput,
  autoStart: boolean,
): Promise<RedeemSeatResult> {
  const { relayer, publicClient, walletClient } = await clients()
  const { circleId, member } = input
  const payoutIndex = BigInt(input.payoutIndex)

  const circle = await publicClient.readContract({
    ...vault,
    functionName: 'getCircle',
    args: [circleId],
  })
  if (Number(circle.status) !== 1) throw new Error('NotFilling')

  let nonce = input.nonce
  let signature = input.signature
  if (!signature) {
    // Mint an org-signed invite on demand — only possible for circles the
    // relayer organizes (the Rally-concierge demo circles).
    if (circle.organizer.toLowerCase() !== relayer.address.toLowerCase()) {
      throw new Error('this circle’s invites must be signed by its organizer')
    }
    nonce = randomNonce()
    signature = await signInviteAsOrganizer(relayer, { circleId, member, payoutIndex, nonce })
  }
  if (nonce == null) throw new Error('a signed invite needs its nonce')

  const tx = await walletClient.writeContract({
    ...vault,
    functionName: 'redeemInvite',
    args: [circleId, member, payoutIndex, nonce, signature],
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })

  // Start automatically once full (organizer == relayer on demo circles).
  let started = false
  if (autoStart) {
    const after = await publicClient.readContract({
      ...vault,
      functionName: 'getCircle',
      args: [circleId],
    })
    if (
      Number(after.joined) === Number(after.memberTarget) &&
      after.organizer.toLowerCase() === relayer.address.toLowerCase()
    ) {
      const startTx = await walletClient.writeContract({ ...vault, functionName: 'start', args: [circleId] })
      await publicClient.waitForTransactionReceipt({ hash: startTx })
      started = true
    }
  }

  return { tx, seat: input.payoutIndex, member, started }
}

export async function redeemSeat(input: RedeemSeatInput): Promise<RedeemSeatResult> {
  return redeemSeatInternal(input, true)
}

/** Ensure the vault can pull `needed` USDC from the relayer (approve once). */
async function ensureAllowance(
  publicClient: Awaited<ReturnType<typeof clients>>['publicClient'],
  walletClient: Awaited<ReturnType<typeof clients>>['walletClient'],
  owner: Address,
  needed: bigint,
) {
  const allowance = (await publicClient.readContract({
    address: USDC_ARB,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, ROTATING_VAULT],
  })) as bigint
  if (allowance >= needed) return
  const tx = await walletClient.writeContract({
    address: USDC_ARB,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [ROTATING_VAULT, maxUint256],
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
}

export interface DepositForResult {
  tx: Hex
  member: Address
  round: number
  amountUsd: number
  /** All N members are now in — the pot is claimable by the round's payee. */
  roundFunded: boolean
  explorer: string
}

/**
 * Relayer-fronted deposit for one member (the fresh-email-wallet fallback,
 * exactly mirroring the CCTP contribute fallback: recorded on-chain under the
 * member's real address; the relayer only fronts the finite testnet USDC).
 */
export async function depositForMember(params: {
  circleId: bigint
  member: Address
}): Promise<DepositForResult> {
  const { relayer, publicClient, walletClient } = await clients()
  const { circleId, member } = params

  const [circle, status] = await Promise.all([
    publicClient.readContract({ ...vault, functionName: 'getCircle', args: [circleId] }),
    publicClient.readContract({ ...vault, functionName: 'circleStatus', args: [circleId] }),
  ])
  if (Number(status) !== 2) throw new Error(Number(status) === 3 ? 'CircleIsBroken' : 'NotActive')

  // Treasury guard: never take the relayer below its reserve.
  const balance = (await publicClient.readContract({
    address: USDC_ARB,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [relayer.address],
  })) as bigint
  if (toUsd(balance - circle.depositAmount) < RELAYER_RESERVE_USD) {
    throw new Error('the demo treasury is running low — try a funded wallet')
  }

  await ensureAllowance(publicClient, walletClient, relayer.address, circle.depositAmount)

  const tx = await walletClient.writeContract({
    ...vault,
    functionName: 'depositFor',
    args: [circleId, member],
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })

  const nowSec = Math.floor(Date.now() / 1000)
  const round = Math.min(
    Math.floor((nowSec - Number(circle.startTime)) / Number(circle.roundDuration)),
    Number(circle.memberTarget) - 1,
  )
  const roundFunded = (await publicClient.readContract({
    ...vault,
    functionName: 'isRoundFunded',
    args: [circleId, BigInt(round)],
  })) as boolean

  return {
    tx,
    member,
    round,
    amountUsd: toUsd(circle.depositAmount),
    roundFunded,
    explorer: `${EXPLORER}/tx/${tx}`,
  }
}

export interface FillRoundResult {
  round: number
  deposited: { member: Address; tx: Hex }[]
  roundFunded: boolean
  amountUsdEach: number
}

/**
 * The demo lever: deposit for every member who hasn't funded the current round
 * (optionally skipping one address, e.g. the real user so they keep their own
 * moment). Bounded by MAX_FILL_SPEND_USD and the treasury reserve.
 */
export async function fillRound(params: {
  circleId: bigint
  except?: Address
}): Promise<FillRoundResult> {
  const { relayer, publicClient, walletClient } = await clients()
  const { circleId } = params

  const [circle, status, members] = await Promise.all([
    publicClient.readContract({ ...vault, functionName: 'getCircle', args: [circleId] }),
    publicClient.readContract({ ...vault, functionName: 'circleStatus', args: [circleId] }),
    publicClient.readContract({ ...vault, functionName: 'getMembers', args: [circleId] }),
  ])
  if (Number(status) !== 2) throw new Error(Number(status) === 3 ? 'CircleIsBroken' : 'NotActive')

  const nowSec = Math.floor(Date.now() / 1000)
  const round = Math.floor((nowSec - Number(circle.startTime)) / Number(circle.roundDuration))
  if (round >= Number(circle.memberTarget)) throw new Error('CircleExpired')

  const deposits = await publicClient.multicall({
    contracts: members.map(
      (m) =>
        ({
          ...vault,
          functionName: 'roundDeposits',
          args: [circleId, BigInt(round), m],
        }) as const,
    ),
    allowFailure: false,
  })

  const unfunded = members.filter(
    (m, i) =>
      m !== ZERO_ADDR &&
      (deposits[i] as bigint) === 0n &&
      m.toLowerCase() !== params.except?.toLowerCase(),
  )

  const eachUsd = toUsd(circle.depositAmount)
  if (eachUsd * unfunded.length > MAX_FILL_SPEND_USD) {
    throw new Error('this round is too large for the demo treasury')
  }
  const balance = (await publicClient.readContract({
    address: USDC_ARB,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [relayer.address],
  })) as bigint
  if (toUsd(balance) - eachUsd * unfunded.length < RELAYER_RESERVE_USD) {
    throw new Error('the demo treasury is running low — try again later')
  }

  await ensureAllowance(
    publicClient,
    walletClient,
    relayer.address,
    circle.depositAmount * BigInt(Math.max(1, unfunded.length)),
  )

  const deposited: FillRoundResult['deposited'] = []
  for (const m of unfunded) {
    const tx = await walletClient.writeContract({
      ...vault,
      functionName: 'depositFor',
      args: [circleId, m],
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })
    deposited.push({ member: m, tx })
  }

  const roundFunded = (await publicClient.readContract({
    ...vault,
    functionName: 'isRoundFunded',
    args: [circleId, BigInt(round)],
  })) as boolean

  return { round, deposited, roundFunded, amountUsdEach: eachUsd }
}

export interface RefundResult {
  tx: Hex
  member: Address
  amountUsd: number
  explorer: string
}

/** Gasless refund for anyone: refundFor is permissionless; funds go to `member`. */
export async function refundMember(params: {
  circleId: bigint
  member: Address
}): Promise<RefundResult> {
  const { publicClient, walletClient } = await clients()
  const { circleId, member } = params

  const owed = (await publicClient.readContract({
    ...vault,
    functionName: 'refundableAmount',
    args: [circleId, member],
  })) as bigint
  if (owed === 0n) throw new Error('NothingToRefund')

  const tx = await walletClient.writeContract({
    ...vault,
    functionName: 'refundFor',
    args: [circleId, member],
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })

  return { tx, member, amountUsd: toUsd(owed), explorer: `${EXPLORER}/tx/${tx}` }
}
