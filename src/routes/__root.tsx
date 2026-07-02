import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../design/tokens.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
      },
      { title: 'Rally — live cross-chain fundraising thermometer' },
      {
        name: 'description',
        content:
          'One link. A bar that fills itself from every chain. Hit the goal, or everyone gets their money back.',
      },
      { name: 'theme-color', content: '#130d1a' },
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
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icons/icon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'icon', href: '/icons/icon-192.png', sizes: '192x192' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
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
