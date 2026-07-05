// One-shot visual recon of the live Rally app — confirms on-screen state and
// selectors before wiring the real capture. Not part of the pipeline; a probe.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const BASE = process.env.RALLY_URL ?? 'https://rally-production-94cc.up.railway.app'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../recon')

const shot = async (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`) })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 400, height: 860 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()

async function settle(ms = 1400) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

// 1. Landing
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await settle()
await shot(page, '01-landing')
console.log('landing title:', await page.title())
console.log('live pill text:', await page.locator('text=/Live on|Demo/').first().textContent().catch(() => '??'))
console.log('raised readout:', await page.locator('.text-figure').first().textContent().catch(() => '??'))

// 2. Chip-in sheet — open, then filled
const chipBtn = page.getByRole('button', { name: /Chip in/i }).first()
console.log('chip button visible:', await chipBtn.isVisible().catch(() => false))
await chipBtn.click()
await page.waitForTimeout(900)
await shot(page, '02-sheet-open')
const emailInput = page.getByPlaceholder(/you@email/i)
await emailInput.fill('sailesh.e123+demo1@gmail.com')
await page.getByRole('button', { name: '$25' }).click().catch(() => {})
await page.waitForTimeout(500)
await shot(page, '03-sheet-filled')

// 3. Circles landing
await page.goto(`${BASE}/circles`, { waitUntil: 'domcontentloaded' })
await settle()
await shot(page, '04-circles')

// 4. Circle 1 (mid-fill)
await page.goto(`${BASE}/circle/1`, { waitUntil: 'domcontentloaded' })
await settle()
await shot(page, '05-circle-1')
console.log('circle1 pulse:', await page.locator('h1').first().textContent().catch(() => '??'))

// 5. Circle 2 (broken/refunded)
await page.goto(`${BASE}/circle/2`, { waitUntil: 'domcontentloaded' })
await settle()
await shot(page, '06-circle-2')
console.log('circle2 h1:', await page.locator('h1').first().textContent().catch(() => '??'))

await browser.close()
console.log('recon done ->', OUT)
