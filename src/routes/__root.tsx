import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../design/tokens.css?url'

// iOS PWA launch images. iOS only honors a startup image whose media query
// exactly matches the device (pt size × DPR × orientation), so we ship one per
// modern iPhone. Portrait only — the app is portrait-locked.
const SPLASH: { w: number; h: number; pw: number; ph: number; r: number }[] = [
  { w: 1179, h: 2556, pw: 393, ph: 852, r: 3 },
  { w: 1290, h: 2796, pw: 430, ph: 932, r: 3 },
  { w: 1170, h: 2532, pw: 390, ph: 844, r: 3 },
  { w: 1284, h: 2778, pw: 428, ph: 926, r: 3 },
  { w: 1125, h: 2436, pw: 375, ph: 812, r: 3 },
  { w: 828, h: 1792, pw: 414, ph: 896, r: 2 },
  { w: 750, h: 1334, pw: 375, ph: 667, r: 2 },
]
const splashLinks = SPLASH.map((s) => ({
  rel: 'apple-touch-startup-image',
  href: `/splash/splash-${s.w}x${s.h}.png`,
  media: `(device-width: ${s.pw}px) and (device-height: ${s.ph}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: portrait)`,
}))

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Rally — pool money together, from any chain' },
      {
        name: 'description',
        content:
          'One link. A bar that fills itself from every chain. Hit the goal, or everyone gets their money back.',
      },
      { name: 'theme-color', content: '#130d1a' },
      // Share unfurl (Discord/Slack/iMessage/X) — the first judging surface.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Rally' },
      { property: 'og:title', content: 'Rally — pool money together, from any chain' },
      {
        property: 'og:description',
        content: 'It pays out together, or refunds everyone — automatically.',
      },
      { property: 'og:url', content: 'https://rally-production-94cc.up.railway.app/' },
      { property: 'og:image', content: 'https://rally-production-94cc.up.railway.app/og.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      {
        property: 'og:image:alt',
        content: 'Rally — a vessel that fills as a group pools money',
      },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Rally — pool money together, from any chain' },
      {
        name: 'twitter:description',
        content: 'It pays out together, or refunds everyone — automatically.',
      },
      {
        name: 'twitter:image',
        content: 'https://rally-production-94cc.up.railway.app/og.png',
      },
      // iOS standalone / app-like chrome
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      { name: 'apple-mobile-web-app-title', content: 'Rally' },
    ],
    links: [
      // Warm up the font origins in PARALLEL with the CSS fetch. The display
      // face (Clash Display) loads via an @import nested inside tokens.css — a
      // render-blocking waterfall (HTML → CSS → @import → font) that can FOUT
      // the hero headline in a system fallback on a cold first paint. These
      // preconnects open the TLS handshakes up front so the Clash Display h1
      // paints markedly sooner. The @import stays (it's the real load + offline
      // fallback); display=swap is already set.
      { rel: 'preconnect', href: 'https://api.fontshare.com', crossOrigin: 'anonymous' },
      { rel: 'preconnect', href: 'https://cdn.fontshare.com', crossOrigin: 'anonymous' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      // favicon.svg + the PNGs are the pixel-engineered small rungs of the
      // mark (Shell size-ladder): ring edges on the pixel grid, meniscus
      // snapped to a 1:4 stair — see docs/design/MARK.md.
      { rel: 'icon', href: '/icons/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'icon', href: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { rel: 'icon', href: '/icons/icon-192.png', sizes: '192x192' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      ...splashLinks,
    ],
  }),
  shellComponent: RootDocument,
})

/** Registers the app-shell service worker (offline support) — client only. */
function useServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
      return
    if (import.meta.env.DEV) return // avoid SW caching during dev
    const register = () =>
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])
}

function RootDocument({ children }: { children: React.ReactNode }) {
  useServiceWorker()
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.VITE_DEVTOOLS === '1' && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
