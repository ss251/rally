import React from 'react'
import { Composition } from 'remotion'
import { RallyDemo, TOTAL } from './RallyDemo'
import { FPS } from './theme'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="RallyDemo"
      component={RallyDemo}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
    />
  )
}
