/**
 * Rally · PROBE — Magic embedded-wallet shape vs the ZeroDev 7702 kernel path
 * ---------------------------------------------------------------------------
 * The real Magic email OTP can't be clicked from a script, so this probe
 * reconstructs the EXACT provider surface Magic exposes and drives the SAME
 * code paths the browser will. No secrets, no funds: a throwaway local key
 * backs a fake EIP-1193 provider that answers ONLY the RPC methods Magic's
 * `rpcProvider` actually supports:
 *
 *     eth_accounts, eth_requestAccounts, eth_chainId,
 *     personal_sign, eth_signTypedData_v4, eth_sendTransaction
 *
 * It does NOT support any `eth_signAuthorization` / raw 7702 RPC — because a
 * plain provider can't sign a 7702 authorization (viem rejects json-rpc
 * accounts). Magic's ONLY 7702 signer is the SDK method
 * `magic.wallet.sign7702Authorization`, which this probe also fakes (backed by
 * the same throwaway key) so we can prove the wrapper end-to-end.
 *
 * Part B (offline): magicLocalAccount produces valid message / typed-data /
 *   authorization signatures that recover to the EOA.
 * Part A (needs VITE_ZERODEV_PROJECT_ID + network): createRallyKernelClient
 *   (1) no longer crashes with "Cannot read properties of undefined (address)"
 *       on the OLD bare-json-rpc-account shape — it throws the DESIGNED,
 *       human-readable error instead (fresh EOA is not delegated); and
 *   (2) BUILDS a kernel client from the NEW Magic-backed LocalAccount shape,
 *       with the smart-account address == the EOA (the point of 7702).
 *
 * Run: bun --env-file=<path-to>/.env.local scripts/probe-magic-shape.ts
 */
import {
  createWalletClient,
  custom,
  numberToHex,
  recoverMessageAddress,
  recoverTypedDataAddress,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { recoverAuthorizationAddress } from 'viem/utils'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { magicLocalAccount } from '#/lib/auth/magic'
import {
  createRallyKernelClient,
  getKernelImplementationAddress,
  ZERODEV_PROJECT_ID,
} from '#/lib/auth/zerodev'

const chain = arbitrumSepolia

let failures = 0
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures++
}

/**
 * A fake EIP-1193 provider with EXACTLY Magic's rpcProvider method surface,
 * backed server-side by a throwaway local key. Anything outside the allow-list
 * throws "method not supported" — the same wall a real Magic provider hits when
 * asked to sign a raw 7702 authorization.
 */
function makeFakeMagicProvider(key: Hex, chainId: number) {
  const acct = privateKeyToAccount(key)
  const allowed = new Set([
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',
    'personal_sign',
    'eth_signTypedData_v4',
    'eth_sendTransaction',
  ])
  return {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      if (!allowed.has(method)) {
        throw new Error(`fake-magic-provider: method not supported: ${method}`)
      }
      switch (method) {
        case 'eth_accounts':
        case 'eth_requestAccounts':
          return [acct.address]
        case 'eth_chainId':
          return numberToHex(chainId)
        case 'personal_sign': {
          const [data] = params as [Hex, Address] // viem sends [message, address]
          return acct.signMessage({ message: { raw: data } })
        }
        case 'eth_signTypedData_v4': {
          const [, json] = params as [Address, string]
          return acct.signTypedData(JSON.parse(json))
        }
        case 'eth_sendTransaction':
          throw new Error('fake-magic-provider: eth_sendTransaction not exercised in probe')
        default:
          throw new Error(`fake-magic-provider: unreachable ${method}`)
      }
    },
  }
}

/** A fake `magic` object faithful to what magicLocalAccount consumes. */
function makeFakeMagic(key: Hex, chainId: number) {
  const acct = privateKeyToAccount(key)
  return {
    rpcProvider: makeFakeMagicProvider(key, chainId),
    // The ONLY way an embedded Magic key signs a 7702 authorization. We fake it
    // with the local key and hand back Magic's raw { r, s, v } shape (v=27/28).
    wallet: {
      sign7702Authorization: async (p: {
        contractAddress: Address
        chainId: number
        nonce: number
      }) => {
        const signed = await acct.signAuthorization({
          address: p.contractAddress,
          chainId: p.chainId,
          nonce: p.nonce,
        })
        return { r: signed.r, s: signed.s, v: BigInt((signed.yParity ?? 0) + 27) }
      },
    },
  }
}

async function partB_offline() {
  console.log('\n── Part B: magicLocalAccount signatures recover to the EOA (offline) ──')
  const key = generatePrivateKey()
  const eoa = privateKeyToAccount(key).address
  const magic = makeFakeMagic(key, chain.id)
  const local = magicLocalAccount({ magic: magic as any, chain, address: eoa })

  check('LocalAccount type is "local" (toSigner returns it as-is, no crash)', local.type === 'local')
  check('LocalAccount.address == EOA', local.address.toLowerCase() === eoa.toLowerCase())
  check('LocalAccount exposes signAuthorization', typeof local.signAuthorization === 'function')

  // 1. signMessage (userOp-hash path: personal_sign of a raw 32-byte hash)
  const rawHash = toHex(new Uint8Array(32).fill(7)) // arbitrary 32-byte "userOp hash"
  const sigM = await local.signMessage({ message: { raw: rawHash } })
  const recM = await recoverMessageAddress({ message: { raw: rawHash }, signature: sigM })
  check('signMessage recovers to EOA (Magic personal_sign)', recM.toLowerCase() === eoa.toLowerCase())

  // 2. signTypedData (EIP-712 invite path)
  const td = {
    domain: { name: 'RallyProbe', version: '1', chainId: chain.id },
    types: { Probe: [{ name: 'x', type: 'uint256' }] },
    primaryType: 'Probe' as const,
    message: { x: 42n },
  }
  const sigT = await local.signTypedData(td)
  const recT = await recoverTypedDataAddress({ ...td, signature: sigT })
  check('signTypedData recovers to EOA (Magic eth_signTypedData_v4)', recT.toLowerCase() === eoa.toLowerCase())

  // 3. signAuthorization (the 7702 delegation — Magic wallet.sign7702Authorization)
  const impl = getKernelImplementationAddress()
  const auth = await local.signAuthorization!({ address: impl, chainId: chain.id, nonce: 0 })
  const recA = await recoverAuthorizationAddress({ authorization: auth as any })
  check('signAuthorization recovers to EOA (Magic 7702 auth, normalized tuple)', recA.toLowerCase() === eoa.toLowerCase())
  check('authorization delegates to the kernel implementation', (auth as any).address.toLowerCase() === impl.toLowerCase())
}

async function partA_network() {
  console.log('\n── Part A: createRallyKernelClient against the provider shapes (network) ──')
  if (!ZERODEV_PROJECT_ID) {
    console.log('⏭  VITE_ZERODEV_PROJECT_ID not set — skipping the network probe (Part B still ran).')
    return
  }

  const key = generatePrivateKey()
  const eoa = privateKeyToAccount(key).address
  const provider = makeFakeMagicProvider(key, chain.id)
  console.log(`   fresh (undelegated) EOA: ${eoa}`)

  // A1: the OLD shape — a BARE json-rpc account (account = raw address string).
  // This is exactly what crashed with "reading 'address'". It must now fail with
  // our DESIGNED error, because a raw provider can't sign a 7702 authorization.
  const bareWallet = createWalletClient({ account: eoa, chain, transport: custom(provider as any) })
  try {
    await createRallyKernelClient({ magicWallet: bareWallet, chainId: chain.id })
    check('A1 bare-json-rpc: rejected (expected designed error)', false, 'unexpectedly resolved')
  } catch (e: any) {
    const m = String(e?.message ?? e)
    const crashed = /Cannot read properties of undefined/i.test(m)
    const designed = /not yet delegated/i.test(m)
    check('A1 bare-json-rpc: NO "undefined address" crash', !crashed, crashed ? m : 'ok')
    check('A1 bare-json-rpc: throws the DESIGNED human-readable error', designed, designed ? m : `unexpected: ${m}`)
  }

  // A2: the NEW shape — a Magic-backed LocalAccount. createRallyKernelClient must
  // BUILD a kernel client (authorization is signed lazily at send time; no funds
  // needed here), and the smart-account address must equal the EOA (7702).
  const magic = makeFakeMagic(key, chain.id)
  const local = magicLocalAccount({ magic: magic as any, chain, address: eoa })
  const magicWallet = createWalletClient({ account: local, chain, transport: custom(magic.rpcProvider as any) })
  try {
    const kc = await createRallyKernelClient({ magicWallet, chainId: chain.id })
    const addr = kc.account?.address
    check('A2 provider-backed: kernel client built (no crash)', !!addr, `smartAccount=${addr}`)
    check('A2 provider-backed: smart-account address == EOA (7702 in place)', !!addr && addr.toLowerCase() === eoa.toLowerCase())
  } catch (e: any) {
    check('A2 provider-backed: kernel client built (no crash)', false, String(e?.message ?? e))
  }
}

async function main() {
  console.log('Rally 7702 probe — reconstructing the Magic shape without a browser')
  await partB_offline()
  await partA_network()

  console.log('\n────────')
  if (failures > 0) {
    console.error(`❌ probe FAILED — ${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('✅ probe PASSED — Magic-backed 7702 signer is correct and crash-free')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
