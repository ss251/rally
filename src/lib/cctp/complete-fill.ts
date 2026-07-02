/**
 * Rally · COMPLETE a backer-funded gasless contribution (SERVER-ONLY)
 * ---------------------------------------------------------------------------
 * The second half of the REAL product path. The backer already burned THEIR OWN
 * USDC on Base Sepolia, gaslessly, from their ZeroDev 7702 kernel account (see
 * ../backer-gasless.ts, client-side) — we only receive the burn tx hash here.
 * This module finishes the CCTP hop the backer's wallet can't do for itself:
 *
 *   burnTx (backer's own USDC)  --poll Iris attestation-->  mint on Arbitrum
 *   Sepolia (USDC lands in the GoalVault)  -->  recordContribution(campaignId,
 *   backer, mintedAmount, sourceDomain=6)
 *
 * The relayer here ONLY RELAYS: it submits the mint + the accounting call and
 * pays their (tiny Arbitrum) gas. It does NOT front the contribution — the
 * moved USDC is 100% the backer's own. That is the honest difference from
 * ./contribute-fill.ts (the relayer-funded fallback for empty wallets).
 *
 * SERVER-ONLY: loads the relayer key. Reached only via the createServerFn
 * handler in ../contribute.ts (completeContributionServerFn).
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  formatUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { fetchAttestation } from '#/lib/cctp/cctp'
import { EVM_CHAINS, CctpDomain } from '#/lib/cctp/addresses'
import {
  GOAL_VAULT,
  GOAL_VAULT_ABI,
  ERC20,
  loadRelayerKey,
  type FillContributionResult,
} from '#/lib/cctp/contribute-fill'

const DEFAULT_CAMPAIGN_ID = 1n

export interface CompleteContributionInput {
  /** The backer's address (their Magic email wallet / 7702 kernel — the funder). */
  backer: Address
  /** The gasless burn tx hash the backer's kernel account produced on Base Sepolia. */
  burnTxHash: Hex
  /** CCTP source domain of the burn. Defaults to Base Sepolia (6). */
  sourceDomain?: number
  /** Override the target campaign (defaults to the live campaign #1). */
  campaignId?: number
}

const isHexAddress = (a: string): a is Address => /^0x[0-9a-fA-F]{40}$/.test(a)
const isTxHash = (h: string): h is Hex => /^0x[0-9a-fA-F]{64}$/.test(h)

/**
 * Finish a backer-funded contribution given the backer's own burn tx. Throws on
 * any failure (the caller surfaces a friendly message). Safe-by-construction:
 * it refuses to credit a withdrawn/expired campaign, and attributes the EXACT
 * minted amount from the on-chain USDC Transfer(->vault) event — never a guess.
 */
export async function completeContribution(
  input: CompleteContributionInput,
): Promise<FillContributionResult> {
  if (!isHexAddress(input.backer)) throw new Error('invalid backer address')
  if (!isTxHash(input.burnTxHash)) throw new Error('invalid burn tx hash')
  const backerAddr = input.backer
  const sourceDomain = input.sourceDomain ?? CctpDomain.BASE_SEPOLIA
  const campaignId = BigInt(input.campaignId ?? Number(DEFAULT_CAMPAIGN_ID))

  const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
  const rpc = (sub: string, fallback: string) =>
    alchemy ? `https://${sub}.g.alchemy.com/v2/${alchemy}` : fallback

  const relayer = privateKeyToAccount(await loadRelayerKey())
  const arb = EVM_CHAINS.arbitrumSepolia

  const arbPublic = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc('arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc')),
  })
  const arbWallet = createWalletClient({
    account: relayer,
    chain: arbitrumSepolia,
    transport: http(rpc('arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc')),
  })

  const readCampaign = () =>
    arbPublic.readContract({
      address: GOAL_VAULT,
      abi: GOAL_VAULT_ABI,
      functionName: 'getCampaign',
      args: [campaignId],
    }) as Promise<readonly [Address, Address, bigint, bigint, bigint, boolean, number]>

  // The burn already happened (irreversible). Still verify the campaign is
  // creditable — if not, we surface it rather than mint into a dead campaign.
  const before = await readCampaign()
  const raisedBefore = before[4]
  if (before[2] === 0n) throw new Error(`campaign #${campaignId} does not exist`)
  if (before[5]) throw new Error(`campaign #${campaignId} already withdrawn`)

  // 1. Poll Circle Iris for the attestation of the BACKER's burn (measure latency).
  const tAtt = Date.now()
  const att = await fetchAttestation({
    sourceDomain: sourceDomain as any,
    transactionHash: input.burnTxHash,
  })
  const attestationLatencyMs = Date.now() - tAtt

  // 2. MINT on Arbitrum Sepolia — relayer submits receiveMessage, USDC → vault.
  const vaultBefore = (await arbPublic.readContract({
    address: arb.usdc,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [GOAL_VAULT],
  })) as bigint
  const { mintOnDestination } = await import('#/lib/cctp/cctp')
  const realMintTx = await mintOnDestination({
    walletClient: arbWallet as any,
    publicClient: arbPublic as any,
    account: relayer,
    message: att.message,
    attestation: att.attestation,
    chain: arbitrumSepolia,
  })

  // Attribute the EXACT minted amount from the USDC Transfer(->vault) event.
  const mintRcpt = await arbPublic.getTransactionReceipt({ hash: realMintTx })
  let attributed = 0n
  for (const log of mintRcpt.logs) {
    if (log.address.toLowerCase() !== arb.usdc.toLowerCase()) continue
    try {
      const p = decodeEventLog({ abi: ERC20, data: log.data, topics: log.topics })
      if (
        p.eventName === 'Transfer' &&
        ((p.args as any).to as string).toLowerCase() === GOAL_VAULT.toLowerCase()
      ) {
        attributed += (p.args as any).value as bigint
      }
    } catch {
      /* not the mint transfer — ignore */
    }
  }
  if (attributed === 0n) {
    throw new Error('could not determine minted amount: no USDC Transfer(->vault) in mint tx')
  }
  const vaultAfter = (await arbPublic.readContract({
    address: arb.usdc,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [GOAL_VAULT],
  })) as bigint
  if (vaultAfter - vaultBefore < attributed) {
    throw new Error('vault balance rose less than the mint event credited — aborting')
  }

  // 3. RECORD under the REAL backer address (raises the bar).
  const recordTx = await arbWallet.writeContract({
    address: GOAL_VAULT,
    abi: GOAL_VAULT_ABI,
    functionName: 'recordContribution',
    args: [campaignId, backerAddr, attributed, sourceDomain],
    account: relayer,
    chain: arbitrumSepolia,
  })
  await arbPublic.waitForTransactionReceipt({ hash: recordTx })

  const after = await readCampaign()
  const movedUsd = Number(formatUnits(attributed, 6))

  return {
    campaignId: campaignId.toString(),
    backer: backerAddr,
    fundedBy: 'backer',
    requestedUsd: movedUsd,
    cappedByRelayerBalance: false,
    movedUsd,
    burnTx: input.burnTxHash,
    mintTx: realMintTx,
    recordTx,
    raisedBeforeUsd: Number(formatUnits(raisedBefore, 6)),
    raisedAfterUsd: Number(formatUnits(after[4], 6)),
    attestationLatencyMs,
    sourceDomain,
    explorers: {
      burn: `${EVM_CHAINS.baseSepolia.explorer}/tx/${input.burnTxHash}`,
      mint: `${arb.explorer}/tx/${realMintTx}`,
      record: `${arb.explorer}/tx/${recordTx}`,
    },
  }
}
