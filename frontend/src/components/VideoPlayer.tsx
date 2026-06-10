import { forwardRef } from 'react'

type Props = {
  src: string
  onClick: () => void
  onLoadedMetadata: () => void
  onPlay: () => void
  onPause: () => void
  onEnded: () => void
}

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(({
  src,
  onClick,
  onLoadedMetadata,
  onPlay,
  onPause,
  onEnded,
}, ref) => {
  return (
    <video
      ref={ref}
      className="ar-video"
      src={src}
      playsInline
      muted={false}
      onClick={onClick}
      onLoadedMetadata={onLoadedMetadata}
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
    />
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
