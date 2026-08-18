import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pitch')({
  ssr: false,
  component: Pitch,
})

/** Full-bleed iframe of the standalone deck (copied to /pitch/ by Vite). */
function Pitch() {
  return (
    <iframe
      title="Rally — UXmaxx"
      src="/uxmaxx/index.html"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        border: 0,
        background: '#130d1a',
        zIndex: 80,
      }}
    />
  )
}
