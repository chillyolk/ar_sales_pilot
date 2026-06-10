import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

type Props = {
  detection: DetectResponse | null
  selectedPart?: PartDetection
  onSelectPart: (vehicle: VehicleDetection, part: PartDetection) => void
}

type Slot = {
  x: number
  y: number
  side: 'left' | 'right'
}

type CalloutLayout = {
  side: 'left' | 'right'
  marker: { left: string; top: string }
  card: { left: string; top: string }
  line: { x1: number; y1: number; x2: number; y2: number }
}

const CARD_WIDTH_PERCENT = 25
const CARD_HEIGHT_PERCENT = 15

const FIXED_CARD_SLOTS: Record<string, Slot> = {
  windshield: { x: 72, y: 8, side: 'right' },
  hood: { x: 72, y: 28, side: 'right' },
  headlight: { x: 72, y: 52, side: 'right' },
  side_window: { x: 3, y: 8, side: 'left' },
  wheel: { x: 3, y: 58, side: 'left' },
}

function basePartId(partId: string) {
  return partId.replace(/_\d+$/, '')
}

function isRenderablePart(part: PartDetection) {
  return part.method.startsWith('segmentation') || part.method.startsWith('tracking')
}

function isPointVisible([x, y]: [number, number], sourceWidth: number, sourceHeight: number) {
  return x >= 0 && x <= sourceWidth && y >= 0 && y <= sourceHeight
}

function doesBoxIntersectViewport(box: [number, number, number, number], sourceWidth: number, sourceHeight: number) {
  const [x1, y1, x2, y2] = box
  return x2 > 0 && y2 > 0 && x1 < sourceWidth && y1 < sourceHeight
}

function polygonHasVisibleArea(polygon: [number, number][] | undefined, sourceWidth: number, sourceHeight: number) {
  if (!polygon?.length) {
    return false
  }
  const visiblePoints = polygon.filter((point) => isPointVisible(point, sourceWidth, sourceHeight)).length
  if (visiblePoints >= 3) {
    return true
  }
  const xs = polygon.map(([x]) => x)
  const ys = polygon.map(([, y]) => y)
  return doesBoxIntersectViewport(
    [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number],
    sourceWidth,
    sourceHeight,
  )
}

function isPartVisible(part: PartDetection, sourceWidth: number, sourceHeight: number) {
  if (!isRenderablePart(part)) {
    return false
  }
  if (part.polygon?.length) {
    return polygonHasVisibleArea(part.polygon, sourceWidth, sourceHeight)
  }
  return doesBoxIntersectViewport(part.bbox, sourceWidth, sourceHeight)
}

function toPercent(anchor: [number, number], sourceWidth: number, sourceHeight: number) {
  return {
    x: (anchor[0] / sourceWidth) * 100,
    y: (anchor[1] / sourceHeight) * 100,
  }
}

function polygonPoints(part: PartDetection, sourceWidth: number, sourceHeight: number) {
  if (!part.polygon?.length) {
    return ''
  }
  return part.polygon
    .map(([x, y]) => `${(x / sourceWidth) * 100},${(y / sourceHeight) * 100}`)
    .join(' ')
}

function calloutStyle(part: PartDetection, sourceWidth: number, sourceHeight: number): CalloutLayout {
  const point = toPercent(part.anchor, sourceWidth, sourceHeight)
  const slot = FIXED_CARD_SLOTS[basePartId(part.part_id)] ?? { x: 72, y: 72, side: 'right' as const }
  const lineEndX = slot.side === 'right' ? slot.x : slot.x + CARD_WIDTH_PERCENT
  const lineEndY = slot.y + CARD_HEIGHT_PERCENT / 2

  return {
    side: slot.side,
    marker: { left: `${point.x}%`, top: `${point.y}%` },
    card: { left: `${slot.x}%`, top: `${slot.y}%` },
    line: { x1: point.x, y1: point.y, x2: lineEndX, y2: lineEndY },
  }
}

export default function AROverlay({ detection, selectedPart, onSelectPart }: Props) {
  if (!detection) {
    return <div className="ar-overlay idle">等待实时帧识别...</div>
  }

  const markerCallouts = detection.vehicles.flatMap((vehicle) => (
    vehicle.parts
      .filter((part) => isPartVisible(part, detection.width, detection.height))
      .map((part) => ({
        vehicle,
        part,
        layout: calloutStyle(part, detection.width, detection.height),
        polygon: polygonPoints(part, detection.width, detection.height),
      }))
  ))

  const cardCallouts = Array.from(
    markerCallouts.reduce((items, callout) => {
      const key = `${callout.vehicle.track_id}-${basePartId(callout.part.part_id)}`
      const existing = items.get(key)
      if (!existing || callout.part.confidence > existing.part.confidence) {
        items.set(key, callout)
      }
      return items
    }, new Map<string, (typeof markerCallouts)[number]>()).values(),
  )

  return (
    <div className="ar-overlay">
      <div className="scan-line subtle" />
      <svg className="connector-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
        {markerCallouts.map(({ vehicle, part, polygon }) => (
          polygon ? (
            <polygon
              key={`${vehicle.track_id}-${part.part_id}-polygon`}
              points={polygon}
              className={`part-mask ${selectedPart?.part_id === part.part_id ? 'active' : ''}`}
            />
          ) : null
        ))}
        {cardCallouts.map(({ vehicle, part, layout }) => (
          <line
            key={`${vehicle.track_id}-${part.part_id}-line`}
            x1={layout.line.x1}
            y1={layout.line.y1}
            x2={layout.line.x2}
            y2={layout.line.y2}
            className="connector-line"
          />
        ))}
      </svg>
      {markerCallouts.map(({ vehicle, part, layout }) => {
        const active = selectedPart?.part_id === part.part_id
        return (
          <button
            className={`part-marker ${active ? 'active' : ''}`}
            key={`${vehicle.track_id}-${part.part_id}-marker`}
            style={layout.marker}
            onClick={() => onSelectPart(vehicle, part)}
            title={part.name}
            type="button"
          >
            <span>{part.name}</span>
          </button>
        )
      })}
      {cardCallouts.map(({ vehicle, part, layout }) => {
        const active = selectedPart?.part_id === part.part_id
        return (
          <button
            className={`part-info-card fixed ${layout.side} ${active ? 'active' : ''}`}
            key={`${vehicle.track_id}-${part.part_id}-card`}
            style={layout.card}
            onClick={() => onSelectPart(vehicle, part)}
            type="button"
          >
            <strong>{part.physical_info.title}</strong>
            <p>{part.physical_info.description}</p>
          </button>
        )
      })}
      <div className="debug-panel compact">
        <div>Detection: {detection.detector}</div>
        <div>Frame ID: {detection.frame_id}</div>
        <div>Latency: {detection.latency_ms}ms</div>
        <div>Vehicles: {detection.vehicles.length}</div>
        <div>Seg Parts: {markerCallouts.length}</div>
      </div>
    </div>
  )
}
