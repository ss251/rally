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
    assert.equal(clampIndex(-2, 8), 0)
    assert.equal(clampIndex(99, 8), 7)
    assert.equal(clampIndex(3, 8), 3)
    assert.equal(clampIndex(0, 0), 0)
  })

  it('reads #n from the URL and ignores junk', () => {
    assert.equal(parseHash('#4', 8), 4)
    assert.equal(parseHash('#0', 8), 0)
    assert.equal(parseHash('#', 8), 0)
    assert.equal(parseHash('#nope', 8), 0)
    assert.equal(parseHash('#99', 8), 7)
  })

  it('does not wrap — last slide stays last', () => {
    assert.equal(nextIndex(7, 8), 7)
    assert.equal(prevIndex(0, 8), 0)
    assert.equal(nextIndex(2, 8), 3)
    assert.equal(prevIndex(2, 8), 1)
  })
})

describe('deck content', () => {
  it('is eight slides', () => {
    const n = [...html.matchAll(/<section class="slide/g)].length
    assert.equal(n, 8)
  })

  it('ships official marks and live shots', () => {
    const utf8 = new TextDecoder('utf-8', { fatal: true })
    for (const f of LOGOS) {
      const p = join(root, 'assets/logos', f)
      assert.ok(existsSync(p), f)
      const buf = readFileSync(p)
      // Chromium <img src=".svg"> treats the file as UTF-8 XML and shows the
      // broken-image glyph if a latin-1 mid-dot sneaks into a comment.
      assert.doesNotThrow(() => utf8.decode(buf), f)
      const text = buf.toString('utf8')
      assert.match(text, /<svg/)
      // XML comments cannot contain "--". A latin-1 mid-dot was the last break;
      // a dash-dash replacement would also make Chromium reject the file.
      const comments = [...text.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1])
      for (const c of comments) assert.equal(c.includes('--'), false, `${f} comment has --`)
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
    assert.match(html, /Mainnet/)
    assert.match(html, /Coinbase/)
    assert.match(html, /MoonPay/)
    assert.match(html, /Connect an existing wallet/)
    assert.match(html, /The email wallet/)
    assert.match(html, /Future plans/)
    assert.match(html, /\[ roadmap \]/)
    assert.match(html, /One link\. A bar that fills from every chain\./)
  })

  it('does not duplicate the hero link or chip #1', () => {
    const nines = [...html.matchAll(/railway\.app\/c\/9/g)].length
    assert.equal(nines, 1)
    assert.doesNotMatch(html, /\/c\/1/)
  })

  it('keeps presenter voice off the slides', () => {
    const visible = html.replace(/<p class="notes">[\s\S]*?<\/p>/g, '')
    assert.doesNotMatch(visible, /wifi dies/i)
    assert.doesNotMatch(visible, /if wifi/i)
    assert.doesNotMatch(visible, /stop talking/i)
    assert.doesNotMatch(visible, /n notes/i)
    assert.match(html, /2:07 walkthrough/)
  })

  it('ships a spoken line for every slide and does not invite a live hop', () => {
    const notes = [...html.matchAll(/<p class="notes">([\s\S]*?)<\/p>/g)].map((m) => m[1])
    assert.equal(notes.length, 8)
    for (const note of notes) {
      const words = note.trim().split(/\s+/).length
      assert.ok(words >= 8, `note too short: ${note}`)
      assert.ok(words <= 80, `note too long: ${note}`)
    }
    const all = notes.join(' ')
    assert.doesNotMatch(all, /wifi/i)
    assert.doesNotMatch(all, /chip #1/i)
    assert.doesNotMatch(all, /let me open/i)
    assert.doesNotMatch(all, /switch to the live/i)
  })

  it('has no pitch-deck slop', () => {
    const low = html.toLowerCase()
    for (const word of SLOP) {
      assert.equal(low.includes(word), false, word)
    }
    const visible = html.replace(/<p class="notes">[\s\S]*?<\/p>/g, '')
    for (const phrase of [
      'proved the pot',
      'mainnet is the product',
      'the rest of the promise',
      'kind people actually send',
      'email. amount. done',
      'same promise. two shapes',
      'walk off with it',
      'one key, one notebook',
      'minted behind the code',
      'the backer never sees it',
      'a pot that fills from more than one chain',
    ]) {
      assert.equal(visible.toLowerCase().includes(phrase), false, phrase)
    }
  })
})

describe('pages workflow', () => {
  it('publishes the deck to the gh-pages branch', () => {
    const yml = readFileSync(join(root, '..', '.github/workflows/pages.yml'), 'utf8')
    assert.match(yml, /publish_dir:\s*\.\/deck/)
    assert.match(yml, /publish_branch:\s*gh-pages/)
    assert.match(yml, /contents:\s*write/)
    assert.doesNotMatch(yml, /enablement:\s*true/)
  })
})

describe('emil motion and chrome', () => {
  const css = readFileSync(join(root, 'deck.css'), 'utf8')

  it('uses his ease-out token and never transition: all', () => {
    assert.match(css, /--ease-out:\s*cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)/)
    assert.doesNotMatch(css, /transition:\s*all/)
    assert.doesNotMatch(css, /scale\(0\)/)
    assert.match(css, /scale\(0\.97\)/)
  })

  it('drops the slop chrome Clash / grain / glow', () => {
    assert.doesNotMatch(html, /clash-display|Clash Display|fontshare/i)
    assert.doesNotMatch(css, /\.grain/)
    assert.doesNotMatch(css, /radial-gradient/)
    assert.doesNotMatch(css, /feTurbulence/)
    assert.match(html, /Geist/)
    assert.match(css, /#050505/)
    assert.match(css, /--accent:\s*#ff6b4a/)
  })

  it('gates hover and respects reduced motion', () => {
    assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /body\.booting \.enter/)
  })

  it('does not animate keyboard slide changes', () => {
    assert.match(css, /\.slide\.on \{ display: flex; \}/)
    assert.doesNotMatch(css, /\.slide[^.{]*transition/)
  })

  it('does not clip graph titles', () => {
    assert.match(css, /\.graph \{[\s\S]*?overflow:\s*visible/)
    assert.match(css, /\.code \{[\s\S]*?overflow:\s*visible/)
    assert.match(html, /class="graph code-graph"/)
    assert.match(html, /\[ UnattributedFunds \]/)
  })
})
