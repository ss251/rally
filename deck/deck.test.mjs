import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clampIndex, parseHash, nextIndex, prevIndex } from './deck.js'

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
