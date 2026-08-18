/**
 * Rally · durable off-chain labels (SERVER-ONLY)
 * ---------------------------------------------------------------------------
 * Titles, organizer names, and pending circle-join requests are not stored
 * on-chain. This module owns the single JSON file behind them so a Railway
 * volume (`RALLY_META_FILE=/data/...`) survives redeploys.
 *
 * Production fails loud if the path is missing or not writable — an unlabeled
 * fund is honest, a silently dropped title is not.
 */
import type { Address, Hex } from 'viem'

export interface CampaignMeta {
  title: string
  organizer: string
  createTx?: Hex
  createdAt?: number
}

export interface CircleMeta {
  title: string
  organizer: string
  createTx?: Hex
  createdAt?: number
  vault?: Address
}

export interface PendingJoin {
  circleId: string
  seat: number
  member: Address
  requestedAt: number
}

interface RallyMetaStore {
  campaigns: Record<string, CampaignMeta>
  circles: Record<string, CircleMeta>
  pendingJoins: PendingJoin[]
}

const EMPTY: RallyMetaStore = { campaigns: {}, circles: {}, pendingJoins: [] }

function isProd(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT_ID)
  )
}

async function metaFile(): Promise<{ dir: string; file: string }> {
  const override = process.env.RALLY_META_FILE ?? ''
  if (override) {
    const { dirname } = await import('node:path')
    return { dir: dirname(override), file: override }
  }
  if (isProd()) {
    throw new Error('RALLY_META_FILE is required in production — titles will not survive a redeploy')
  }
  const { homedir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = join(homedir(), '.rally')
  return { dir, file: join(dir, 'rally-meta.json') }
}

async function readStore(): Promise<RallyMetaStore> {
  try {
    const { readFileSync, existsSync } = await import('node:fs')
    const { file } = await metaFile()
    if (!existsSync(file)) {
      // One-shot migrate from the old campaign-only filename.
      const { dirname, join } = await import('node:path')
      const legacy = join(dirname(file), 'campaign-meta.json')
      if (existsSync(legacy)) {
        const parsed = JSON.parse(readFileSync(legacy, 'utf8'))
        if (parsed && typeof parsed === 'object' && !parsed.campaigns) {
          return { campaigns: parsed as Record<string, CampaignMeta>, circles: {}, pendingJoins: [] }
        }
      }
      return { ...EMPTY, campaigns: {}, circles: {}, pendingJoins: [] }
    }
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.campaigns) {
      return {
        campaigns: parsed.campaigns ?? {},
        circles: parsed.circles ?? {},
        pendingJoins: Array.isArray(parsed.pendingJoins) ? parsed.pendingJoins : [],
      }
    }
    // Legacy shape: a flat campaign map.
    if (parsed && typeof parsed === 'object') {
      return { campaigns: parsed as Record<string, CampaignMeta>, circles: {}, pendingJoins: [] }
    }
    return { campaigns: {}, circles: {}, pendingJoins: [] }
  } catch (e) {
    if (isProd()) throw e
    return { campaigns: {}, circles: {}, pendingJoins: [] }
  }
}

async function writeStore(store: RallyMetaStore): Promise<void> {
  const { mkdirSync, writeFileSync, renameSync } = await import('node:fs')
  const { dir, file } = await metaFile()
  mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(tmp, file)
}

export async function getCampaignMeta(id: string): Promise<CampaignMeta | null> {
  const store = await readStore()
  const meta = store.campaigns[id]
  if (!meta || typeof meta.title !== 'string' || !meta.title.trim()) return null
  return meta
}

export async function writeCampaignMeta(id: string, meta: CampaignMeta): Promise<void> {
  const store = await readStore()
  store.campaigns[id] = meta
  await writeStore(store)
}

export async function getCircleMeta(id: string): Promise<CircleMeta | null> {
  const store = await readStore()
  const meta = store.circles[id]
  if (!meta || typeof meta.title !== 'string' || !meta.title.trim()) return null
  return meta
}

export async function writeCircleMeta(id: string, meta: CircleMeta): Promise<void> {
  const store = await readStore()
  store.circles[id] = meta
  await writeStore(store)
}

export async function requestJoin(circleId: string, seat: number, member: Address): Promise<PendingJoin> {
  const store = await readStore()
  const existing = store.pendingJoins.find(
    (j) => j.circleId === circleId && j.seat === seat && j.member.toLowerCase() === member.toLowerCase(),
  )
  if (existing) return existing
  const row: PendingJoin = { circleId, seat, member, requestedAt: Date.now() }
  store.pendingJoins = store.pendingJoins.filter((j) => !(j.circleId === circleId && j.seat === seat))
  store.pendingJoins.push(row)
  await writeStore(store)
  return row
}

export async function listPendingJoins(circleId: string): Promise<PendingJoin[]> {
  const store = await readStore()
  return store.pendingJoins.filter((j) => j.circleId === circleId)
}

export async function clearPendingJoin(circleId: string, seat: number): Promise<void> {
  const store = await readStore()
  store.pendingJoins = store.pendingJoins.filter((j) => !(j.circleId === circleId && j.seat === seat))
  await writeStore(store)
}
