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
  type WalletClient,
} from 'viem';
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
// Env — the template uses NEXT_PUBLIC_* names. NOTE: Vite only exposes vars
// prefixed with VITE_ to the client by default. Read the README: add
// `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` to vite.config.ts so the key below
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

export const MAGIC_PUBLISHABLE_KEY = readEnv('NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY');
const ALCHEMY_API_KEY = readEnv('NEXT_PUBLIC_ALCHEMY_API_KEY') ?? readEnv('ALCHEMY_API_KEY');

/**
 * RPC per chain. Prefer Alchemy if a key is present; otherwise fall back to the
 * chain's public RPC so the demo still boots without a key. For production
 * client use, front Alchemy with a NEXT_PUBLIC_ key or a server proxy.
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
    // TODO(live-key): set NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY in .env.local
    // (dashboard.magic.link -> your app -> Publishable API Key, pk_live_...).
    console.warn('[magic] NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY is not set — login disabled.');
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
  const address = info.publicAddress as Address | undefined;
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
  const address = info.publicAddress as Address | undefined;
  if (!address) return null;
  return { address, email: info.email ?? undefined, didToken: null };
}

export async function logout(): Promise<void> {
  const magic = getMagic();
  if (!magic) return;
  await magic.user.logout();
}

// -----------------------------------------------------------------------------
// viem interop — the Magic EOA as a viem wallet client
// -----------------------------------------------------------------------------
/**
 * A viem WalletClient backed by Magic's EIP-1193 provider, bound to `chainId`.
 * This is what we hand to ZeroDev as the 7702 signer (its `.account` signs the
 * userOp hash). The account address == the Magic EOA == the resulting smart
 * account address (that is the whole point of 7702).
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

  return createWalletClient({
    account: address as Address,
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

  const vNum = typeof auth.v === 'bigint' ? Number(auth.v) : Number(auth.v ?? 27);
  const yParity = vNum >= 27 ? vNum - 27 : vNum; // 27/28 -> 0/1
  return {
    address: (auth.address ?? params.contractAddress) as Address,
    chainId: params.chainId,
    nonce: params.nonce,
    r: auth.r as Hex,
    s: auth.s as Hex,
    yParity,
    v: BigInt(vNum),
  };
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
