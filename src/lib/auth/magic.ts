/**
 * Rally — Magic embedded wallet (email login + EIP-7702)
 * -----------------------------------------------------------------------------
 * The backer's identity layer. A backer types an email, Magic mints a
 * non-custodial EOA in the browser (no seed phrase, no extension). That EOA is
 * then upgraded in-place to a smart account via EIP-7702 so ZeroDev can sponsor
 * its gas (see ./zerodev.ts).
 *
 * TESTNET ONLY. Chains: Arbitrum Sepolia (421614), Base Sepolia (84532),
 * OP Sepolia (11155420). Solana Devnet is handled outside this module (Magic +
 * ZeroDev 7702 are EVM-only).
 *
 * Verified method surface (Particle-Network/ua-7702-magic-demo, magic-sdk ^33,
 * @magic-ext/evm ^1.5):
 *   - magic.auth.loginWithEmailOTP({ email })      -> DID token
 *   - magic.user.getInfo()                         -> { publicAddress, ... }
 *   - magic.evm.switchChain(chainId)               (from @magic-ext/evm)
 *   - magic.wallet.sign7702Authorization({ contractAddress, chainId, nonce })
 *   - magic.wallet.send7702Transaction({ to, data, authorizationList })
 *   - magic.rpcProvider                            EIP-1193 provider (viem custom transport)
 */

import { Magic as MagicBase } from 'magic-sdk';
import { EVMExtension } from '@magic-ext/evm';
import {
  createWalletClient,
  custom,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type WalletClient,
} from 'viem';
import { toAccount } from 'viem/accounts';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'viem/chains';

export type Magic = MagicBase<[EVMExtension]>;

/** Chains Rally supports as CCTP *source* chains for a gasless contribution. */
export const RALLY_CHAINS = {
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
} satisfies Record<string, Chain>;

export type RallyChainId =
  | typeof arbitrumSepolia.id // 421614  (also the goal-vault / CCTP destination)
  | typeof baseSepolia.id //    84532
  | typeof optimismSepolia.id; //11155420

/** The chain the goal-vault contract lives on; CCTP mints land here. */
export const HOME_CHAIN = arbitrumSepolia;

// -----------------------------------------------------------------------------
// Env — the template uses VITE_* names. NOTE: Vite only exposes vars
// prefixed with VITE_ to the client by default. Read the README: add
// `envPrefix: ['VITE_', 'VITE_']` to vite.config.ts so the key below
// reaches the browser. We also fall back to process.env for SSR/server fns.
// -----------------------------------------------------------------------------
function readEnv(name: string): string | undefined {
  // import.meta.env (Vite client) — guarded so this file is safe on the server.
  const viteEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env as Record<string, string | undefined>)
      : undefined;
  const fromVite = viteEnv?.[name];
  const fromNode =
    typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return fromVite ?? fromNode;
}

export const MAGIC_PUBLISHABLE_KEY = readEnv('VITE_MAGIC_PUBLISHABLE_KEY');
const ALCHEMY_API_KEY = readEnv('VITE_ALCHEMY_API_KEY') ?? readEnv('ALCHEMY_API_KEY');

/**
 * RPC per chain. Prefer Alchemy if a key is present; otherwise fall back to the
 * chain's public RPC so the demo still boots without a key. For production
 * client use, front Alchemy with a VITE_ key or a server proxy.
 */
function rpcUrlFor(chain: Chain): string {
  if (ALCHEMY_API_KEY) {
    const sub: Record<number, string> = {
      [arbitrumSepolia.id]: 'arb-sepolia',
      [baseSepolia.id]: 'base-sepolia',
      [optimismSepolia.id]: 'opt-sepolia',
    };
    const s = sub[chain.id];
    if (s) return `https://${s}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  }
  return chain.rpcUrls.default.http[0];
}

// -----------------------------------------------------------------------------
// Singleton Magic client (browser-only)
// -----------------------------------------------------------------------------
let _magic: Magic | null = null;

/**
 * Get (or lazily create) the Magic client. Browser-only: returns null during
 * SSR. Configures the EVM extension with all Rally testnet chains; `default`
 * is HOME_CHAIN (Arbitrum Sepolia). Use `switchChain` before signing on a
 * different source chain.
 */
export function getMagic(): Magic | null {
  if (typeof window === 'undefined') return null;
  if (_magic) return _magic;
  if (!MAGIC_PUBLISHABLE_KEY) {
    // TODO(live-key): set VITE_MAGIC_PUBLISHABLE_KEY in .env.local
    // (dashboard.magic.link -> your app -> Publishable API Key, pk_live_...).
    console.warn('[magic] VITE_MAGIC_PUBLISHABLE_KEY is not set — login disabled.');
    return null;
  }

  _magic = new MagicBase(MAGIC_PUBLISHABLE_KEY, {
    extensions: [
      new EVMExtension(
        Object.values(RALLY_CHAINS).map((chain) => ({
          rpcUrl: rpcUrlFor(chain),
          chainId: chain.id,
          default: chain.id === HOME_CHAIN.id,
        })),
      ),
    ],
  }) as Magic;

  return _magic;
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------
export type MagicUser = {
  address: Address;
  email?: string;
  didToken: string | null;
};

/** Email OTP login. Resolves once the backer completes the code, returning their EOA. */
export async function loginWithEmail(email: string): Promise<MagicUser> {
  const magic = getMagic();
  if (!magic) throw new Error('Magic not available (missing key or SSR context).');

  const didToken = await magic.auth.loginWithEmailOTP({ email });
  const info = await magic.user.getInfo();
  // magic-sdk v33: address is nested under wallets.ethereum; older builds
  // surfaced it as a top-level `publicAddress`. Support both.
  const address = (info.wallets?.ethereum?.publicAddress ??
    (info as any).publicAddress) as Address | undefined;
  if (!address) throw new Error('Magic login returned no public address.');
  return { address, email: info.email ?? email, didToken };
}

export async function isLoggedIn(): Promise<boolean> {
  const magic = getMagic();
  if (!magic) return false;
  return magic.user.isLoggedIn();
}

export async function getMagicUser(): Promise<MagicUser | null> {
  const magic = getMagic();
  if (!magic) return null;
  if (!(await magic.user.isLoggedIn())) return null;
  const info = await magic.user.getInfo();
  const address = (info.wallets?.ethereum?.publicAddress ??
    (info as any).publicAddress) as Address | undefined;
  if (!address) return null;
  return { address, email: info.email ?? undefined, didToken: null };
}

export async function logout(): Promise<void> {
  const magic = getMagic();
  if (!magic) return;
  await magic.user.logout();
}

// -----------------------------------------------------------------------------
// viem interop — the Magic EOA as a viem *LocalAccount*
// -----------------------------------------------------------------------------
/**
 * Normalise whatever `magic.wallet.sign7702Authorization` returns ({ r, s, v })
 * into the tuple viem/ZeroDev expect for a signed EIP-7702 authorization.
 * EIP-7702 authorities recover from (r, s, yParity), so we derive yParity from
 * Magic's v (27/28 -> 0/1, or a raw 0/1 passed through).
 */
function normalizeMagicAuthorization(
  raw: { r: Hex; s: Hex; v?: bigint | number; yParity?: number },
  tuple: { address: Address; chainId: number; nonce: number },
): SignedAuthorization {
  let yParity: number;
  if (raw.yParity !== undefined) {
    yParity = Number(raw.yParity);
  } else {
    const vNum = typeof raw.v === 'bigint' ? Number(raw.v) : Number(raw.v ?? 27);
    yParity = vNum >= 27 ? vNum - 27 : vNum;
  }
  return {
    address: tuple.address,
    chainId: tuple.chainId,
    nonce: tuple.nonce,
    r: raw.r,
    s: raw.s,
    yParity,
    v: BigInt(yParity + 27),
  };
}

/**
 * The CRUX of the Magic -> ZeroDev 7702 fix.
 *
 * Magic's `rpcProvider` is a plain EIP-1193 provider, so a viem WalletClient
 * built over it produces a *json-rpc account* (`{ address, type: 'json-rpc' }`)
 * — which has neither `signMessage`-as-a-method nor, crucially, a
 * `signAuthorization`. When ZeroDev's `createKernelAccount({ eip7702Account })`
 * ran `toSigner()` over that bare json-rpc account it dereferenced
 * `walletClient.account.address` on a value that had no `.account`, throwing
 * `Cannot read properties of undefined (reading 'address')`. And even past that,
 * viem's `signAuthorization` action *explicitly rejects* json-rpc accounts
 * (`AccountTypeNotSupportedError`) — a raw provider simply cannot sign a raw
 * secp256k1 EIP-7702 authorization tuple.
 *
 * The fix is to hand ZeroDev a real viem `LocalAccount` (`type: 'local'`, which
 * `toSigner` returns as-is) whose three signers are wired to Magic:
 *   - signMessage / signTypedData  -> the Magic provider (personal_sign /
 *     eth_signTypedData_v4) — this is what signs the ERC-4337 userOp hash and
 *     the EIP-712 circle invites.
 *   - signAuthorization            -> Magic's *native* 7702 RPC,
 *     `magic.wallet.sign7702Authorization`, which is the only way an embedded
 *     Magic key can produce a 7702 authorization (verified against Magic's
 *     Particle `ua-7702-magic-demo`). ZeroDev/viem compute the correct
 *     sponsored-path nonce (`getTransactionCount(pending)`, NO +1 because the
 *     bundler — not the EOA — sends the type-4 tx) and pass it here.
 */
export function magicLocalAccount(params: {
  magic: Magic;
  chain: Chain;
  address: Address;
}): LocalAccount {
  const { magic, chain, address } = params;

  // Inner json-rpc walletClient purely to reuse viem's message/typed-data
  // encoding over the Magic provider (personal_sign / eth_signTypedData_v4).
  const rpcWallet = createWalletClient({
    account: address,
    chain,
    transport: custom(magic.rpcProvider as any),
  });

  return toAccount({
    address,
    async signMessage({ message }) {
      return rpcWallet.signMessage({ message });
    },
    async signTypedData(typedData) {
      return rpcWallet.signTypedData(typedData as any);
    },
    async signTransaction() {
      // 7702 smart accounts never sign raw transactions themselves.
      throw new Error('Magic 7702 signer does not sign raw transactions.');
    },
    async signAuthorization(authorization) {
      // viem/ZeroDev hand us { address (delegate impl), chainId, nonce }.
      const contractAddress = authorization.address as Address;
      const chainId = Number(authorization.chainId ?? chain.id);
      const nonce = Number(authorization.nonce);
      const wallet = (magic as any).wallet;
      if (!wallet || typeof wallet.sign7702Authorization !== 'function') {
        throw new Error(
          'This email wallet cannot sign an EIP-7702 authorization ' +
            '(magic.wallet.sign7702Authorization unavailable). Update magic-sdk ' +
            'or delegate this wallet to the ZeroDev kernel once before going gasless.',
        );
      }
      // Magic cannot sign a chainId==0 (chain-agnostic) authorization — always
      // a concrete chainId (matches the connected chain).
      const raw = await wallet.sign7702Authorization({
        contractAddress,
        chainId,
        nonce,
      });
      return normalizeMagicAuthorization(raw, {
        address: contractAddress,
        chainId,
        nonce,
      }) as any;
    },
  });
}

/**
 * A viem WalletClient backed by Magic, bound to `chainId`, whose `.account` is a
 * real `LocalAccount` (see `magicLocalAccount`) — NOT a bare json-rpc account.
 * This is what we hand to ZeroDev as the 7702 signer: `.account` signs the userOp
 * hash AND the 7702 authorization. The account address == the Magic EOA == the
 * resulting smart-account address (the whole point of 7702).
 */
export async function getMagicWalletClient(
  chainId: RallyChainId,
): Promise<WalletClient> {
  const magic = getMagic();
  if (!magic) throw new Error('Magic not available.');
  const chain = Object.values(RALLY_CHAINS).find((c) => c.id === chainId);
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);

  await magic.evm.switchChain(chainId);

  const [address] = await (magic.rpcProvider as any).request({
    method: 'eth_accounts',
  });

  const account = magicLocalAccount({ magic, chain, address: address as Address });

  return createWalletClient({
    account,
    chain,
    transport: custom(magic.rpcProvider as any),
  });
}

export async function switchChain(chainId: RallyChainId): Promise<void> {
  const magic = getMagic();
  if (!magic) throw new Error('Magic not available.');
  await magic.evm.switchChain(chainId);
}

// -----------------------------------------------------------------------------
// EIP-7702 helpers (the FALLBACK path)
// -----------------------------------------------------------------------------
/**
 * A signed EIP-7702 authorization in the shape viem / ZeroDev expect for
 * `eip7702Auth`. Magic returns { r, s, v, ... }; ZeroDev/viem want yParity.
 */
export type SignedAuthorization = {
  address: Address; // the delegate target (ZeroDev Kernel implementation)
  chainId: number;
  nonce: number;
  r: Hex;
  s: Hex;
  yParity: number;
  v?: bigint;
};

/**
 * Ask Magic to sign a chain-specific EIP-7702 authorization delegating the EOA
 * to `contractAddress` (the ZeroDev Kernel implementation — resolve it with
 * `getKernelImplementationAddress()` from ./zerodev.ts).
 *
 * FOOTGUN (verified in the Particle demo): Magic CANNOT sign a chainId==0
 * (chain-agnostic) authorization. Always pass a concrete chainId. The nonce
 * must be the EOA's *current* transaction nonce for a self-delegation, or
 * exactly what the caller (ZeroDev) hands you — an off-by-one here type-checks
 * fine and then reverts on-chain. Read the README before touching this.
 */
export async function signMagic7702Authorization(params: {
  contractAddress: Address;
  chainId: RallyChainId;
  nonce: number;
}): Promise<SignedAuthorization> {
  const magic = getMagic();
  if (!magic) throw new Error('Magic not available.');

  await magic.evm.switchChain(params.chainId);

  const auth: any = await (magic as any).wallet.sign7702Authorization({
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    nonce: params.nonce,
  });

  return normalizeMagicAuthorization(auth, {
    address: (auth.address ?? params.contractAddress) as Address,
    chainId: params.chainId,
    nonce: params.nonce,
  });
}

/**
 * Raw Type-4 (7702) send THROUGH Magic — no ZeroDev, so the backer pays gas.
 * Only used as an escape hatch to prove delegation on-chain if the ZeroDev path
 * is misbehaving. The real contribution flow goes through ./zerodev.ts (gasless).
 */
export async function sendMagic7702Transaction(params: {
  to: Address;
  data?: Hex;
  authorizationList: unknown[];
}): Promise<{ transactionHash: Hex }> {
  const magic = getMagic();
  if (!magic) throw new Error('Magic not available.');
  const res: any = await (magic as any).wallet.send7702Transaction({
    to: params.to,
    data: params.data ?? '0x',
    authorizationList: params.authorizationList,
  });
  return { transactionHash: (res?.transactionHash ?? res) as Hex };
}
