import { useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

interface ShareLinkProps {
  /** The URL to copy. When omitted, copies the current page URL at click time. */
  url?: string
  /** primary = coral (the hero artifact action); ghost = quiet secondary
   *  button; text = Pools' text-link anatomy ("or start your own rally →") for
   *  use under a primary CTA without adding a second button of chrome. */
  variant?: 'primary' | 'ghost' | 'text'
  /** Button label before copy. */
  label?: string
  className?: string
}

/**
 * The "drop it in the group chat" action — one tap copies the shareable link.
 * The label springs to "Copied ✓" and settles back. Primary variant wears the
 * coral (used only where copying IS the hero action, e.g. the create success
 * screen); ghost is the quiet secondary used beside a "Chip in" CTA.
 */
export function ShareLink({ url, variant = 'ghost', label = 'Copy link', className }: ShareLinkProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const href =
      url ?? (typeof window !== 'undefined' ? window.location.href : '')
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      // Clipboard blocked (insecure ctx) — still flash success; link is visible.
    }
    setCopied(true)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8)
    setTimeout(() => setCopied(false), 1900)
  }

  const primary = variant === 'primary'

  if (variant === 'text') {
    return (
      <button
        onClick={copy}
        className={`w-full py-1 text-center text-sm font-medium text-muted transition-colors hover:text-paper ${className ?? ''}`}
      >
        {copied ? 'Copied to clipboard ✓' : `${label} →`}
      </button>
    )
  }

  return (
    <button
      onClick={copy}
      className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-4 text-base font-semibold transition-transform duration-150 ease-[var(--ease-spring)] active:scale-[0.97] ${
        primary ? 'text-ink-950' : 'border border-white/10 bg-white/[0.04] text-paper'
      } ${className ?? ''}`}
      style={
        primary
          ? {
              background:
                'linear-gradient(180deg, var(--color-rally-400), var(--color-rally-500) 58%, var(--color-rally-600))',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,30,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.8)',
            }
          : undefined
      }
    >
      {primary && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className="flex items-center gap-2"
          >
            <Check size={18} strokeWidth={3} /> Copied to clipboard
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className="flex items-center gap-2"
          >
            {primary ? <Link2 size={18} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2.5} />}
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

export default ShareLink
