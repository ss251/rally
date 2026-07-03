import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))

export default config
