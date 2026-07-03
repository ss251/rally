import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { RouteSkeleton } from './components/RouteSkeleton'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Loading state: routes read the chain live, so a tap can hang on RPC.
    // After 150ms of silence show the skeleton (fast loads never flash it);
    // once shown, hold it 300ms so it settles instead of blinking.
    defaultPendingComponent: RouteSkeleton,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    // View Transitions API — shared-element route morphs. Browsers without
    // document.startViewTransition() fall back to an instant navigation
    // (graceful degradation, no error).
    defaultViewTransition: true,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
