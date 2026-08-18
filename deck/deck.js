export function clampIndex(i, n) {
  if (n <= 0) return 0
  return Math.max(0, Math.min(n - 1, i | 0))
}

export function parseHash(hash, n) {
  const raw = String(hash ?? '').replace(/^#/, '')
  if (!raw) return 0
  const i = Number.parseInt(raw, 10)
  if (!Number.isFinite(i)) return 0
  return clampIndex(i, n)
}

export function nextIndex(i, n) {
  return clampIndex(i + 1, n)
}

export function prevIndex(i, n) {
  return clampIndex(i - 1, n)
}

function boot() {
  const slides = [...document.querySelectorAll('.slide')]
  const dots = document.getElementById('dots')
  const frame = document.getElementById('frame')
  if (!slides.length || !dots || !frame) return

  slides.forEach((_, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'dot'
    b.setAttribute('aria-label', `Slide ${i + 1}`)
    b.addEventListener('click', () => go(i))
    dots.appendChild(b)
  })

  let i = parseHash(location.hash, slides.length)

  function go(next) {
    i = clampIndex(next, slides.length)
    slides.forEach((el, j) => el.classList.toggle('on', j === i))
    dots.querySelectorAll('.dot').forEach((el, j) => el.classList.toggle('on', j === i))
    const n = document.getElementById('step')
    if (n) n.textContent = String(i + 1).padStart(2, '0')
    history.replaceState(null, '', `#${i}`)
  }

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) return
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'j') {
      e.preventDefault()
      go(nextIndex(i, slides.length))
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'k') {
      e.preventDefault()
      go(prevIndex(i, slides.length))
    } else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(slides.length - 1)
    else if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
      else document.exitFullscreen?.()
    } else if (e.key === 'n' || e.key === 'N') {
      document.body.classList.toggle('notes-on')
    }
  })

  let x0 = 0
  frame.addEventListener('touchstart', (e) => {
    x0 = e.changedTouches[0].clientX
  }, { passive: true })
  frame.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x0
    if (Math.abs(dx) < 48) return
    go(dx < 0 ? nextIndex(i, slides.length) : prevIndex(i, slides.length))
  })

  window.addEventListener('hashchange', () => go(parseHash(location.hash, slides.length)))
  go(i)
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
}
