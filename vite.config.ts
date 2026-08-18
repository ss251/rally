import { cpSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const DECK_DIR = resolve(import.meta.dirname, 'deck')
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

/** Serve /uxmaxx from deck/ in dev (no copy — writing public/ loops Vite). Copy on build for /pitch. */
function pitchDeckPlugin(command: 'build' | 'serve'): Plugin {
  return {
    name: 'rally-pitch-deck',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/uxmaxx')) return next()
        const rel = url === '/uxmaxx' || url === '/uxmaxx/' ? 'index.html' : url.slice('/uxmaxx/'.length)
        const file = resolve(DECK_DIR, rel)
        if (!file.startsWith(DECK_DIR)) return next()
        try {
          const data = readFileSync(file)
          res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
          res.end(data)
        } catch {
          next()
        }
      })
    },
    buildStart() {
      if (command !== 'build') return
      const dest = resolve(import.meta.dirname, 'public/uxmaxx')
      mkdirSync(dest, { recursive: true })
      cpSync(DECK_DIR, dest, {
        recursive: true,
        filter: (src) => !src.endsWith('.mjs') && !src.endsWith('.md'),
      })
    },
  }
}

// The `events` polyfill exists ONLY to stop the Vite DEV server crashing on
// @zerodev/sdk's node:events import (EventEmitter). The PRODUCTION build resolves
// it fine on its own — and applying the polyfill to `build` corrupts the SSR
// server bundle's `process` global (process.stderr → undefined → h3's
// gracefulShutdown throws on boot and the deployed server crash-loops with
// "Cannot read properties of undefined (reading 'write')"). So it is strictly
// DEV-ONLY (command === 'serve'). ⚠️ Do NOT remove the `command === 'serve'`
// gate — that regression takes prod down.
const rawPolyfills = nodePolyfills({
  include: ['events'],
  protocolImports: true,
})
const clientPolyfills = (Array.isArray(rawPolyfills) ? rawPolyfills : [rawPolyfills]).map(
  (p) => ({ ...p, applyToEnvironment: (env: { name: string }) => env.name === 'client' }),
)

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(command === 'serve' ? clientPolyfills : []),
    pitchDeckPlugin(command),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))

export default config
