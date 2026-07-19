/**
 * Rally · testnet dispenser (SERVER-ONLY logic, called through server fns)
 * ---------------------------------------------------------------------------
 * Replaces the silent relayer-fronting fallback on the Goals chip-in with an
 * honest, sybil-gated faucet: a first-time backer whose embedded wallet is
 * empty verifies once with GitHub and receives a small grant of TESTNET USDC
 * (Base Sepolia) into THEIR OWN wallet — after which the real backer-funded
 * gasless path runs. One claim per GitHub account, one per wallet.
 *
 * - Claims persist on the Railway volume (DISPENSER_CLAIMS_FILE=/data/…), the
 *   same durability fix as the campaign-title store — a redeploy keeps them.
 * - The treasury is a DEDICATED key (DISPENSER_KEY) holding only faucet funds;
 *   a bug here cannot touch the relayer's gas or anything else. Per-claim
 *   amount is clamped server-side.
 * - DISPENSER_ALLOWLIST names GitHub logins allowed to re-claim (testing).
 * - Kill switch: DISPENSER_FALLBACK=relayer restores the old fronting path
 *   without a rebuild (read by the chip-in server fn config).
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { EVM_CHAINS } from '#/lib/cctp/addresses'

const BASE = EVM_CHAINS.baseSepolia
const USDC_DECIMALS = 6

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function dispenserEnabled(): boolean {
  return Boolean(process.env.DISPENSER_KEY && process.env.GH_CLIENT_ID && process.env.GH_CLIENT_SECRET)
}

export function fallbackMode(): 'relayer' | 'none' {
  return process.env.DISPENSER_FALLBACK === 'relayer' ? 'relayer' : 'none'
}

export function claimUsd(): number {
  const v = Number(process.env.DISPENSER_CLAIM_USD ?? 5)
  // Hard clamp — even a mangled env can't turn the faucet into a firehose.
  return Math.min(10, Math.max(1, Number.isFinite(v) ? v : 5))
}

function claimsFile(): string {
  return process.env.DISPENSER_CLAIMS_FILE ?? '/tmp/dispenser-claims.json'
}

// ---------------------------------------------------------------------------
// Signed state — binds the OAuth round-trip to (wallet, expiry). HMAC over the
// payload with a server secret; the client never sees anything forgeable.
// ---------------------------------------------------------------------------

async function hmac(payload: string): Promise<string> {
  const { createHmac } = await import('node:crypto')
  const secret = process.env.DISPENSER_STATE_SECRET ?? 'dev-only'
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export async function signState(wallet: Address): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ w: wallet, exp: Date.now() + 15 * 60_000 })).toString(
    'base64url',
  )
  return `${payload}.${await hmac(payload)}`
}

export async function verifyState(state: string): Promise<Address | null> {
  const [payload, mac] = state.split('.')
  if (!payload || !mac) return null
  if ((await hmac(payload)) !== mac) return null
  try {
    const { w, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof exp !== 'number' || Date.now() > exp) return null
    if (typeof w !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(w)) return null
    return w as Address
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Claims store — same atomic tmp+rename shape as the campaign meta store.
// ---------------------------------------------------------------------------

interface Claim {
  ghId: string
  ghLogin: string
  wallet: Address
  amountUsd: number
  tx: Hex
  at: string
}

async function readClaims(): Promise<Claim[]> {
  try {
    const { readFileSync } = await import('node:fs')
    const parsed = JSON.parse(readFileSync(claimsFile(), 'utf8'))
    return Array.isArray(parsed) ? (parsed as Claim[]) : []
  } catch {
    return []
  }
}

async function appendClaim(claim: Claim): Promise<void> {
  const { mkdirSync, writeFileSync, renameSync } = await import('node:fs')
  const { dirname } = await import('node:path')
  const file = claimsFile()
  const store = await readClaims()
  store.push(claim)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(tmp, file)
}

// ---------------------------------------------------------------------------
// GitHub OAuth (server side of the round trip)
// ---------------------------------------------------------------------------

interface GhUser {
  id: string
  login: string
}

async function exchangeCodeForUser(code: string): Promise<GhUser> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GH_CLIENT_ID,
      client_secret: process.env.GH_CLIENT_SECRET,
      code,
    }),
  })
  const tok = (await res.json()) as { access_token?: string; error?: string }
  if (!tok.access_token) throw new Error(`github token exchange failed: ${tok.error ?? res.status}`)

  const me = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': 'rally-dispenser' },
  })
  if (!me.ok) throw new Error(`github /user failed: ${me.status}`)
  const u = (await me.json()) as { id: number; login: string }
  return { id: String(u.id), login: u.login }
}

// ---------------------------------------------------------------------------
// The dispense itself
// ---------------------------------------------------------------------------

const ERC20 = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export interface DispenseResult {
  ok: boolean
  amountUsd?: number
  tx?: Hex
  ghLogin?: string
  reason?: 'already-claimed' | 'treasury-empty' | 'error'
  message?: string
}

/** Balance check used by the sheet to decide whether to even offer the faucet. */
export async function treasuryUsd(): Promise<number> {
  const pk = process.env.DISPENSER_KEY as Hex | undefined
  if (!pk) return 0
  const treasury = privateKeyToAccount(pk)
  const pub = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') })
  const bal = (await pub.readContract({
    address: BASE.usdc,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [treasury.address],
  })) as bigint
  return Number(formatUnits(bal, USDC_DECIMALS))
}

export async function claimForCode(code: string, state: string): Promise<DispenseResult> {
  const wallet = await verifyState(state)
  if (!wallet) return { ok: false, reason: 'error', message: 'bad or expired state' }

  const gh = await exchangeCodeForUser(code)

  const allow = (process.env.DISPENSER_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const isAllowlisted = allow.includes(gh.login.toLowerCase())

  const claims = await readClaims()
  if (!isAllowlisted) {
    if (claims.some((c) => c.ghId === gh.id))
      return { ok: false, reason: 'already-claimed', ghLogin: gh.login }
    if (claims.some((c) => c.wallet.toLowerCase() === wallet.toLowerCase()))
      return { ok: false, reason: 'already-claimed', ghLogin: gh.login }
  }

  const amount = claimUsd()
  const units = BigInt(Math.round(amount * 10 ** USDC_DECIMALS))

  const pk = process.env.DISPENSER_KEY as Hex | undefined
  if (!pk) return { ok: false, reason: 'error', message: 'dispenser not configured' }
  const treasury = privateKeyToAccount(pk)
  const pub = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') })
  const walletClient = createWalletClient({
    account: treasury,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  })

  const bal = (await pub.readContract({
    address: BASE.usdc,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [treasury.address],
  })) as bigint
  if (bal < units) return { ok: false, reason: 'treasury-empty' }

  const tx = await walletClient.writeContract({
    address: BASE.usdc,
    abi: ERC20,
    functionName: 'transfer',
    args: [wallet, units],
    chain: baseSepolia,
  })
  await pub.waitForTransactionReceipt({ hash: tx })

  await appendClaim({
    ghId: gh.id,
    ghLogin: gh.login,
    wallet,
    amountUsd: amount,
    tx,
    at: new Date().toISOString(),
  })

  return { ok: true, amountUsd: amount, tx, ghLogin: gh.login }
}
