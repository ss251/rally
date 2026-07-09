import React from 'react'
import { staticFile, OffthreadVideo, Img } from 'remotion'
import { SCREEN_W, SCREEN_H, BEZEL, T } from '../theme'

// A machined dusk device frame. The screen shows a live app clip (OffthreadVideo)
// or a still (Img). `focus` lets a beat push into a region of the screen (e.g.
// the thermometer) via a pure transform — motion stays transforms/opacity only.
export function Phone({
  x = 150,
  y = 40,
  scale = 1,
  rotate = 0,
  opacity = 1,
  focus,
  children,
}: {
  x?: number
  y?: number
  scale?: number
  rotate?: number
  opacity?: number
  focus?: { scale: number; ox?: number; oy?: number }
  children: React.ReactNode
}) {
  const deviceW = SCREEN_W + BEZEL * 2
  const deviceH = SCREEN_H + BEZEL * 2
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: deviceW,
        height: deviceH,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        transformOrigin: 'center center',
        opacity,
        borderRadius: 48,
        padding: BEZEL,
        background: `linear-gradient(155deg, #2a2033, ${T.ink950})`,
        boxShadow:
          '0 2px 0 rgba(255,255,255,0.06) inset, 0 40px 90px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05), 0 0 60px -10px rgba(255,138,91,0.20)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 36,
          overflow: 'hidden',
          background: T.ink950,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: focus
              ? `scale(${focus.scale}) translate(${focus.ox ?? 0}%, ${focus.oy ?? 0}%)`
              : undefined,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// Convenience: a clip filling the screen.
export function Clip({ src, startFrom, playbackRate = 1 }: { src: string; startFrom?: number; playbackRate?: number }) {
  return (
    <OffthreadVideo
      src={staticFile(src)}
      startFrom={startFrom}
      playbackRate={playbackRate}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

export function Still({ src }: { src: string }) {
  return <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}
