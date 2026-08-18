/**
 * Recapture phone-width product shots from production (and local /circle/7).
 *   bunx playwright install chromium
 *   node deck/capture-shots.mjs
 */
import { chromium, devices } from 'playwright'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), 'assets/shots')
mkdirSync(root, { recursive: true })

const LIVE = 'https://rally-production-94cc.up.railway.app'
const LOCAL = process.env.RALLY_LOCAL ?? 'http://localhost:3000'

const phone = {
  ...devices['iPhone 14'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
}

async function shot(page, name) {
  const dest = join(root, name)
  await page.screenshot({ path: dest, type: 'png' })
  console.log('wrote', dest)
}

const browser = await chromium.launch()
const context = await browser.newContext(phone)
const page = await context.newPage()
page.setDefaultTimeout(45_000)

await page.goto(`${LIVE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot(page, 'landing.png')

await page.goto(`${LIVE}/c/9`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot(page, 'goal.png')

const chip = page.getByRole('button', { name: /chip in/i }).first()
await chip.click()
await page.getByText('Paying from', { exact: false }).first().click()
await page.waitForTimeout(400)
await shot(page, 'chipin.png')

await page.goto(`${LIVE}/circle/2`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot(page, 'broke.png')

try {
  await page.goto(`${LOCAL}/circle/7`, { waitUntil: 'networkidle', timeout: 8_000 })
  await page.waitForTimeout(1200)
  await shot(page, 'circle.png')
} catch (e) {
  console.warn('local /circle/7 skipped:', e.message)
  await page.goto(`${LIVE}/circle/7`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await shot(page, 'circle.png')
}

await browser.close()
