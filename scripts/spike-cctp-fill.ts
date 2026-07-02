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
const ERC20 = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'event', name: 'Transfer', inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
  ] },
] as const;

// Never let the Alchemy API key (embedded in RPC URLs) reach logs. viem errors
// frequently echo the request URL, so scrub it defensively before printing.
function redact(input: unknown): string {
  let s = input instanceof Error ? (input.stack ?? input.message) : String(input);
  if (ALCHEMY) s = s.split(ALCHEMY).join('***REDACTED_ALCHEMY_KEY***');
  // Catch any Alchemy RPC URL / generic api-key query params even if the key differs.
  s = s.replace(/(https:\/\/[a-z0-9-]+\.g\.alchemy\.com\/v2\/)[^\s"')]+/gi, '$1***REDACTED***');
  s = s.replace(/(api[_-]?key=)[^\s"'&)]+/gi, '$1***REDACTED***');
  return s;
}

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

  // SAFETY: verify the campaign can still be credited BEFORE the irreversible
  // burn. A burn is one-way — if the campaign is already withdrawn or past its
  // deadline, the mint would land in the vault but recordContribution would
  // revert, stranding the backer's USDC cross-chain. Read on-chain state and
  // bail out now, while bailing is still free.
  {
    const c = (await arbPublic.readContract({
      address: GOAL_VAULT, abi: GOAL_VAULT_ABI, functionName: 'getCampaign', args: [campaignId],
    })) as unknown as any[];
    const deadline = c[3] as bigint;
    const withdrawn = c[5] as boolean;
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (withdrawn) {
      throw new Error(`campaign #${campaignId} already withdrawn — refusing to burn (funds would be stranded).`);
    }
    if (now >= deadline) {
      throw new Error(`campaign #${campaignId} past deadline (${deadline}, now ${now}) — refusing to burn (mint could not be credited).`);
    }
    console.log(`    campaign open (deadline ${deadline}, now ${now}) — safe to burn`);
  }

  // 1. Compute maxFee for fast transfer.
  let maxFee = 0n;
  if (TRANSFER_TYPE === 'fast') {
    try {
      const fees: any = await getBurnFee(CctpDomain.BASE_SEPOLIA, CctpDomain.ARBITRUM_SEPOLIA);
      // Circle returns a fee row PER finality threshold. Pick the FAST row
      // (finalityThreshold === 1000) explicitly — fees[0] is not guaranteed to
      // be the fast tier and could under-quote maxFee, reverting the burn.
      const rows: any[] = Array.isArray(fees) ? fees : [fees];
      const fastRow = rows.find((r) => Number(r?.finalityThreshold) === 1000);
      if (!fastRow) {
        throw new Error(`no fast-transfer (finalityThreshold=1000) fee row in ${JSON.stringify(fees)}`);
      }
      const bps = Number(fastRow.minimumFee ?? 1);
      maxFee = (AMOUNT * BigInt(Math.ceil(bps)) + 9_999n) / 10_000n;
      if (maxFee === 0n) maxFee = 1n;
      console.log(`    fast-transfer fee ~${bps} bps (finalityThreshold=1000) -> maxFee=${maxFee}`);
    } catch (e) {
      maxFee = AMOUNT / 100n; // 1% safety cap
      console.log(`    fee lookup failed (${redact(e)}); maxFee=${maxFee}`);
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

  // Attribute the EXACT amount CCTP minted to the vault in THIS tx — parsed from
  // the USDC Transfer(->vault) event in the mint receipt — NOT a balance delta.
  // A raw `vaultAfter - vaultBefore` delta silently absorbs any other USDC that
  // happens to land in the same window (a concurrent contribution, a stray
  // transfer), over-crediting this backer. The mint event is the source of truth.
  const mintRcpt = await arbPublic.getTransactionReceipt({ hash: mintTx });
  let attributed = 0n;
  for (const log of mintRcpt.logs) {
    if (log.address.toLowerCase() !== arb.usdc.toLowerCase()) continue;
    try {
      const p = decodeEventLog({ abi: ERC20, data: log.data, topics: log.topics });
      if (p.eventName === 'Transfer' && ((p.args as any).to as string).toLowerCase() === GOAL_VAULT.toLowerCase()) {
        attributed += (p.args as any).value as bigint;
      }
    } catch {}
  }
  if (attributed === 0n) {
    throw new Error('could not determine minted amount: no USDC Transfer(->vault) event in the mint tx');
  }
  const balanceDelta = vaultAfter - vaultBefore;
  // Sanity: the vault must actually hold at least what the mint event credited.
  if (balanceDelta < attributed) {
    throw new Error(`vault balance rose ${balanceDelta} but mint event credited ${attributed} — aborting attribution`);
  }
  console.log(`    mint tx: ${arb.explorer}/tx/${mintTx}`);
  console.log(`    vault USDC balance: ${formatUnits(vaultBefore, 6)} -> ${formatUnits(vaultAfter, 6)} (mint-event credited ${formatUnits(attributed, 6)}, balance delta ${formatUnits(balanceDelta, 6)})`);

  // 5. RECORD attribution (relayer credits the campaign) with the attested amount.
  console.log('\n[4] recordContribution (relayer attributes the mint)...');
  const recHash = await arbWallet.writeContract({
    address: GOAL_VAULT, abi: GOAL_VAULT_ABI, functionName: 'recordContribution',
    args: [campaignId, backer.address, attributed, CctpDomain.BASE_SEPOLIA], account: relayer, chain: arbitrumSepolia,
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
    minted: attributed.toString(), attLatencyMs, raisedBefore: raisedBefore.toString(), raisedAfter: raisedAfter.toString(),
  }, null, 2));
}

main().catch((e) => { console.error('SPIKE FAILED:', redact(e)); process.exit(1); });
