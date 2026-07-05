// ============================================================================
// Rally demo — RENDER (Remotion)
// ----------------------------------------------------------------------------
// Assembles the captured clips + brand captions into the 1920x1080 master.
//   node scripts/render.mjs
// Produces: rally-demo.mp4  (+ key still frames in stills/key-*.png)
//
// Remotion serves assets from ./public via staticFile(). We keep the canonical
// clips in ./clips and fonts in ./assets, and mirror what the render needs into
// ./public here (derived, gitignored) so the deliverable tree stays clean.
// ============================================================================
import { bundle } from '@remotion/bundler'
import { selectComposition, renderMedia, ensureBrowser } from '@remotion/renderer'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const PUBLIC = path.join(ROOT, 'public')
const OUT = path.join(ROOT, 'rally-demo.mp4')
const ffmpeg = process.env.FFMPEG || 'ffmpeg'

function mirror(fromDir, toDir, filter) {
  fs.mkdirSync(toDir, { recursive: true })
  for (const f of fs.readdirSync(fromDir)) {
    if (filter && !filter(f)) continue
    const src = path.join(fromDir, f)
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(toDir, f))
  }
}

function syncPublic() {
  fs.rmSync(PUBLIC, { recursive: true, force: true })
  mirror(path.join(ROOT, 'clips'), path.join(PUBLIC, 'clips'), (f) => f.endsWith('.mp4'))
  mirror(path.join(ROOT, 'assets', 'fonts'), path.join(PUBLIC, 'fonts'), (f) => f.endsWith('.woff2'))
  mirror(path.join(ROOT, 'stills'), path.join(PUBLIC, 'stills'), (f) => f.endsWith('.png'))
  console.log('· public/ synced (clips + fonts + stills)')
}

// A few representative frames for the PR preview — pulled from the FINAL master
// so they show the real composited look (phone + brand captions), not raw app.
function extractStills(durationS) {
  const picks = [
    ['key-1-coldopen', 3.5],
    ['key-2-chipin', 13.0],
    ['key-3-money', 21.0],
    ['key-4-circles', 40.0],
    ['key-5-trust', 55.0],
  ].filter(([, t]) => t < durationS)
  for (const [name, t] of picks) {
    execFileSync(ffmpeg, ['-y', '-ss', String(t), '-i', OUT, '-frames:v', '1', path.join(ROOT, 'stills', `${name}.png`)], { stdio: 'ignore' })
  }
  console.log('· stills/key-*.png extracted:', picks.map((p) => p[0]).join(', '))
}

async function main() {
  syncPublic()
  await ensureBrowser()

  console.log('· bundling…')
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.ts'),
    publicDir: PUBLIC,
    onProgress: (p) => process.stdout.write(`\r  bundle ${p}%   `),
  })
  process.stdout.write('\n')

  const composition = await selectComposition({ serveUrl, id: 'RallyDemo' })
  console.log(`· composition ${composition.width}x${composition.height} · ${composition.durationInFrames}f @ ${composition.fps}fps (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`)

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: OUT,
    crf: 18,
    pixelFormat: 'yuv420p',
    imageFormat: 'jpeg',
    x264Preset: 'slow',
    chromiumOptions: { gl: 'angle' },
    onProgress: ({ progress }) => process.stdout.write(`\r  render ${Math.round(progress * 100)}%   `),
  })
  process.stdout.write('\n')

  const bytes = fs.statSync(OUT).size
  console.log(`✓ ${OUT}  (${(bytes / 1e6).toFixed(1)} MB)`)
  extractStills(composition.durationInFrames / composition.fps)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
