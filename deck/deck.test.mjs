import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clampIndex, parseHash, nextIndex, prevIndex } from './deck.js'

const root = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(root, 'index.html'), 'utf8')

const SLOP = [
  'seamless',
  'revolution',
  'game-changing',
  'leverage',
  'unlock your',
  'empower',
  'cutting-edge',
  'we\'re excited',
  'dive in',
  'in this talk',
  'next-gen',
  'robust',
  'scalable',
]

const LOGOS = [
  'magic.svg',
  'zerodev.svg',
  'circle-mark.svg',
  'arbitrum.svg',
  'optimism.svg',
  'base.svg',
]

const SHOTS = ['landing.png', 'goal.png', 'chipin.png', 'circle.png', 'broke.png']

describe('deck navigation', () => {
  it('clamps to the live range', () => {
    assert.equal(clampIndex(-2, 7), 0)
    assert.equal(clampIndex(99, 7), 6)
    assert.equal(clampIndex(3, 7), 3)
    assert.equal(clampIndex(0, 0), 0)
  })

  it('reads #n from the URL and ignores junk', () => {
    assert.equal(parseHash('#4', 7), 4)
    assert.equal(parseHash('#0', 7), 0)
    assert.equal(parseHash('#', 7), 0)
    assert.equal(parseHash('#nope', 7), 0)
    assert.equal(parseHash('#99', 7), 6)
  })

  it('does not wrap — last slide stays last', () => {
    assert.equal(nextIndex(6, 7), 6)
    assert.equal(prevIndex(0, 7), 0)
    assert.equal(nextIndex(2, 7), 3)
    assert.equal(prevIndex(2, 7), 1)
  })
})

describe('deck content', () => {
  it('is seven slides', () => {
    const n = [...html.matchAll(/<section class="slide/g)].length
    assert.equal(n, 7)
  })

  it('ships official marks and live shots', () => {
    for (const f of LOGOS) {
      const p = join(root, 'assets/logos', f)
      assert.ok(existsSync(p), f)
      assert.match(readFileSync(p, 'utf8'), /<svg/)
    }
    for (const f of SHOTS) {
      const p = join(root, 'assets/shots', f)
      assert.ok(existsSync(p), f)
      assert.ok(statSync(p).size > 40_000, `${f} too small`)
    }
  })

  it('names the real vaults, domains, and receipts', () => {
    assert.match(html, /0x914e4682/)
    assert.match(html, /0xdd9b3e5F/)
    assert.match(html, /UnattributedFunds/)
    assert.match(html, /sourceDomain/)
    assert.match(html, /Domains 6 \/ 2 → 3/)
    assert.match(html, /\/c\/9/)
    assert.match(html, /\/circle\/7/)
    assert.match(html, /\/circle\/2/)
    assert.match(html, /0xdb9d1d5c/)
    assert.match(html, /LjRc0v0KI9I/)
  })

  it('does not duplicate the hero link or chip #1', () => {
    const nines = [...html.matchAll(/open \/c\/9/g)].length
    assert.equal(nines, 1)
    assert.doesNotMatch(html, /\/c\/1/)
  })

  it('has no pitch-deck slop', () => {
    const low = html.toLowerCase()
    for (const word of SLOP) {
      assert.equal(low.includes(word), false, word)
    }
  })
})
