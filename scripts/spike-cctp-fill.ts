/**
 * Rally · Phase-1 spike — THE CAKE: one CCTP v2 cross-chain USDC fill
 * ---------------------------------------------------------------------------
 * Proves the core Rally loop end to end:
 *
 *   Base Sepolia (domain 6)                     Arbitrum Sepolia (domain 3)
 *   ┌───────────────────────┐   Circle Iris    ┌──────────────────────────┐
 *   │ backer: approve +     │   attestation    │ relayer: receiveMessage  │
 *   │ depositForBurn(USDC) ─┼─────poll─────────▶ (mint) → USDC lands in    │
 *   │  mintRecipient=Vault  │                  │ GoalVault                │
 *   └───────────────────────┘                  │ relayer: recordContrib.  │
 *                                              │  (campaign.raised += amt)│
 *                                              └──────────────────────────┘
 *
 * Then reads campaign.raised on-chain to confirm the thermometer moved.
 * Measures Iris attestation latency (informs live-demo vs pre-warm).
 *
 * Reuses the blueprint rail in src/lib/cctp. This is the automated,
 * scripted-key proof — the app drives the same burnOnSource/fetchAttestation
 * path with a Magic + ZeroDev gasless wallet client.
 *
 * ── ENV (.env.local, auto-loaded by bun) ────────────────────────────────
 *   ALCHEMY_API_KEY / VITE_ALCHEMY_API_KEY   RPC
 *   GOAL_VAULT                               deployed GoalVault (Arb Sepolia)
 * ── KEYS (~/.rally-keys, never committed) ───────────────────────────────
 *   BACKER_KEY   private key funded with Base Sepolia USDC + ETH (burns)
 *   RELAYER_KEY  private key funded with Arb Sepolia ETH (mints + records);
 *                MUST equal the vault's `relayer`. Defaults to deployer.json.
 * ── OPTIONAL ────────────────────────────────────────────────────────────
 *   CAMPAIGN_ID     use an existing campaign instead of creating one
 *   AMOUNT_USDC     default "0.5"
 *   TRANSFER_TYPE   "fast" (default) | "standard"
 *
 *   bun run scripts/spike-cctp-fill.ts
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  formatUnits,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, baseSepolia } from 'viem/chains';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

import {
  burnOnSource,
  fetchAttestation,
  mintOnDestination,
  getBurnFee,
  usdc,
} from '#/lib/cctp/cctp';
import { EVM_CHAINS, CctpDomain } from '#/lib/cctp/addresses';

// --- config -----------------------------------------------------------------
const ALCHEMY = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY;
if (!ALCHEMY) throw new Error('ALCHEMY_API_KEY not set');
if (!process.env.GOAL_VAULT) throw new Error('GOAL_VAULT (deployed vault address) not set');
const GOAL_VAULT = process.env.GOAL_VAULT as Address;

const AMOUNT = usdc(process.env.AMOUNT_USDC ?? '0.5');
const TRANSFER_TYPE = (process.env.TRANSFER_TYPE ?? 'fast') as 'fast' | 'standard';

const rpc = (sub: string) => `https://${sub}.g.alchemy.com/v2/${ALCHEMY}`;
const keyOf = (file: string) =>
  JSON.parse(readFileSync(`${homedir()}/.rally-keys/${file}`, 'utf8'))[0]
    .private_key as Hex;

const backerPk = (process.env.BACKER_KEY as Hex) ?? keyOf('backer.json');
const relayerPk = (process.env.RELAYER_KEY as Hex) ?? keyOf('deployer.json');
const backer = privateKeyToAccount(backerPk);
const relayer = privateKeyToAccount(relayerPk);

const base = EVM_CHAINS.baseSepolia; // source (domain 6)
const arb = EVM_CHAINS.arbitrumSepolia; // dest   (domain 3)

const basePublic = createPublicClient({ chain: baseSepolia, transport: http(rpc('base-sepolia')) });
const baseWallet = createWalletClient({ account: backer, chain: baseSepolia, transport: http(rpc('base-sepolia')) });
const arbPublic = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc('arb-sepolia')) });
const arbWallet = createWalletClient({ account: relayer, chain: arbitrumSepolia, transport: http(rpc('arb-sepolia')) });

const GOAL_VAULT_ABI = [
  { type: 'function', name: 'createCampaign', stateMutability: 'nonpayable',
    inputs: [{ name: 'goal', type: 'uint256' }, { name: 'deadline', type: 'uint64' }, { name: 'beneficiary', type: 'address' }],
    outputs: [{ name: 'campaignId', type: 'uint256' }] },
  { type: 'function', name: 'recordContribution', stateMutability: 'nonpayable',
    inputs: [{ name: 'campaignId', type: 'uint256' }, { name: 'backer', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'sourceDomain', type: 'uint32' }],
    outputs: [] },
  { type: 'function', name: 'getCampaign', stateMutability: 'view',
    inputs: [{ name: 'campaignId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' }, { name: 'beneficiary', type: 'address' },
      { name: 'goal', type: 'uint256' }, { name: 'deadline', type: 'uint64' },
      { name: 'raised', type: 'uint256' }, { name: 'withdrawn', type: 'bool' },
      { name: 'contributionCount', type: 'uint32' }] },
  { type: 'event', name: 'CampaignCreated',
    inputs: [
      { name: 'campaignId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'goal', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint64', indexed: false }] },
] as const;
const ERC20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;

const vaultUsdcBalance = () =>
  arbPublic.readContract({ address: arb.usdc, abi: ERC20, functionName: 'balanceOf', args: [GOAL_VAULT] }) as Promise<bigint>;
const raisedOf = async (id: bigint) => {
  const c = (await arbPublic.readContract({ address: GOAL_VAULT, abi: GOAL_VAULT_ABI, functionName: 'getCampaign', args: [id] })) as unknown as any[];
  return c[4] as bigint;
};

async function main() {
  console.log('=== Rally CCTP v2 fill spike ===');
  console.log(`backer  (Base Sepolia): ${backer.address}`);
  console.log(`relayer (Arb Sepolia):  ${relayer.address}`);
  console.log(`GoalVault:              ${GOAL_VAULT}`);
  console.log(`amount:                 ${formatUnits(AMOUNT, 6)} USDC  transfer=${TRANSFER_TYPE}`);

  // 0. Ensure a campaign exists.
  let campaignId: bigint;
  if (process.env.CAMPAIGN_ID) {
    campaignId = BigInt(process.env.CAMPAIGN_ID);
    console.log(`\n[0] Using existing campaign #${campaignId}`);
  } else {
    console.log('\n[0] Creating a campaign (relayer as creator+beneficiary)...');
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
    const goal = usdc('100');
    const hash = await arbWallet.writeContract({
      address: GOAL_VAULT, abi: GOAL_VAULT_ABI, functionName: 'createCampaign',
      args: [goal, deadline, relayer.address], account: relayer, chain: arbitrumSepolia,
    });
    const rcpt = await arbPublic.waitForTransactionReceipt({ hash });
    campaignId = 0n;
    for (const log of rcpt.logs) {
      try {
        const p = decodeEventLog({ abi: GOAL_VAULT_ABI, data: log.data, topics: log.topics });
        if (p.eventName === 'CampaignCreated') { campaignId = (p.args as any).campaignId as bigint; break; }
      } catch {}
    }
    console.log(`    campaign #${campaignId} created — ${arb.explorer}/tx/${hash}`);
  }
  const raisedBefore = await raisedOf(campaignId);
  console.log(`    raised before: ${formatUnits(raisedBefore, 6)} USDC`);

  // 1. Compute maxFee for fast transfer.
  let maxFee = 0n;
  if (TRANSFER_TYPE === 'fast') {
    try {
      const fees: any = await getBurnFee(CctpDomain.BASE_SEPOLIA, CctpDomain.ARBITRUM_SEPOLIA);
      const bps = Number(fees?.[0]?.minimumFee ?? fees?.minimumFee ?? 1);
      maxFee = (AMOUNT * BigInt(Math.ceil(bps)) + 9_999n) / 10_000n;
      if (maxFee === 0n) maxFee = 1n;
      console.log(`    fast-transfer fee ~${bps} bps -> maxFee=${maxFee}`);
    } catch (e) {
      maxFee = AMOUNT / 100n; // 1% safety cap
      console.log(`    fee lookup failed (${(e as Error).message}); maxFee=${maxFee}`);
    }
  }

  // 2. BURN on Base Sepolia.
  console.log('\n[1] BURN on Base Sepolia (approve + depositForBurn)...');
  const tBurn = Date.now();
  const burn = await burnOnSource({
    walletClient: baseWallet as any, publicClient: basePublic as any, account: backer,
    sourceChain: base, amount: AMOUNT, destinationDomain: CctpDomain.ARBITRUM_SEPOLIA,
    mintRecipient: GOAL_VAULT, transferType: TRANSFER_TYPE, maxFee, chain: baseSepolia,
  });
  console.log(`    burn tx: ${base.explorer}/tx/${burn.transactionHash}  (${Date.now() - tBurn}ms)`);

  // 3. Poll Circle Iris attestation (measure latency).
  console.log('\n[2] Poll Circle Iris attestation...');
  const tAtt = Date.now();
  const att = await fetchAttestation({
    sourceDomain: CctpDomain.BASE_SEPOLIA, transactionHash: burn.transactionHash,
    onStatus: (s) => console.log(`    iris status: ${s}  (+${((Date.now() - tAtt) / 1000).toFixed(1)}s)`),
  });
  const attLatencyMs = Date.now() - tAtt;
  console.log(`    ATTESTATION COMPLETE in ${(attLatencyMs / 1000).toFixed(1)}s (nonce ${att.eventNonce})`);

  // 4. MINT on Arbitrum Sepolia (relayer submits receiveMessage).
  console.log('\n[3] MINT on Arbitrum Sepolia (receiveMessage)...');
  const vaultBefore = await vaultUsdcBalance();
  const mintTx = await mintOnDestination({
    walletClient: arbWallet as any, publicClient: arbPublic as any, account: relayer,
    message: att.message, attestation: att.attestation, chain: arbitrumSepolia,
  });
  const vaultAfter = await vaultUsdcBalance();
  const minted = vaultAfter - vaultBefore;
  console.log(`    mint tx: ${arb.explorer}/tx/${mintTx}`);
  console.log(`    vault USDC balance: ${formatUnits(vaultBefore, 6)} -> ${formatUnits(vaultAfter, 6)} (minted ${formatUnits(minted, 6)})`);

  // 5. RECORD attribution (relayer credits the campaign).
  console.log('\n[4] recordContribution (relayer attributes the mint)...');
  const recHash = await arbWallet.writeContract({
    address: GOAL_VAULT, abi: GOAL_VAULT_ABI, functionName: 'recordContribution',
    args: [campaignId, backer.address, minted, CctpDomain.BASE_SEPOLIA], account: relayer, chain: arbitrumSepolia,
  });
  await arbPublic.waitForTransactionReceipt({ hash: recHash });
  console.log(`    record tx: ${arb.explorer}/tx/${recHash}`);

  const raisedAfter = await raisedOf(campaignId);
  console.log('\n=== RESULT ===');
  console.log(`campaign #${campaignId} raised: ${formatUnits(raisedBefore, 6)} -> ${formatUnits(raisedAfter, 6)} USDC`);
  console.log(`thermometer moved: ${raisedAfter > raisedBefore ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Iris attestation latency: ${(attLatencyMs / 1000).toFixed(1)}s  (transfer=${TRANSFER_TYPE})`);
  console.log(JSON.stringify({
    campaignId: campaignId.toString(), burnTx: burn.transactionHash, mintTx, recordTx: recHash,
    minted: minted.toString(), attLatencyMs, raisedBefore: raisedBefore.toString(), raisedAfter: raisedAfter.toString(),
  }, null, 2));
}

main().catch((e) => { console.error('SPIKE FAILED:', e); process.exit(1); });
