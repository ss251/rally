import { useEffect, useId, useRef, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  type PanInfo,
} from 'motion/react'

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
// heavy/rubbery, a chip is light/snappy). Interruptible: grab it mid-flight.
const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 44, mass: 0.9 } as const

/**
 * Gesture-native bottom sheet — drag-to-dismiss with rubber-banding at the top
 * and velocity-based snap (a flick dismisses even on a small drag). Animations
 * are interruptible (Motion). Backdrop tap + Escape also close; body scroll is
 * locked while open; safe-area aware. Honors reduced-motion via Motion.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  title,
  dismissOffset = 0.35,
  dismissVelocity = 700,
  className,
}: BottomSheetProps) {
  const y = useMotionValue(0)
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

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const height = sheetRef.current?.offsetHeight ?? 1
    const dismissed =
      info.offset.y > height * dismissOffset || info.velocity.y > dismissVelocity
    if (dismissed) onClose()
    else y.set(0) // snap back — spring handles the settle
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={title ? labelId : undefined}>
          {/* Scrim */}
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px] ${className ?? ''}`}
            style={{ y }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            drag="y"
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
        </div>
      )}
    </AnimatePresence>
  )
}

export default BottomSheet
