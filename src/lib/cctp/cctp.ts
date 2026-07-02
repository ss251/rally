/**
 * Rally · Circle CCTP v2 rail — typed functions
 * ---------------------------------------------------------------------------
 * The three-step v2 flow, wrapped for Rally:
 *
 *   1. burnOnSource()        approve USDC -> depositForBurn(WithHook) on the
 *                            backer's source chain. Returns the burn txHash.
 *   2. fetchAttestation()    poll Circle's Iris v2 API by (sourceDomain, txHash)
 *                            until Circle signs the message. Returns { message,
 *                            attestation }. FULLY IMPLEMENTED (plain fetch).
 *   3. mintOnDestination()   MessageTransmitterV2.receiveMessage(message,
 *                            attestation) on Arbitrum Sepolia -> USDC lands at
 *                            mintRecipient (the GoalVault).
 *
 * DEPENDENCY: this module is written against `viem`. Rally does not yet list
 * viem in package.json — run `bun add viem` before importing the on-chain
 * helpers. `fetchAttestation` needs no dependency (uses global fetch).
 *
 * GASLESS 7702: burnOnSource / mintOnDestination accept a viem-compatible
 * WalletClient. To make them gasless via ZeroDev (the $500 subtrack) or Magic,
 * pass a smart-account/kernel client whose `.writeContract` routes through the
 * bundler+paymaster. The address-book + call shapes here are unchanged by that
 * choice; only the client differs. Those integration seams are marked TODO.
 *
 * Sources for every constant/signature used here are cited in ./addresses.ts.
 */

import type {
  Address,
  Hex,
  PublicClient,
  WalletClient,
  Account,
  Chain,
} from "viem";
// `pad`, `getAddress`, `decodeEventLog` etc. come from viem at runtime.
import { pad, decodeEventLog } from "viem";

import {
  CCTP_V2_TESTNET,
  ERC20_ABI,
  IRIS_BASE_URL,
  MESSAGE_TRANSMITTER_V2_ABI,
  TOKEN_MESSENGER_V2_ABI,
  finalityThresholdFor,
  type CctpDomainId,
  type CctpEvmChain,
  type TransferType,
} from "./addresses";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Left-pad a 20-byte EVM address to the bytes32 CCTP expects for mintRecipient. */
export function addressToBytes32(addr: Address): Hex {
  return pad(addr, { size: 32 });
}

/** bytes32(0) — "any address may call receiveMessage on the destination". */
export const ANY_DESTINATION_CALLER: Hex = `0x${"0".repeat(64)}`;

/** USDC has 6 decimals on every CCTP chain. Convert a human amount -> base units. */
export function usdc(amountHuman: number | string): bigint {
  const [whole, frac = ""] = String(amountHuman).split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}

// ---------------------------------------------------------------------------
// STEP 1 — burnOnSource
// ---------------------------------------------------------------------------

export interface BurnParams {
  /** viem clients for the SOURCE chain. */
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Account | Address;
  /** Which chain the backer is burning from. */
  sourceChain: CctpEvmChain;
  /** Amount in USDC base units (6 dp). Use `usdc(1.5)` for 1.5 USDC. */
  amount: bigint;
  /** CCTP domain of the destination (Rally: Arbitrum Sepolia = 3). */
  destinationDomain: CctpDomainId;
  /** Who receives the mint on the destination — the GoalVault address. */
  mintRecipient: Address;
  /** "fast" (confirmed, ~seconds, small fee) or "standard" (finalized, minutes). */
  transferType: TransferType;
  /**
   * Max fee (base units) you'll pay for the transfer. For a Fast Transfer this
   * MUST cover Circle's fast-burn fee or the burn reverts. See getBurnFee().
   * For Standard Transfer this can be 0n on testnet.
   */
  maxFee: bigint;
  /**
   * Optional CCTP v2 hook payload (depositForBurnWithHook). Rally can encode
   * {campaignId, backer, sourceDomain} here so the GoalVault credits the right
   * campaign/backer atomically on mint. If omitted, plain depositForBurn.
   */
  hookData?: Hex;
  /** viem Chain object for the source chain (for the write). */
  chain?: Chain;
}

export interface BurnResult {
  /** The burn transaction hash — the key you feed to fetchAttestation(). */
  transactionHash: Hex;
  /** Source CCTP domain (needed by the Iris query path). */
  sourceDomain: CctpDomainId;
  /** Raw MessageSent bytes, parsed from logs when available (else null). */
  messageBytes: Hex | null;
}

/**
 * Approve USDC to TokenMessengerV2, then depositForBurn / depositForBurnWithHook.
 *
 * IMPLEMENTED against viem. The gasless (ZeroDev/Magic 7702) path is a
 * drop-in: pass a smart-account WalletClient and the same calls sponsor.
 */
export async function burnOnSource(params: BurnParams): Promise<BurnResult> {
  const {
    walletClient,
    publicClient,
    account,
    sourceChain,
    amount,
    destinationDomain,
    mintRecipient,
    transferType,
    maxFee,
    hookData,
    chain,
  } = params;

  const owner = typeof account === "string" ? account : account.address;
  const mintRecipient32 = addressToBytes32(mintRecipient);
  const minFinalityThreshold = finalityThresholdFor(transferType);

  // 1a. Ensure USDC allowance for TokenMessengerV2.
  const current = (await publicClient.readContract({
    address: sourceChain.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, CCTP_V2_TESTNET.TokenMessengerV2],
  })) as bigint;

  if (current < amount) {
    const approveHash = await walletClient.writeContract({
      address: sourceChain.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CCTP_V2_TESTNET.TokenMessengerV2, amount],
      account,
      chain,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  // 1b. Burn.
  const burnHash = hookData
    ? await walletClient.writeContract({
        address: CCTP_V2_TESTNET.TokenMessengerV2,
        abi: TOKEN_MESSENGER_V2_ABI,
        functionName: "depositForBurnWithHook",
        args: [
          amount,
          destinationDomain,
          mintRecipient32,
          sourceChain.usdc,
          ANY_DESTINATION_CALLER,
          maxFee,
          minFinalityThreshold,
          hookData,
        ],
        account,
        chain,
      } as any)
    : await walletClient.writeContract({
        address: CCTP_V2_TESTNET.TokenMessengerV2,
        abi: TOKEN_MESSENGER_V2_ABI,
        functionName: "depositForBurn",
        args: [
          amount,
          destinationDomain,
          mintRecipient32,
          sourceChain.usdc,
          ANY_DESTINATION_CALLER,
          maxFee,
          minFinalityThreshold,
        ],
        account,
        chain,
      } as any);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: burnHash,
  });

  // 1c. Best-effort: pull the MessageSent bytes from logs. Not strictly needed
  //     for v2 (Iris resolves by txHash) but handy for logging/debugging.
  let messageBytes: Hex | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: MESSAGE_TRANSMITTER_V2_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (parsed.eventName === "MessageSent") {
        messageBytes = (parsed.args as { message: Hex }).message;
        break;
      }
    } catch {
      /* not a MessageSent log — ignore */
    }
  }

  return {
    transactionHash: burnHash,
    sourceDomain: sourceChain.domain,
    messageBytes,
  };
}

// ---------------------------------------------------------------------------
// STEP 2 — fetchAttestation  (FULLY IMPLEMENTED — no chain, no keys)
// ---------------------------------------------------------------------------

/** One message+attestation entry returned by Iris v2. */
export interface IrisMessage {
  status: "pending_confirmations" | "complete";
  message: Hex; // raw bytes to feed to receiveMessage
  attestation: Hex | "PENDING"; // Circle's signature, or the literal "PENDING"
  eventNonce: string;
  decodedMessage?: Record<string, unknown>;
  cctpVersion?: number;
}

export interface AttestationResult {
  message: Hex;
  attestation: Hex;
  eventNonce: string;
}

export interface FetchAttestationOptions {
  sourceDomain: CctpDomainId;
  transactionHash: Hex;
  /** Poll cadence (ms). Default 4s. */
  pollIntervalMs?: number;
  /** Give up after this many ms. Default 20 min (covers Standard finality). */
  timeoutMs?: number;
  /** Override the Iris host (defaults to testnet sandbox). */
  baseUrl?: string;
  /** Optional callback fired on each poll with the latest status. */
  onStatus?: (status: IrisMessage["status"]) => void;
}

/**
 * Poll GET {base}/v2/messages/{sourceDomainId}?transactionHash={txHash} until
 * the first message reaches status "complete", then return its message +
 * attestation. Throws on timeout.
 *
 * VERIFIED endpoint shape:
 *   https://iris-api-sandbox.circle.com/v2/messages/{sourceDomainId}?transactionHash=0x...
 *   -> { messages: [{ status, message, attestation, eventNonce, decodedMessage }] }
 * (https://developers.circle.com/api-reference/cctp/all/get-messages-v2)
 */
export async function fetchAttestation(
  opts: FetchAttestationOptions,
): Promise<AttestationResult> {
  const {
    sourceDomain,
    transactionHash,
    pollIntervalMs = 4_000,
    timeoutMs = 20 * 60_000,
    baseUrl = IRIS_BASE_URL,
    onStatus,
  } = opts;

  const url = `${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(url, { headers: { accept: "application/json" } });

    // 404 = Circle hasn't indexed the burn yet; keep polling.
    if (res.status !== 404 && res.ok) {
      const body = (await res.json()) as { messages?: IrisMessage[] };
      const msg = body.messages?.[0];
      if (msg) {
        onStatus?.(msg.status);
        if (msg.status === "complete" && msg.attestation && msg.attestation !== "PENDING") {
          return {
            message: msg.message,
            attestation: msg.attestation,
            eventNonce: msg.eventNonce,
          };
        }
      }
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(
    `CCTP attestation timed out after ${timeoutMs}ms for tx ${transactionHash} (domain ${sourceDomain}). ` +
      `Standard transfers on L2s can take ~15-19 min; consider a Fast transfer for the live demo.`,
  );
}

// ---------------------------------------------------------------------------
// STEP 3 — mintOnDestination
// ---------------------------------------------------------------------------

export interface MintParams {
  /** viem clients for the DESTINATION chain (Rally: Arbitrum Sepolia). */
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Account | Address;
  message: Hex;
  attestation: Hex;
  chain?: Chain;
}

/**
 * Call MessageTransmitterV2.receiveMessage(message, attestation) on the
 * destination chain. This mints USDC to the mintRecipient set at burn time
 * (the GoalVault). Anyone can submit this tx — Rally will run it from a relayer
 * so backers never touch the destination chain.
 *
 * IMPLEMENTED against viem. Gasless path = pass a sponsored WalletClient.
 *
 * NEEDS-LIVE-TEST: confirm end-to-end on Arbitrum Sepolia once viem is
 * installed and a funded/sponsored signer is available.
 */
export async function mintOnDestination(params: MintParams): Promise<Hex> {
  const { walletClient, publicClient, account, message, attestation, chain } =
    params;

  const hash = await walletClient.writeContract({
    address: CCTP_V2_TESTNET.MessageTransmitterV2,
    abi: MESSAGE_TRANSMITTER_V2_ABI,
    functionName: "receiveMessage",
    args: [message, attestation],
    account,
    chain,
  } as any);

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// ---------------------------------------------------------------------------
// Optional: fee lookup for Fast Transfers.
// ---------------------------------------------------------------------------

/**
 * GET {base}/v2/burn/USDC/fees/{srcDomain}/{dstDomain} — returns the current
 * fee schedule so you can pick a safe `maxFee` for a Fast Transfer. Shape:
 *   { finalityThreshold, minimumFee (bps), ... } per Circle's fee reference.
 *
 * TODO (NEEDS-LIVE-TEST): confirm the exact response field names against a live
 * sandbox response, then compute maxFee = ceil(amount * feeBps / 10_000).
 * Source: https://developers.circle.com/api-reference/cctp/all/get-burn-usdc-fees
 */
export async function getBurnFee(
  sourceDomain: CctpDomainId,
  destinationDomain: CctpDomainId,
  baseUrl: string = IRIS_BASE_URL,
): Promise<unknown> {
  const url = `${baseUrl}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`getBurnFee failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Convenience: the whole Rally contribution in one call.
// ---------------------------------------------------------------------------

export interface ContributeParams {
  source: {
    walletClient: WalletClient;
    publicClient: PublicClient;
    account: Account | Address;
    chain?: Chain;
  };
  destination: {
    walletClient: WalletClient;
    publicClient: PublicClient;
    account: Account | Address;
    chain?: Chain;
  };
  sourceChain: CctpEvmChain;
  destinationDomain: CctpDomainId;
  goalVault: Address;
  amount: bigint;
  transferType?: TransferType;
  maxFee?: bigint;
  hookData?: Hex;
  onStatus?: (phase: "burning" | "attesting" | "minting" | "done") => void;
}

/**
 * burn -> attest -> mint, end to end. Returns both tx hashes.
 * For the LIVE demo, run burn on the backer's chain and mint from the Rally
 * relayer on Arbitrum Sepolia. Prefer transferType "fast" so the thermometer
 * moves in seconds rather than ~15 min.
 */
export async function contribute(p: ContributeParams): Promise<{
  burnTx: Hex;
  mintTx: Hex;
  eventNonce: string;
}> {
  const transferType = p.transferType ?? "fast";

  p.onStatus?.("burning");
  const burn = await burnOnSource({
    walletClient: p.source.walletClient,
    publicClient: p.source.publicClient,
    account: p.source.account,
    sourceChain: p.sourceChain,
    amount: p.amount,
    destinationDomain: p.destinationDomain,
    mintRecipient: p.goalVault,
    transferType,
    maxFee: p.maxFee ?? 0n,
    hookData: p.hookData,
    chain: p.source.chain,
  });

  p.onStatus?.("attesting");
  const att = await fetchAttestation({
    sourceDomain: burn.sourceDomain,
    transactionHash: burn.transactionHash,
  });

  p.onStatus?.("minting");
  const mintTx = await mintOnDestination({
    walletClient: p.destination.walletClient,
    publicClient: p.destination.publicClient,
    account: p.destination.account,
    message: att.message,
    attestation: att.attestation,
    chain: p.destination.chain,
  });

  p.onStatus?.("done");
  return { burnTx: burn.transactionHash, mintTx, eventNonce: att.eventNonce };
}
