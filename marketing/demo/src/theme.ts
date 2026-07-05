// Rally brand tokens — mirrored from src/design/tokens.css so the video reads
// as the same product. Dusk canvas + sunrise-coral accent + Clash Display.
export const T = {
  ink950: '#130d1a',
  ink900: '#191122',
  ink850: '#20172b',
  ink800: '#281d34',
  paper: '#f6f1f9',
  muted: '#a89fb4',
  faint: '#6f6579',
  rally300: '#ffc36b',
  rally400: '#ff9a5b',
  rally500: '#ff7a50',
  rally600: '#ff6b4a',
  rallyGlow: '#ff8a5b',
  chainBase: '#0052ff',
  chainArb: '#12aaff',
  ok: '#34d399',
  line: 'rgba(255,255,255,0.10)',
  display: '"Clash Display", ui-sans-serif, system-ui, sans-serif',
  sans: 'Inter, ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  // expo-out — the app's signature "rise" ease
  easeRally: [0.22, 1, 0.36, 1] as [number, number, number, number],
  easeSpring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
} as const

export const FPS = 30

// Phone device geometry inside the 1920x1080 master.
export const SCREEN_W = 460
export const SCREEN_H = 1000 // 460:1000 ≈ 440:956 capture ratio
export const BEZEL = 13
