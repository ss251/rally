// ============================================================================
// Rally demo — BEAT CAPTURE (Playwright)
// ----------------------------------------------------------------------------
// Records one video clip + one high-DPI still per storyboard beat off the LIVE
// app, then transcodes each clip to H.264 mp4 for Remotion. Re-run any time the
// app or the live state changes — this is the source-of-truth capture step.
//
//   node scripts/capture.mjs                # capture everything
//   RALLY_URL=http://localhost:3000 node scripts/capture.mjs
//   BEATS=chipin,circle-2 node scripts/capture.mjs   # only some beats
//
// Money-moment path: (a) — we capture the chip-in SHEET interaction (open, type
// email, pick $25, press "Chip in") THROUGH the real "Check your email…" auth
// step, but NEVER enter an OTP, so no contribution completes and live prod state
// is never mutated. The "bar rises / You're in ✦" payoff is composited in
// Remotion over the live filled bar — deterministic and repeatable.
// ============================================================================
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const CLIPS = path.join(ROOT, 'clips')
const STILLS = path.join(ROOT, 'stills')
const RAW = path.join(CLIPS, 'raw')
const BASE = (process.env.RALLY_URL ?? 'https://rally-production-94cc.up.railway.app').replace(/\/$/, '')

// Phone capture surface. 1:1 recordVideo (no upscale => crisp). The app renders
// its mobile column at this width; in the 1920x1080 master it sits in a device
// frame on the left third, so ~440px source ≈ 1:1 with its on-screen size.
const VW = 440
const VH = 956
const DPR = 2

for (const d of [CLIPS, STILLS, RAW]) fs.mkdirSync(d, { recursive: true })

const only = process.env.BEATS ? new Set(process.env.BEATS.split(',').map((s) => s.trim())) : null
const want = (name) => !only || only.has(name)

const ffmpeg = process.env.FFMPEG || 'ffmpeg'

// Every clip has a white PRE-PAINT head (Playwright records from context
// creation, before the app paints). We measure that head (context start ->
// first painted frame), trim it, then clone the last frame so every clip is a
// uniform CLIP_SECONDS of PAINTED content — all beats fit, no white flashes.
const CLIP_SECONDS = 10

/** Run one beat inside its own recording context so we get a discrete clip. */
async function beat(browser, name, fn, { still = true } = {}) {
  if (!want(name)) {
    console.log(`· skip ${name}`)
    return
  }
  const t0 = Date.now()
  const ctxStart = Date.now() // video t=0 ≈ here
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: DPR,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
    recordVideo: { dir: RAW, size: { width: VW, height: VH } },
  })
  const page = await ctx.newPage()
  let paintedAt = null // wall-clock of first painted app frame
  const helpers = {
    page,
    goto: async (url) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {})
      await page.waitForTimeout(400)
      if (paintedAt == null) paintedAt = Date.now()
    },
    hold: (ms) => page.waitForTimeout(ms),
    still: (suffix = '') =>
      page.screenshot({ path: path.join(STILLS, `${name}${suffix}.png`) }),
  }
  try {
    await fn(helpers)
    if (still) await helpers.still()
  } catch (e) {
    console.warn(`! ${name} beat errored (keeping partial clip): ${e.message?.split('\n')[0]}`)
  } finally {
    const video = page.video()
    await ctx.close() // finalizes the webm
    if (video) {
      const src = await video.path()
      const webm = path.join(CLIPS, `${name}.webm`)
      fs.renameSync(src, webm)
      // trim the measured white head (+0.3s margin), clamped to >= 0
      const headSec = Math.max(0, (paintedAt ?? ctxStart) - ctxStart) / 1000 + 0.3
      transcode(webm, path.join(CLIPS, `${name}.mp4`), headSec)
      console.log(`✓ ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)  head-trim ${headSec.toFixed(1)}s -> ${name}.mp4`)
    }
  }
}

/**
 * webm -> H.264 mp4: seek past the white head (-ss before -i), normalize to
 * 30fps, then clone the last frame (tpad) so the clip is exactly CLIP_SECONDS
 * of painted content. Even dimensions + yuv420p = universally playable.
 */
function transcode(webm, mp4, headSec = 0) {
  execFileSync(
    ffmpeg,
    [
      '-y', '-ss', headSec.toFixed(3), '-i', webm,
      '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30,tpad=stop_mode=clone:stop_duration=${CLIP_SECONDS}`,
      '-t', String(CLIP_SECONDS),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
      mp4,
    ],
    { stdio: 'ignore' },
  )
}

// Type an email slowly so the interaction reads as real (not an instant paste).
async function typeEmail(page, email) {
  const input = page.getByPlaceholder(/you@email/i)
  await input.click()
  await input.pressSequentially(email, { delay: 55 })
}

const browser = await chromium.launch()
try {
  // ── 0:00 COLD OPEN — the live landing, bar mid-fill, "Live on Arbitrum" ──
  await beat(browser, 'landing', async ({ goto, hold }) => {
    await goto(BASE)
    await hold(4200) // let the pulse breathe; Remotion adds a slow push-in
  })

  // ── 0:08 CHIP IN — open sheet, type email, pick $25, press "Chip in" ──
  // Pressing the CTA fires the REAL auth → the CTA flips to "Check your email…"
  // (Magic email login begins). We never enter the OTP, so nothing is contributed
  // and prod state is untouched; the "You're in ✦" payoff is composited (path a).
  await beat(browser, 'chipin', async ({ goto, hold, page }) => {
    await goto(BASE)
    await hold(700)
    await page.getByRole('button', { name: /Chip in \$25/i }).first().click()
    await hold(1100) // sheet springs up
    await typeEmail(page, 'sailesh.e123+demo1@gmail.com')
    await hold(500)
    await page.getByRole('dialog').getByRole('button', { name: '$25', exact: true }).click().catch(() => {})
    await hold(700)
    // Press the sheet CTA — fires send() → "Check your email…" (auth pending).
    await page.getByRole('dialog').getByRole('button', { name: /Chip in \$25/i }).click().catch(() => {})
    await hold(1600) // rest on the real "Check your email…" state
  })

  // ── 0:32 MODE SWITCH → CIRCLES — tap the Circles tab, land in Circles ──
  await beat(browser, 'mode-switch', async ({ goto, hold, page }) => {
    await goto(BASE)
    await hold(1000)
    await page.getByRole('link', { name: /Circles/i }).first().click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {})
    await hold(3000) // rest on the Circles list
  })

  // ── 0:36 CIRCLE 1 — rotating savings circle, mid-fill ──
  await beat(browser, 'circle-1', async ({ goto, hold }) => {
    await goto(`${BASE}/circle/1`)
    await hold(4200)
  })

  // ── 0:45 CIRCLE 2 — broken → auto-refunded (the trust punchline) ──
  await beat(browser, 'circle-2', async ({ goto, hold, page }) => {
    await goto(`${BASE}/circle/2`)
    await hold(2600)
    // Gentle reveal of the "Everyone gets back" refund list below the fold.
    await page.evaluate(() => window.scrollTo({ top: 260, behavior: 'smooth' }))
    await hold(2600)
  })
} finally {
  await browser.close()
}

console.log('\nclips  ->', CLIPS)
console.log('stills ->', STILLS)
