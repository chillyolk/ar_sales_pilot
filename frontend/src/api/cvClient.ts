import type { DetectResponse } from '../types'

export async function detectFrame(params: {
  frame: Blob
  frameId: number
  videoTime: number
  width: number
  height: number
}): Promise<DetectResponse> {
  const form = new FormData()
  form.append('frame', params.frame, `frame-${params.frameId}.jpg`)
  form.append('frame_id', String(params.frameId))
  form.append('video_time', String(params.videoTime))
  form.append('width', String(params.width))
  form.append('height', String(params.height))

  const response = await fetch('/api/detect-frame', {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    throw new Error(`检测请求失败：${response.status}`)
  }
  return response.json()
}
