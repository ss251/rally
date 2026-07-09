import { useEffect, useId, useRef, type ReactNode } from 'react'
import { motion, useMotionValue, type PanInfo } from 'motion/react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  /** Fraction of sheet height dragged, or px/s velocity, that dismisses. */
  dismissOffset?: number
  dismissVelocity?: number
  className?: string
}

// Heavy, rubbery spring — the sheet has mass (Design Bible §2: the sheet is
// heavy/rubbery, a chip is light/snappy). ONE physics for open, close, and
// drag-release: a spring always starts from the sheet's LIVE position and
// inherits its velocity (Apple, Designing Fluid Interfaces) — a thrown sheet
// leaves with the finger's momentum; a reopen mid-close reverses in flight.
const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 44, mass: 0.9 } as const

/**
 * Gesture-native bottom sheet — drag-to-dismiss with rubber-banding at the top
 * and velocity-based snap (a flick dismisses even on a small drag). Backdrop
 * tap + Escape also close; body scroll is locked while open; safe-area aware.
 * Honors reduced-motion via Motion.
 *
 * ALWAYS MOUNTED, never conditionally rendered: open/close is pure spring
 * animation on a permanently-present subtree, gated by `inert` +
 * `pointer-events: none` while closed. The previous AnimatePresence flow tied
 * UNMOUNTING to exit-animation completion — and Motion's springs run on rAF,
 * which throttled tabs/webviews pause, leaving a closed-but-mounted sheet
 * whose invisible scrim swallowed every tap. Here interactivity is gated by
 * STATE (instant, unthrottleable); motion is presentation only.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  title,
  dismissOffset = 0.35,
  // A quick flick should be enough — don't demand a long drag (momentum
  // dismissal; Motion reports velocity in px/s).
  dismissVelocity = 500,
  className,
}: BottomSheetProps) {
  const y = useMotionValue(0) // drag offset only (px)
  const sheetRef = useRef<HTMLDivElement>(null)
  const labelId = useId()

  // Escape to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  // Reset any lingering drag offset whenever the sheet opens.
  useEffect(() => {
    if (open) y.set(0)
  }, [open, y])

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const height = sheetRef.current?.offsetHeight ?? 1
    const dismissed =
      info.offset.y > height * dismissOffset || info.velocity.y > dismissVelocity
    if (dismissed) onClose()
    else y.set(0) // snap back — spring handles the settle
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? labelId : undefined}
      aria-hidden={!open}
      inert={!open}
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      {/* Scrim */}
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.24 }}
        onClick={onClose}
      />

      {/* Open/close shell — animates in PERCENT of its own height (Vaul-style),
          so the travel is correct for any sheet size. The drag offset lives on
          the INNER element in px; the two transforms compose. */}
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px]"
        initial={false}
        animate={{ y: open ? '0%' : '110%' }}
        transition={SHEET_SPRING}
      >
        <motion.div
          ref={sheetRef}
          className={className}
          style={{ y }}
          drag={open ? 'y' : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.9 }} // rubber-band: firm up-top, loose down
          onDragEnd={handleDragEnd}
        >
          <div
            className="relative overflow-hidden rounded-t-[1.5rem] border-t border-white/10 bg-ink-900/90 backdrop-blur-2xl"
            style={{
              paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)',
              boxShadow:
                '0 -1px 0 0 rgba(255,255,255,0.06) inset, 0 -24px 60px -12px rgba(0,0,0,0.6)',
            }}
          >
            {/* Grab handle */}
            <div className="flex cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing">
              <div className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>

            {title && (
              <h2
                id={labelId}
                className="px-6 pt-2 pb-1 text-lg font-semibold tracking-tight text-paper"
              >
                {title}
              </h2>
            )}

            <div className="px-6 pt-2">{children}</div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default BottomSheet
