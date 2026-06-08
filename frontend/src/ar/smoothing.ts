import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

function smoothBox(previous: [number, number, number, number], next: [number, number, number, number], alpha: number) {
  return next.map((value, index) => Math.round(previous[index] * (1 - alpha) + value * alpha)) as [number, number, number, number]
}

function smoothAnchor(previous: [number, number], next: [number, number], alpha: number) {
  return next.map((value, index) => Math.round(previous[index] * (1 - alpha) + value * alpha)) as [number, number]
}

function smoothParts(previous: PartDetection[], next: PartDetection[], alpha: number) {
  return next.map((part) => {
    const matched = previous.find((item) => item.part_id === part.part_id)
    if (!matched) {
      return part
    }
    return {
      ...part,
      bbox: smoothBox(matched.bbox, part.bbox, alpha),
      anchor: smoothAnchor(matched.anchor, part.anchor, alpha),
    }
  })
}

export function smoothDetection(previous: DetectResponse | null, next: DetectResponse, alpha = 0.45): DetectResponse {
  if (!previous) {
    return next
  }
  const vehicles: VehicleDetection[] = next.vehicles.map((vehicle) => {
    const matched = previous.vehicles.find((item) => item.track_id === vehicle.track_id)
    if (!matched) {
      return vehicle
    }
    return {
      ...vehicle,
      bbox: smoothBox(matched.bbox, vehicle.bbox, alpha),
      parts: smoothParts(matched.parts, vehicle.parts, alpha),
    }
  })
  return { ...next, vehicles }
}
