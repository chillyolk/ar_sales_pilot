import type { ChatResponse, PartDetection, VehicleDetection } from '../types'

export async function askGuide(params: {
  question: string
  vehicle?: VehicleDetection
  part?: PartDetection
  city: string
}): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: params.question,
      current_vehicle: params.vehicle
        ? {
            track_id: params.vehicle.track_id,
            class_name: params.vehicle.class_name,
            brand: params.vehicle.brand,
            model: params.vehicle.model,
          }
        : undefined,
      current_part: params.part
        ? {
            part_id: params.part.part_id,
            name: params.part.name,
          }
        : undefined,
      city: params.city,
    }),
  })
  if (!response.ok) {
    throw new Error(`问答请求失败：${response.status}`)
  }
  return response.json()
}
