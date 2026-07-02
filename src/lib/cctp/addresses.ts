/**
 * Rally · Circle CCTP v2 — TESTNET address book & protocol constants
 * ---------------------------------------------------------------------------
 * ALL addresses below are CCTP **v2** on **TESTNET only** and were transcribed
 * verbatim from Circle's official docs on 2026-07-02. Each block cites its
 * source URL. Do NOT swap in mainnet addresses — Rally is testnet-only ($0).
 *
 * Verification status per item is noted inline:
 *   VERIFIED         = copied from Circle's official docs table.
 *   NEEDS-LIVE-TEST  = correct per docs, but must be exercised on-chain before
 *                      being trusted in the live demo (e.g. Solana Devnet).
 *
 * Sources:
 *  - EVM contracts (V2, testnet):  https://developers.circle.com/cctp/evm-smart-contracts
 *  - USDC token addresses:         https://developers.circle.com/stablecoins/usdc-contract-addresses
 *  - Domains:                      https://developers.circle.com/cctp/concepts/supported-chains-and-domains
 *  - Solana programs (V2):         https://developers.circle.com/cctp/references/solana-programs
 *  - Contract interfaces:          https://developers.circle.com/cctp/references/contract-interfaces
 *  - Finality / latency:           https://developers.circle.com/cctp/required-block-confirmations
 *  - Attestation API (Iris v2):    https://developers.circle.com/cctp/technical-guide
 *                                  https://developers.circle.com/api-reference/cctp/all/get-messages-v2
 */

import type { Address } from "viem";

// ---------------------------------------------------------------------------
// 1. CCTP domain IDs (chain-agnostic identifiers used by the protocol)
//    VERIFIED — https://developers.circle.com/cctp/concepts/supported-chains-and-domains
//    NOTE: a CCTP "domain" is NOT an EVM chainId. depositForBurn takes the
//    destination *domain*, not chainId.
// ---------------------------------------------------------------------------
export const CctpDomain = {
  ETHEREUM_SEPOLIA: 0,
  AVALANCHE_FUJI: 1,
  OP_SEPOLIA: 2,
  ARBITRUM_SEPOLIA: 3,
  SOLANA_DEVNET: 5,
  BASE_SEPOLIA: 6,
} as const;

export type CctpDomainId = (typeof CctpDomain)[keyof typeof CctpDomain];

// ---------------------------------------------------------------------------
// 2. CCTP v2 TESTNET contract addresses.
//    KEY FACT (VERIFIED): in CCTP v2 the contract addresses are UNIFIED —
//    the SAME address is used on EVERY supported EVM testnet chain
//    (Arbitrum Sepolia, Base Sepolia, OP Sepolia, Ethereum Sepolia, Fuji, ...).
//    Source: https://developers.circle.com/cctp/evm-smart-contracts (Testnet section)
//
//    ⚠️ Do not confuse with CCTP **v1** testnet addresses
//    (e.g. TokenMessenger 0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5). Those
//    are a different protocol version and are NOT used here.
// ---------------------------------------------------------------------------
export const CCTP_V2_TESTNET = {
  /** Entry point: approve + depositForBurn / depositForBurnWithHook. VERIFIED */
  TokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
  /** Destination: receiveMessage(message, attestation). VERIFIED */
  MessageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address,
  /** Mints/burns USDC; holds per-chain token settings. VERIFIED */
  TokenMinterV2: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192" as Address,
  /** Message helper lib (addressToBytes32 etc.). VERIFIED */
  MessageV2: "0xbaC0179bB358A8936169a63408C8481D582390C4" as Address,
} as const;

// ---------------------------------------------------------------------------
// 3. Per-chain config for the chains Rally actually uses in the demo fill.
//    { EVM chainId, CCTP domain, testnet USDC token, human name, explorer }
//    All VERIFIED from Circle docs unless noted.
// ---------------------------------------------------------------------------
export interface CctpEvmChain {
  key: EvmChainKey;
  name: string;
  chainId: number; // EVM chainId (for wallet / RPC)
  domain: CctpDomainId; // CCTP domain (for depositForBurn)
  usdc: Address; // testnet USDC token contract
  explorer: string; // block explorer base
}

export type EvmChainKey =
  | "arbitrumSepolia"
  | "baseSepolia"
  | "opSepolia"
  | "ethereumSepolia";

export const EVM_CHAINS: Record<EvmChainKey, CctpEvmChain> = {
  // Arbitrum Sepolia — Rally's home chain (GoalVault lives here). VERIFIED
  arbitrumSepolia: {
    key: "arbitrumSepolia",
    name: "Arbitrum Sepolia",
    chainId: 421614,
    domain: CctpDomain.ARBITRUM_SEPOLIA, // 3
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address,
    explorer: "https://sepolia.arbiscan.io",
  },
  // Base Sepolia. VERIFIED
  baseSepolia: {
    key: "baseSepolia",
    name: "Base Sepolia",
    chainId: 84532,
    domain: CctpDomain.BASE_SEPOLIA, // 6
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
    explorer: "https://sepolia.basescan.org",
  },
  // OP Sepolia. VERIFIED
  opSepolia: {
    key: "opSepolia",
    name: "OP Sepolia",
    chainId: 11155420,
    domain: CctpDomain.OP_SEPOLIA, // 2
    usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" as Address,
    explorer: "https://sepolia-optimism.etherscan.io",
  },
  // Ethereum Sepolia — included for completeness (faucet source). VERIFIED
  ethereumSepolia: {
    key: "ethereumSepolia",
    name: "Ethereum Sepolia",
    chainId: 11155111,
    domain: CctpDomain.ETHEREUM_SEPOLIA, // 0
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address,
    explorer: "https://sepolia.etherscan.io",
  },
} as const;

/** The chain Rally consolidates every contribution into. */
export const GOAL_VAULT_CHAIN = EVM_CHAINS.arbitrumSepolia;

// ---------------------------------------------------------------------------
// 4. Solana Devnet (domain 5) — OPTIONAL "ambitious" leg (EVM↔Solana wow).
//    NEEDS-LIVE-TEST. The docs table and the on-chain IDL links appear to
//    disagree on which program id is MessageTransmitter vs TokenMessengerMinter
//    (the anchor-program IDL links are swapped relative to the table). Confirm
//    against a block explorer before wiring Solana into the live demo.
//    Source: https://developers.circle.com/cctp/references/solana-programs
// ---------------------------------------------------------------------------
export const SOLANA_DEVNET = {
  domain: CctpDomain.SOLANA_DEVNET, // 5. VERIFIED
  // USDC (SPL) on Solana Devnet. VERIFIED (usdc-contract-addresses table)
  usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  // Program ids per docs TABLE (NEEDS-LIVE-TEST — see note above):
  MessageTransmitterV2: "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
  TokenMessengerMinterV2: "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
  explorer: "https://explorer.solana.com",
  cluster: "devnet",
} as const;

// ---------------------------------------------------------------------------
// 5. Circle Iris attestation API (v2). VERIFIED
//    Poll: GET {base}/v2/messages/{sourceDomainId}?transactionHash={txHash}
//    Source: https://developers.circle.com/cctp/technical-guide
//            https://developers.circle.com/api-reference/cctp/all/get-messages-v2
// ---------------------------------------------------------------------------
export const IRIS_API = {
  testnet: "https://iris-api-sandbox.circle.com", // VERIFIED
  mainnet: "https://iris-api.circle.com", // (unused — testnet only)
} as const;

/** Rally always uses the testnet Iris host. */
export const IRIS_BASE_URL = IRIS_API.testnet;

// ---------------------------------------------------------------------------
// 6. Finality thresholds. VERIFIED — https://developers.circle.com/cctp/technical-guide
//    depositForBurn's `minFinalityThreshold`:
//      ≤ 1000  -> Fast Transfer  (attested at "confirmed", seconds)
//      = 2000  -> Standard Transfer (attested at "finalized", minutes on L2s)
// ---------------------------------------------------------------------------
export const FINALITY_THRESHOLD = {
  CONFIRMED: 1000, // Fast
  FINALIZED: 2000, // Standard
} as const;

export type TransferType = "fast" | "standard";

export function finalityThresholdFor(type: TransferType): number {
  return type === "fast"
    ? FINALITY_THRESHOLD.CONFIRMED
    : FINALITY_THRESHOLD.FINALIZED;
}

// ---------------------------------------------------------------------------
// 7. Expected attestation latency (source-chain dependent). VERIFIED (mainnet
//    averages from Circle; testnet is the same order of magnitude, sometimes
//    slower). Used for UI copy / demo expectations, NOT for logic.
//    Source: https://developers.circle.com/cctp/required-block-confirmations
// ---------------------------------------------------------------------------
export const ATTESTATION_LATENCY: Record<
  CctpDomainId,
  { fastSeconds: number; standardSeconds: number }
> = {
  [CctpDomain.ETHEREUM_SEPOLIA]: { fastSeconds: 20, standardSeconds: 17 * 60 },
  [CctpDomain.AVALANCHE_FUJI]: { fastSeconds: 8, standardSeconds: 8 },
  [CctpDomain.OP_SEPOLIA]: { fastSeconds: 8, standardSeconds: 17 * 60 },
  [CctpDomain.ARBITRUM_SEPOLIA]: { fastSeconds: 8, standardSeconds: 17 * 60 },
  [CctpDomain.SOLANA_DEVNET]: { fastSeconds: 8, standardSeconds: 25 },
  [CctpDomain.BASE_SEPOLIA]: { fastSeconds: 8, standardSeconds: 17 * 60 },
};

// ---------------------------------------------------------------------------
// 8. Circle USDC testnet faucet. VERIFIED
//    Human/UI faucet:  https://faucet.circle.com  (ARB/BASE/OP/ETH-SEPOLIA,
//                      AVAX-FUJI, SOL-DEVNET). Also dispenses native gas.
//    NOTE: there is no public documented programmatic faucet API key flow for
//    the public testnet faucet — treat faucet top-ups as a manual/UI step.
//    NEEDS-LIVE-TEST if a scripted faucet is ever required.
// ---------------------------------------------------------------------------
export const FAUCET_URL = "https://faucet.circle.com";

// ---------------------------------------------------------------------------
// 9. Minimal ABIs (viem) for the calls Rally makes. VERIFIED against
//    https://developers.circle.com/cctp/references/contract-interfaces
// ---------------------------------------------------------------------------

/** ERC-20 subset for USDC approve/allowance/balance. */
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** TokenMessengerV2 — burn side. VERIFIED signatures. */
export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "DepositForBurn",
    inputs: [
      { name: "nonce", type: "uint64", indexed: true },
      { name: "burnToken", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "depositor", type: "address", indexed: true },
      { name: "mintRecipient", type: "bytes32", indexed: false },
      { name: "destinationDomain", type: "uint32", indexed: false },
      { name: "destinationTokenMessenger", type: "bytes32", indexed: false },
      { name: "destinationCaller", type: "bytes32", indexed: false },
      { name: "maxFee", type: "uint256", indexed: false },
      { name: "minFinalityThreshold", type: "uint32", indexed: false },
    ],
  },
] as const;

/** MessageTransmitterV2 — mint side + MessageSent event. VERIFIED signatures. */
export const MESSAGE_TRANSMITTER_V2_ABI = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    type: "event",
    name: "MessageSent",
    inputs: [{ name: "message", type: "bytes", indexed: false }],
  },
] as const;
