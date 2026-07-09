/**
 * Rally · Circles — ON-CHAIN PROOF of the self-custodied organizer lane
 * ---------------------------------------------------------------------------
 * The Magic email OTP can't be clicked from a script, so this proof swaps
 * Magic's signer for a THROWAWAY scripted EOA (freshly generated here — NOT
 * the relayer key) and then runs the exact same building blocks the app runs
 * in lib/circle-self-custody.ts:
 *
 *   1. createCircle from the throwaway's ZeroDev 7702 kernel (sponsored)
 *      → organizer = the throwaway EOA, not the relayer.
 *   2. EIP-712 invites signed by the throwaway (viem signTypedData — the same
 *      plain-ECDSA shape Magic produces), locally verified via
 *      recoverTypedDataAddress AND cross-checked against the contract's
 *      inviteDigest view.
 *   3. Seat 0 redeemed through the organizer's own kernel; seat 1 redeemed BY
 *      THE RELAYER submitting the organizer-signed invite (the /invite server
 *      path — the relayer can relay, but cannot sign).
 *   4. start() from the organizer's kernel — organizer-gated on-chain, so
 *      this succeeding IS the proof the relayer no longer holds that power.
 *
 * Prints the circle id + every tx hash; verify independently with:
 *   cast call 0xdd9b3e5F407B99e2C2827695608741B328F97838 \
 *     "getCircle(uint256)((address,uint8,uint16,uint16,uint16,address,uint64,uint32,uint256))" \
 *     <circleId> --rpc-url https://sepolia-rollup.arbitrum.io/rpc
 *
 * ENV: VITE_ZERODEV_PROJECT_ID (+ optional ALCHEMY_API_KEY, RELAYER_KEY).
 * Run: bun --env-file=.env.local scripts/prove-self-custody.ts
 */
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from '@zerodev/sdk'
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants'
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  hashTypedData,
  http,
  recoverTypedDataAddress,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { loadRelayerKey } from '#/lib/cctp/contribute-fill'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import {
  INVITE_DOMAIN,
  INVITE_TYPES,
  ROTATING_VAULT,
  ROTATING_VAULT_ABI,
} from '#/lib/circle'

const PROJECT_ID = process.env.VITE_ZERODEV_PROJECT_ID
if (!PROJECT_ID) throw new Error('VITE_ZERODEV_PROJECT_ID not set (.env.local)')

const USDC_ARB = EVM_CHAINS.arbitrumSepolia.usdc
const EXPLORER = EVM_CHAINS.arbitrumSepolia.explorer
const vault = { address: ROTATING_VAULT, abi: ROTATING_VAULT_ABI } as const
const zerodevRpc = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/${arbitrumSepolia.id}`
const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
const publicRpc = alchemy
  ? `https://arb-sepolia.g.alchemy.com/v2/${alchemy}`
  : 'https://sepolia-rollup.arbitrum.io/rpc'

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(publicRpc) })

/** The app's kernel path (zerodev.ts) with a scripted signer instead of Magic. */
async function kernelFor(signer: ReturnType<typeof privateKeyToAccount>) {
  const zdPublic = createPublicClient({ chain: arbitrumSepolia, transport: http(zerodevRpc) })
  const account = await createKernelAccount(zdPublic, {
    eip7702Account: signer,
    entryPoint: getEntryPoint('0.7'),
    kernelVersion: KERNEL_V3_3,
  })
  if (account.address.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('7702 kernel address != EOA address (unexpected)')
  }
  const paymaster = createZeroDevPaymasterClient({
    chain: arbitrumSepolia,
    transport: http(zerodevRpc),
  })
  return createKernelAccountClient({
    account,
    chain: arbitrumSepolia,
    client: zdPublic,
    bundlerTransport: http(zerodevRpc),
    paymaster,
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient),
    },
  })
}

async function sendSponsored(kernelClient: Awaited<ReturnType<typeof kernelFor>>, data: Hex) {
  const callData = await kernelClient.account!.encodeCalls([
    { to: ROTATING_VAULT, value: 0n, data },
  ])
  const userOpHash = await kernelClient.sendUserOperation({ callData })
  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 120_000,
  })
  return receipt.receipt.transactionHash
}

/** Sign + verify an invite exactly like lib/circle-self-custody.ts does. */
async function signInvite(
  organizer: ReturnType<typeof privateKeyToAccount>,
  msg: { circleId: bigint; member: Address; payoutIndex: bigint; nonce: bigint },
) {
  const typedData = {
    domain: INVITE_DOMAIN,
    types: INVITE_TYPES,
    primaryType: 'Invite',
    message: msg,
  } as const
  const signature = await organizer.signTypedData(typedData)

  const recovered = await recoverTypedDataAddress({ ...typedData, signature })
  if (recovered.toLowerCase() !== organizer.address.toLowerCase()) {
    throw new Error('recovered signer != organizer')
  }
  const local = hashTypedData(typedData)
  const onchain = (await publicClient.readContract({
    ...vault,
    functionName: 'inviteDigest',
    args: [msg.circleId, msg.member, msg.payoutIndex, msg.nonce],
  })) as Hex
  if (local.toLowerCase() !== onchain.toLowerCase()) {
    throw new Error(`digest mismatch: local ${local} vs contract ${onchain}`)
  }
  console.log(`   sig verified (recover→organizer ✓, digest==inviteDigest ✓) seat ${msg.payoutIndex}`)
  return signature
}

async function main() {
  // ── The cast: a throwaway organizer + a throwaway member. NOT the relayer. ─
  const organizer = privateKeyToAccount(generatePrivateKey())
  const member2 = privateKeyToAccount(generatePrivateKey())
  const relayer = privateKeyToAccount(await loadRelayerKey())
  console.log(`organizer (throwaway EOA): ${organizer.address}`)
  console.log(`member 2  (throwaway EOA): ${member2.address}`)
  console.log(`relayer   (submit-only):   ${relayer.address}`)
  if (organizer.address.toLowerCase() === relayer.address.toLowerCase()) {
    throw new Error('organizer must not be the relayer')
  }

  // ── 1. createCircle from the ORGANIZER's 7702 kernel (sponsored) ───────────
  const kernel = await kernelFor(organizer)
  console.log('\n1) createCircle from the organizer kernel (gasless)…')
  const createTx = await sendSponsored(
    kernel,
    encodeFunctionData({
      abi: ROTATING_VAULT_ABI,
      functionName: 'createCircle',
      args: [USDC_ARB, 100_000n /* $0.10 */, 300, 2],
    }),
  )
  console.log(`   createTx: ${EXPLORER}/tx/${createTx}`)

  const rcpt = await publicClient.waitForTransactionReceipt({ hash: createTx })
  let circleId: bigint | null = null
  for (const log of rcpt.logs) {
    if (log.address.toLowerCase() !== ROTATING_VAULT.toLowerCase()) continue
    try {
      const parsed = decodeEventLog({ abi: ROTATING_VAULT_ABI, data: log.data, topics: log.topics })
      if (
        parsed.eventName === 'CircleCreated' &&
        (parsed.args as { organizer: Address }).organizer.toLowerCase() ===
          organizer.address.toLowerCase()
      ) {
        circleId = (parsed.args as { circleId: bigint }).circleId
        break
      }
    } catch {}
  }
  if (circleId == null) throw new Error('CircleCreated not found in receipt')
  console.log(`   circleId: ${circleId}`)

  const created = await publicClient.readContract({
    ...vault,
    functionName: 'getCircle',
    args: [circleId],
  })
  console.log(`   on-chain organizer: ${created.organizer}`)
  if (created.organizer.toLowerCase() !== organizer.address.toLowerCase()) {
    throw new Error('organizer is not the throwaway EOA')
  }
  console.log('   ✓ organizer == throwaway EOA (NOT the relayer)')

  // ── 2. Organizer signs invites; verify before use ──────────────────────────
  console.log('\n2) organizer signs both seat invites (EIP-712, client-side shape)…')
  const nonce0 = BigInt(generatePrivateKey())
  const nonce1 = BigInt(generatePrivateKey())
  const sig0 = await signInvite(organizer, {
    circleId,
    member: organizer.address,
    payoutIndex: 0n,
    nonce: nonce0,
  })
  const sig1 = await signInvite(organizer, {
    circleId,
    member: member2.address,
    payoutIndex: 1n,
    nonce: nonce1,
  })

  // ── 3a. Seat 0: organizer's own kernel redeems (the app's create flow) ─────
  console.log('\n3a) seat 0 redeemed through the organizer kernel…')
  const seat0Tx = await sendSponsored(
    kernel,
    encodeFunctionData({
      abi: ROTATING_VAULT_ABI,
      functionName: 'redeemInvite',
      args: [circleId, organizer.address, 0n, nonce0, sig0],
    }),
  )
  console.log(`   seat0Tx: ${EXPLORER}/tx/${seat0Tx}`)

  // ── 3b. Seat 1: the RELAYER submits the org-signed invite (/invite path) ───
  console.log('\n3b) seat 1 redeemed BY THE RELAYER (submit-only; signature is the auth)…')
  const relayerWallet = createWalletClient({
    account: relayer,
    chain: arbitrumSepolia,
    transport: http(publicRpc),
  })
  const seat1Tx = await relayerWallet.writeContract({
    ...vault,
    functionName: 'redeemInvite',
    args: [circleId, member2.address, 1n, nonce1, sig1],
  })
  await publicClient.waitForTransactionReceipt({ hash: seat1Tx })
  console.log(`   seat1Tx: ${EXPLORER}/tx/${seat1Tx}`)

  // ── 4. start() — organizer-only — from the organizer kernel ────────────────
  console.log('\n4) start() from the organizer kernel (organizer-gated on-chain)…')
  const startTx = await sendSponsored(
    kernel,
    encodeFunctionData({ abi: ROTATING_VAULT_ABI, functionName: 'start', args: [circleId] }),
  )
  console.log(`   startTx: ${EXPLORER}/tx/${startTx}`)

  const finalCircle = await publicClient.readContract({
    ...vault,
    functionName: 'getCircle',
    args: [circleId],
  })
  const members = await publicClient.readContract({
    ...vault,
    functionName: 'getMembers',
    args: [circleId],
  })

  console.log('\n──────── PROOF ────────')
  console.log(`circleId:   ${circleId}`)
  console.log(`organizer:  ${finalCircle.organizer}  (throwaway EOA — relayer is ${relayer.address})`)
  console.log(`status:     ${finalCircle.status} (2 = Active)  joined: ${finalCircle.joined}/2`)
  console.log(`members:    [${members.join(', ')}]`)
  console.log(`createTx:   ${createTx}`)
  console.log(`seat0Tx:    ${seat0Tx}`)
  console.log(`seat1Tx:    ${seat1Tx}  (submitted by the relayer, signed by the organizer)`)
  console.log(`startTx:    ${startTx}`)
  if (
    finalCircle.organizer.toLowerCase() !== organizer.address.toLowerCase() ||
    Number(finalCircle.status) !== 2
  ) {
    throw new Error('PROOF FAILED')
  }
  console.log('\n✅ self-custodied organizer lane proven end-to-end on Arbitrum Sepolia')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
