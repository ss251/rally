import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// @zerodev/sdk + deps reach for Node's `events`/`buffer` in the browser bundle;
// without shims the client throws "Class extends value undefined" (EventEmitter).
// Scope the polyfill to the CLIENT environment only — on the SSR/node server
// those modules are native, and the shims inject a CJS `module` ref that breaks
// the ESM server ("module is not defined").
const rawPolyfills = nodePolyfills({
  include: ['events'],
  protocolImports: true,
})
const clientPolyfills = (Array.isArray(rawPolyfills) ? rawPolyfills : [rawPolyfills]).map(
  (p) => ({ ...p, applyToEnvironment: (env: { name: string }) => env.name === 'client' }),
)

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    ...clientPolyfills,
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
