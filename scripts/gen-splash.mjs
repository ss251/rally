// Generate iOS PWA launch splash screens from an on-brand template, rendered at
// exact device-pixel sizes via Chromium (pixel-perfect, no font/AA surprises).
// Temporary functional launch art: the dusk canvas + the coral capsule glyph +
// the Rally wordmark — matches the app icon, NOT a final brand splash.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'splash')
mkdirSync(outDir, { recursive: true })

// Portrait CSS-point sizes × DPR for modern iPhones (covers the review device
// iPhone 15 Pro = 393×852@3x). Landscape omitted — the app is portrait-locked.
const TARGETS = [
  { w: 1179, h: 2556, name: 'splash-1179x2556.png' }, // 15 / 15 Pro / 14 Pro
  { w: 1290, h: 2796, name: 'splash-1290x2796.png' }, // 15/14 Pro Max
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' }, // 13 / 14
  { w: 1284, h: 2778, name: 'splash-1284x2778.png' }, // 12/13 Pro Max
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' }, // X / 11 Pro / 12 mini
  { w: 828, h: 1792, name: 'splash-828x1792.png' }, //  XR / 11
  { w: 750, h: 1334, name: 'splash-750x1334.png' }, //  SE / 8
]

// One glyph, scaled per canvas. `s` scales the ~132×300 capsule from the icon.
const html = (w, h) => {
  const s = Math.min(w, h) * 0.00095 // capsule ≈ 12% of the short edge wide
  const cx = w / 2
  const cy = h / 2 - h * 0.02
  const tw = 132 * s
  const th = 300 * s
  const x = cx - tw / 2
  const y = cy - th / 2
  const fillY = y + th * 0.36 // ~64% full
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:#130d1a}
    .stage{position:relative;width:${w}px;height:${h}px;
      background:radial-gradient(60% 42% at 50% 46%, #20172b 0%, #160f1f 55%, #130d1a 100%)}
    .word{position:absolute;left:0;right:0;top:${cy + th / 2 + h * 0.035}px;text-align:center;
      color:#f6f1f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
      font-weight:700;letter-spacing:-0.02em;font-size:${Math.round(Math.min(w, h) * 0.052)}px;opacity:0.96}
    .sub{position:absolute;left:0;right:0;top:${cy + th / 2 + h * 0.035 + Math.min(w, h) * 0.075}px;
      text-align:center;color:#a89fb4;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
      font-weight:500;font-size:${Math.round(Math.min(w, h) * 0.026)}px;opacity:0.8}
  </style></head><body><div class="stage">
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="merc" x1="0" y1="${y + th}" x2="0" y2="${fillY}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ff6b4a"/><stop offset="1" stop-color="#ffc36b"/>
        </linearGradient>
        <radialGradient id="glow" cx="${cx}" cy="${cy + th * 0.18}" r="${tw * 2.4}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ff8a5b" stop-opacity="0.5"/>
          <stop offset="1" stop-color="#ff8a5b" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="tube"><rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="${tw / 2}"/></clipPath>
      </defs>
      <circle cx="${cx}" cy="${cy + th * 0.18}" r="${tw * 2.4}" fill="url(#glow)"/>
      <rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="${tw / 2}" fill="#ffffff" fill-opacity="0.04"/>
      <g clip-path="url(#tube)">
        <rect x="${x}" y="${fillY}" width="${tw}" height="${th}" fill="url(#merc)"/>
        <rect x="${x}" y="${fillY - 2 * s}" width="${tw}" height="${3 * s}" fill="#ffffff" fill-opacity="0.85"/>
      </g>
      <rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="${tw / 2}" fill="none"
        stroke="#ffffff" stroke-opacity="0.14" stroke-width="${2 * s}"/>
    </svg>
    <div class="word">Rally</div>
    <div class="sub">One link. A bar that fills from every chain.</div>
  </div></body></html>`
}

const browser = await chromium.launch()
for (const t of TARGETS) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 })
  await page.setContent(html(t.w, t.h), { waitUntil: 'networkidle' })
  await page.screenshot({ path: join(outDir, t.name) })
  await page.close()
  console.log('splash →', t.name)
}
await browser.close()
