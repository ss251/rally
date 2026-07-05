// Bundle Clash Display (the brand display face) into the render so headings and
// the wordmark are pixel-identical to the app — no dependency on the host's
// installed fonts, and no network fetch during render.
//
// The faces are inlined as base64 data URIs (see fonts-inline.ts). Because a
// data URI carries the bytes inline, the font is available to the layout
// engine synchronously once the @font-face rule + FontFace are registered — so
// we deliberately DO NOT use delayRender() here. delayRender is the one thing
// that can hang a multi-worker Remotion render (a load() promise that never
// settles, timers that Remotion mocks); dropping it removes that failure mode
// entirely while inline fonts still paint correctly from the first frame.
import { FONT_FACES } from './fonts-inline'

let started = false

export function ensureFonts() {
  if (started || typeof document === 'undefined') return
  started = true

  // @font-face rules via inline data URIs — the CSS the layout engine uses.
  const style = document.createElement('style')
  style.textContent = FONT_FACES.map(
    ({ weight, dataUrl }) =>
      `@font-face{font-family:'Clash Display';src:url(${dataUrl}) format('woff2');font-weight:${weight};font-style:normal;font-display:block;}`,
  ).join('')
  document.head.appendChild(style)

  // Also register via the FontFace API so document.fonts is aware of them.
  // Fire-and-forget: no awaiting, no delayRender — data URIs need no fetch.
  for (const { weight, dataUrl } of FONT_FACES) {
    try {
      // NB: the FontFace source accepts only url()/local() — no format() (CSS-only).
      const face = new FontFace('Clash Display', `url(${dataUrl})`, { weight, style: 'normal' })
      // @ts-expect-error FontFaceSet at runtime
      document.fonts.add(face)
      void face.load()
    } catch {
      /* ignore — the @font-face rule above already covers rendering */
    }
  }
}
