/**
 * Rally · Phase-1 spike — GASLESS EIP-7702 proof (scripted EOA + ZeroDev paymaster)
 * ---------------------------------------------------------------------------
 * Proves the core "backer never sees gas" mechanic WITHOUT any funding:
 *   - take a fresh, UNFUNDED testnet EOA (private key)
 *   - upgrade it in place to a ZeroDev Kernel v3.3 smart account via EIP-7702
 *   - send a sponsored UserOperation (a no-op self-call) — the ZeroDev
 *     paymaster pays the gas, the EOA holds 0 ETH.
 *
 * Runs on Base Sepolia (84532) AND Arbitrum Sepolia (421614) — the two chains
 * the GO/NO-GO requires. This is the same code path Magic's email EOA takes in
 * the app (getMagicWalletClient -> createRallyKernelClient); here we swap Magic's
 * signer for a scripted privateKeyToAccount so the proof is fully automated
 * (no headless email OTP). Magic is wired into the UI separately (see PR notes).
 *
 * ENV (from .env.local, auto-loaded by bun): VITE_ZERODEV_PROJECT_ID
 * KEY: ~/.rally-keys/gasless.json  (never committed)
 *
 *   bun run scripts/spike-gasless-7702.ts
 */
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from '@zerodev/sdk';
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants';
import { createPublicClient, http, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, baseSepolia } from 'viem/chains';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const KERNEL_VERSION = KERNEL_V3_3;
const ENTRY_POINT = getEntryPoint('0.7');

const PROJECT_ID = process.env.VITE_ZERODEV_PROJECT_ID;
if (!PROJECT_ID) throw new Error('VITE_ZERODEV_PROJECT_ID not set (.env.local)');

const keyFile = `${homedir()}/.rally-keys/gasless.json`;
const pk = JSON.parse(readFileSync(keyFile, 'utf8'))[0].private_key as `0x${string}`;
const signer = privateKeyToAccount(pk);

const zerodevRpc = (chainId: number) =>
  `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/${chainId}`;

async function proveOn(chain: Chain) {
  const rpc = zerodevRpc(chain.id);
  console.log(`\n=== ${chain.name} (chainId ${chain.id}) ===`);
  console.log(`signer EOA (unfunded): ${signer.address}`);

  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  const balance = await publicClient.getBalance({ address: signer.address });
  console.log(`EOA native balance: ${balance} wei (expect 0 — paymaster pays)`);

  const account = await createKernelAccount(publicClient, {
    eip7702Account: signer,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  console.log(`kernel (smart-account) address: ${account.address}`);
  console.log(
    `7702 in-place upgrade: ${
      account.address.toLowerCase() === signer.address.toLowerCase()
        ? 'YES — smart-account address == EOA address'
        : 'NO (unexpected for 7702)'
    }`,
  );

  const paymaster = createZeroDevPaymasterClient({ chain, transport: http(rpc) });
  const kernelClient = createKernelAccountClient({
    account,
    chain,
    client: publicClient,
    bundlerTransport: http(rpc),
    paymaster,
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) =>
        getUserOperationGasPrice(bundlerClient),
    },
  });

  const t0 = Date.now();
  // A no-op self-call: proves a sponsored, delegated UserOp lands on-chain.
  const callData = await account.encodeCalls([
    { to: account.address, value: 0n, data: '0x' },
  ]);
  const userOpHash = await kernelClient.sendUserOperation({ callData });
  console.log(`userOpHash: ${userOpHash}`);
  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 90_000,
  });
  const txHash = receipt.receipt.transactionHash;
  const explorer =
    chain.id === baseSepolia.id
      ? `https://sepolia.basescan.org/tx/${txHash}`
      : `https://sepolia.arbiscan.io/tx/${txHash}`;
  console.log(`SPONSORED tx: ${txHash}`);
  console.log(`explorer: ${explorer}`);
  console.log(`success: ${receipt.success}  |  latency: ${Date.now() - t0}ms`);
  return { chain: chain.name, txHash, explorer, success: receipt.success };
}

const results = [];
for (const chain of [baseSepolia, arbitrumSepolia]) {
  try {
    results.push(await proveOn(chain));
  } catch (e) {
    console.error(`FAILED on ${chain.name}:`, (e as Error).message);
    results.push({ chain: chain.name, error: (e as Error).message });
  }
}
console.log('\n=== GASLESS 7702 SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
