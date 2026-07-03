// Generate iOS PWA launch splash screens from an on-brand template, rendered at
// exact device-pixel sizes via Chromium (pixel-perfect, no font/AA surprises).
// Draws the constructed Rally mark (see docs/design/MARK.md): one circle (the
// pool), wall = R/6, liquid = solid segment of radius 7R/9 whose meniscus runs
// from 180° to 30° — a 15° rise, two-thirds full. Flat paint, no gradient/glow.
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

// The constructed mark, centered at (cx, cy) with outer radius R.
const mark = (cx, cy, R) => {
  const w = R / 6
  const rp = R - w / 2
  const rf = (R * 7) / 9
  const lx = cx - rf
  const rx = cx + rf * Math.cos(Math.PI / 6)
  const ry = cy - rf * 0.5
  return `
      <circle cx="${cx}" cy="${cy}" r="${rp}" stroke="#f6f1f9" stroke-width="${w}"/>
      <path d="M ${lx.toFixed(2)} ${cy} A ${rf.toFixed(2)} ${rf.toFixed(2)} 0 1 0 ${rx.toFixed(2)} ${ry.toFixed(2)} Z" fill="#ff7a50"/>`
}

const html = (w, h) => {
  const short = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2 - h * 0.05
  const R = short * 0.155 // mark ≈ 31% of the short edge wide
  const wordY = cy + R + h * 0.045
  const wordSize = Math.round(short * 0.052)
  const subY = wordY + wordSize * 1.55
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @import url("https://api.fontshare.com/v2/css?f[]=clash-display@600&display=swap");
    html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:#130d1a}
    .stage{position:relative;width:${w}px;height:${h}px;background:#130d1a}
    .word{position:absolute;left:0;right:0;top:${wordY}px;text-align:center;
      color:#f6f1f9;font-family:'Clash Display',-apple-system,'Segoe UI',Roboto,sans-serif;
      font-weight:600;letter-spacing:-0.02em;font-size:${wordSize}px}
    .sub{position:absolute;left:0;right:0;top:${subY}px;
      text-align:center;color:#a89fb4;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
      font-weight:500;font-size:${Math.round(short * 0.026)}px;opacity:0.85}
  </style></head><body><div class="stage">
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">${mark(cx, cy, R)}
    </svg>
    <div class="word">Rally</div>
    <div class="sub">Conditional group money</div>
  </div></body></html>`
}

const browser = await chromium.launch()
for (const t of TARGETS) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 })
  await page.setContent(html(t.w, t.h), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(outDir, t.name) })
  await page.close()
  console.log('splash →', t.name)
}
await browser.close()
