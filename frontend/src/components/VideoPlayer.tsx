import { forwardRef, useEffect, useState } from 'react'

type Props = {
  src: string
  onSourceChange: (src: string) => void
}

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(({ src, onSourceChange }, ref) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [objectUrl])

  return (
    <div className="video-shell">
      <video ref={ref} className="ar-video" src={src} controls playsInline muted={false} />
      <label className="file-picker">
        选择本地汽车视频
        <input
          type="file"
          accept="video/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              return
            }
            if (objectUrl) {
              URL.revokeObjectURL(objectUrl)
            }
            const url = URL.createObjectURL(file)
            setObjectUrl(url)
            onSourceChange(url)
          }}
        />
      </label>
    </div>
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
