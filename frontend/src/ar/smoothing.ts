import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

const DEFAULT_ALPHA = 0.28
const DEAD_ZONE_PX = 3
const MAX_MISSING_FRAMES = 0

type MutablePart = PartDetection & { missingFrames?: number }
type MutableVehicle = VehicleDetection & { missingFrames?: number; parts: MutablePart[] }

function smoothValue(previous: number, next: number, alpha: number) {
  if (Math.abs(previous - next) <= DEAD_ZONE_PX) {
    return previous
  }
  return previous * (1 - alpha) + next * alpha
}

function smoothBox(previous: [number, number, number, number], next: [number, number, number, number], alpha: number) {
  return next.map((value, index) => smoothValue(previous[index], value, alpha)) as [number, number, number, number]
}

function smoothAnchor(previous: [number, number], next: [number, number], alpha: number) {
  return next.map((value, index) => smoothValue(previous[index], value, alpha)) as [number, number]
}

function smoothParts(previous: MutablePart[], next: PartDetection[], alpha: number) {
  const merged: MutablePart[] = next.map((part) => {
    const matched = previous.find((item) => item.part_id === part.part_id)
    if (!matched) {
      return { ...part, missingFrames: 0 }
    }
    if (part.method.startsWith('segmentation') || part.method.startsWith('tracking')) {
      return { ...part, missingFrames: 0 }
    }
    return {
      ...part,
      bbox: smoothBox(matched.bbox, part.bbox, alpha),
      anchor: smoothAnchor(matched.anchor, part.anchor, alpha),
      missingFrames: 0,
    }
  })

  previous.forEach((part) => {
    if (next.some((item) => item.part_id === part.part_id)) {
      return
    }
    const missingFrames = (part.missingFrames ?? 0) + 1
    if (missingFrames <= MAX_MISSING_FRAMES) {
      merged.push({ ...part, missingFrames })
    }
  })

  return merged
}

export function smoothDetection(previous: DetectResponse | null, next: DetectResponse, alpha = DEFAULT_ALPHA): DetectResponse {
  if (!previous) {
    return next
  }

  const previousVehicles = previous.vehicles as MutableVehicle[]
  const vehicles: MutableVehicle[] = next.vehicles.map((vehicle) => {
    const matched = previousVehicles.find((item) => item.track_id === vehicle.track_id)
    if (!matched) {
      return { ...vehicle, missingFrames: 0 }
    }
    return {
      ...vehicle,
      bbox: smoothBox(matched.bbox, vehicle.bbox, alpha),
      parts: smoothParts(matched.parts, vehicle.parts, alpha * 0.75),
      missingFrames: 0,
    }
  })

  previousVehicles.forEach((vehicle) => {
    if (next.vehicles.some((item) => item.track_id === vehicle.track_id)) {
      return
    }
    const missingFrames = (vehicle.missingFrames ?? 0) + 1
    if (missingFrames <= MAX_MISSING_FRAMES) {
      vehicles.push({ ...vehicle, missingFrames })
    }
  })

  return { ...next, vehicles }
}
