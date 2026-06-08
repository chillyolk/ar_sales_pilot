import { forwardRef } from 'react'

type Props = {
  src: string
}

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(({ src }, ref) => {
  return <video ref={ref} className="ar-video" src={src} controls playsInline muted={false} />
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
