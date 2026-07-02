/**
 * Rally — ZeroDev gasless layer (EIP-7702 kernel account + verifying paymaster)
 * -----------------------------------------------------------------------------
 * Turns the Magic EOA (see ./magic.ts) into a ZeroDev Kernel smart account
 * *in place* via EIP-7702, then sponsors its UserOps so the backer never holds
 * or spends gas. This is what makes "log in with email -> contribute" feel like
 * a Web2 payment. Targets the ZeroDev subtrack ($500).
 *
 * TESTNET ONLY. 7702-capable chains used: Arbitrum Sepolia (421614),
 * Base Sepolia (84532), OP Sepolia (11155420).
 *
 * Verified API (docs.zerodev.app, @zerodev/sdk 5.5.x, viem 2.5x, EntryPoint 0.7,
 * Kernel v3.3):
 *   createKernelAccount(publicClient, { eip7702Account, entryPoint, kernelVersion, eip7702Auth? })
 *   createZeroDevPaymasterClient({ chain, transport })
 *   createKernelAccountClient({ account, chain, bundlerTransport, client, paymaster, userOperation })
 *   kernelClient.sendUserOperation({ callData })  /  account.encodeCalls([...])
 *
 * ZeroDev RPC = one URL that serves BOTH bundler and paymaster:
 *   https://rpc.zerodev.app/api/v3/<PROJECT_ID>/chain/<CHAIN_ID>
 */

import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
  type KernelAccountClient,
} from '@zerodev/sdk';
import {
  KERNEL_V3_3,
  KernelVersionToAddressesMap,
  getEntryPoint,
} from '@zerodev/sdk/constants';
import {
  createPublicClient,
  encodeFunctionData,
  http,
  type Address,
  type Chain,
  type Hex,
  type WalletClient,
} from 'viem';
import {
  RALLY_CHAINS,
  type RallyChainId,
  type SignedAuthorization,
} from './magic';

const KERNEL_VERSION = KERNEL_V3_3;
const ENTRY_POINT = getEntryPoint('0.7');

// -----------------------------------------------------------------------------
// Env
// -----------------------------------------------------------------------------
function readEnv(name: string): string | undefined {
  const viteEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env as Record<string, string | undefined>)
      : undefined;
  return viteEnv?.[name] ?? (typeof process !== 'undefined' ? process.env?.[name] : undefined);
}

export const ZERODEV_PROJECT_ID = readEnv('VITE_ZERODEV_PROJECT_ID');

/**
 * The ZeroDev RPC for a chain. Same URL is used as bundlerTransport AND as the
 * paymaster transport. Requires a project that has BOTH the target chain and a
 * gas policy enabled in the ZeroDev dashboard (no policy => nothing is sponsored).
 */
export function zerodevRpcUrl(chainId: RallyChainId): string {
  if (!ZERODEV_PROJECT_ID) {
    // TODO(live-key): set VITE_ZERODEV_PROJECT_ID in .env.local
    // (dashboard.zerodev.app -> project for Arbitrum/Base/OP Sepolia -> Project ID).
    throw new Error('VITE_ZERODEV_PROJECT_ID is not set.');
  }
  return `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${chainId}`;
}

function chainFor(chainId: RallyChainId): Chain {
  const chain = Object.values(RALLY_CHAINS).find((c) => c.id === chainId);
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  return chain;
}

/**
 * The ZeroDev Kernel implementation address for the current Kernel version.
 * This is the contract the EOA delegates to in a 7702 authorization — pass it
 * to `signMagic7702Authorization({ contractAddress })` for the manual path.
 */
export function getKernelImplementationAddress(): Address {
  return KernelVersionToAddressesMap[KERNEL_VERSION].accountImplementationAddress;
}

// -----------------------------------------------------------------------------
// Kernel client (7702)
// -----------------------------------------------------------------------------
export type RallyKernelClient = KernelAccountClient;

/**
 * Build a gasless 7702 Kernel client over the Magic EOA.
 *
 * Two authorization paths:
 *  - AUTO (default): pass only `eip7702Account`; ZeroDev asks the account to
 *    sign the authorization itself. Cleanest — works IF Magic's provider answers
 *    viem's signAuthorization (eth_signAuthorization). Test this on day one.
 *  - MANUAL (fallback): pre-sign with `signMagic7702Authorization()` and pass it
 *    as `presignedAuth`. Use this if AUTO throws "method not supported". See the
 *    README footgun section.
 *
 * @param magicWallet viem WalletClient from getMagicWalletClient(chainId)
 * @param chainId     the CCTP *source* chain the backer is contributing from
 * @param presignedAuth optional manual authorization (fallback path)
 */
export async function createRallyKernelClient(params: {
  magicWallet: WalletClient;
  chainId: RallyChainId;
  presignedAuth?: SignedAuthorization;
}): Promise<RallyKernelClient> {
  const { magicWallet, chainId, presignedAuth } = params;
  const chain = chainFor(chainId);
  const rpc = zerodevRpcUrl(chainId);

  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  // The Magic wallet client's account is the 7702 signer / root validator.
  const eip7702Account = magicWallet.account;
  if (!eip7702Account) throw new Error('Magic wallet client has no account.');

  const account = await createKernelAccount(publicClient, {
    eip7702Account: eip7702Account as any,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    ...(presignedAuth ? { eip7702Auth: presignedAuth as any } : {}),
  });

  const paymaster = createZeroDevPaymasterClient({
    chain,
    transport: http(rpc),
  });

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

  return kernelClient as RallyKernelClient;
}

// -----------------------------------------------------------------------------
// Sending sponsored calls
// -----------------------------------------------------------------------------
export type Call = { to: Address; value?: bigint; data?: Hex };

/**
 * Send a batch of calls as ONE sponsored UserOp and wait for the receipt.
 * The backer signs a userOp hash (a signature prompt, not a gas payment); the
 * ZeroDev paymaster pays. Returns the userOp hash + tx hash.
 */
export async function sendSponsoredCalls(
  kernelClient: RallyKernelClient,
  calls: Call[],
): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const callData = await kernelClient.account!.encodeCalls(
    calls.map((c) => ({ to: c.to, value: c.value ?? 0n, data: c.data ?? '0x' })),
  );

  const userOpHash = await kernelClient.sendUserOperation({ callData });
  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 1000 * 60,
  });

  return { userOpHash, transactionHash: receipt.receipt.transactionHash };
}

// -----------------------------------------------------------------------------
// The Rally money-shot: a gasless CCTP contribution
// -----------------------------------------------------------------------------
// Minimal ABIs. The authoritative CCTP v2 addresses + full ABI live in the CCTP
// module (owned by the chain/CCTP engineer). We accept addresses as params to
// stay decoupled — this file only proves the *gasless send* mechanics.
const ERC20_APPROVE_ABI = [
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
] as const;

// CCTP v2 TokenMessengerV2.depositForBurn (7 args). destinationCaller and
// maxFee/minFinalityThreshold are the v2 additions vs v1.
const CCTP_V2_DEPOSIT_FOR_BURN_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [],
  },
] as const;

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

/** Left-pad a 20-byte EVM address to the bytes32 form CCTP expects. */
export function addressToBytes32(addr: Address): Hex {
  return `0x000000000000000000000000${addr.slice(2)}` as Hex;
}

/**
 * The core Rally flow: a backer's email-login wallet contributes testnet USDC
 * cross-chain, GASLESS. Batches [approve, depositForBurn] into a single
 * sponsored UserOp:
 *
 *   1. approve(tokenMessenger, amount)   — let CCTP pull the USDC
 *   2. depositForBurn(...)               — burn on source, Circle attests, mint
 *                                          into the goal-vault on the home chain
 *
 * The mintRecipient is the goal-vault contract on Arbitrum Sepolia (bytes32).
 * The organizer/off-chain relayer later polls Circle's Iris API and mints —
 * that's the CCTP module's job, not this file's.
 *
 * @returns userOp + source-chain tx hash of the burn.
 */
export async function sendGaslessCctpContribution(params: {
  kernelClient: RallyKernelClient;
  usdc: Address; // USDC on the source chain
  tokenMessenger: Address; // CCTP v2 TokenMessenger on the source chain
  amount: bigint; // in USDC base units (6 decimals)
  destinationDomain: number; // CCTP domain of the home chain (Arb Sepolia = 3)
  goalVaultOnHomeChain: Address; // the Rally vault that receives the mint
  destinationCaller?: Hex; // bytes32; default = anyone can complete
  maxFee?: bigint; // v2 fast-transfer fee cap; 0n = standard finality
  minFinalityThreshold?: number; // 1000 = fast, 2000 = standard (Circle convention)
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [params.tokenMessenger, params.amount],
  });

  const burnData = encodeFunctionData({
    abi: CCTP_V2_DEPOSIT_FOR_BURN_ABI,
    functionName: 'depositForBurn',
    args: [
      params.amount,
      params.destinationDomain,
      addressToBytes32(params.goalVaultOnHomeChain),
      params.usdc,
      params.destinationCaller ?? ZERO_BYTES32,
      params.maxFee ?? 0n,
      params.minFinalityThreshold ?? 2000,
    ],
  });

  return sendSponsoredCalls(params.kernelClient, [
    { to: params.usdc, data: approveData },
    { to: params.tokenMessenger, data: burnData },
  ]);
}
