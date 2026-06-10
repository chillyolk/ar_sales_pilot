import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

type Props = {
  detection: DetectResponse | null
  selectedPart?: PartDetection
  onSelectPart: (vehicle: VehicleDetection, part: PartDetection) => void
}

type CalloutLayout = {
  side: 'left' | 'right'
  marker: { left: string; top: string }
  card: { left: string; top: string }
  line: { x1: number; y1: number; x2: number; y2: number }
}

const CARD_WIDTH_PERCENT = 25
const CARD_HEIGHT_PERCENT = 15

function isRenderablePart(part: PartDetection) {
  return part.method.startsWith('segmentation') || part.method.startsWith('tracking')
}

function isAnchorVisible(anchor: [number, number], sourceWidth: number, sourceHeight: number) {
  return anchor[0] >= 0 && anchor[0] <= sourceWidth && anchor[1] >= 0 && anchor[1] <= sourceHeight
}

function doesBoxIntersectViewport(box: [number, number, number, number], sourceWidth: number, sourceHeight: number) {
  const [x1, y1, x2, y2] = box
  return x2 > 0 && y2 > 0 && x1 < sourceWidth && y1 < sourceHeight
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function calloutStyle(
  part: PartDetection,
  vehicle: VehicleDetection,
  sourceWidth: number,
  sourceHeight: number,
  index: number,
): CalloutLayout {
  const point = toPercent(part.anchor, sourceWidth, sourceHeight)
  const vehicleLeft = (vehicle.bbox[0] / sourceWidth) * 100
  const vehicleRight = (vehicle.bbox[2] / sourceWidth) * 100
  const leftSpace = vehicleLeft
  const rightSpace = 100 - vehicleRight
  const side = rightSpace >= leftSpace ? 'right' : 'left'
  const cardX = side === 'right' ? clamp(vehicleRight + 3, 3, 100 - CARD_WIDTH_PERCENT - 2) : clamp(vehicleLeft - CARD_WIDTH_PERCENT - 3, 3, 100 - CARD_WIDTH_PERCENT - 2)
  const stagger = (index % 4) * (CARD_HEIGHT_PERCENT + 2)
  const baseY = clamp(point.y - CARD_HEIGHT_PERCENT / 2, 3, 100 - CARD_HEIGHT_PERCENT - 3)
  const cardY = clamp(baseY + stagger, 3, 100 - CARD_HEIGHT_PERCENT - 3)
  const lineEndX = side === 'right' ? cardX : cardX + CARD_WIDTH_PERCENT
  const lineEndY = cardY + CARD_HEIGHT_PERCENT / 2

  return {
    side,
    marker: { left: `${point.x}%`, top: `${point.y}%` },
    card: { left: `${cardX}%`, top: `${cardY}%` },
    line: { x1: point.x, y1: point.y, x2: lineEndX, y2: lineEndY },
  }
}

export default function AROverlay({ detection, selectedPart, onSelectPart }: Props) {
  if (!detection) {
    return <div className="ar-overlay idle">等待实时帧识别...</div>
  }

  const callouts = detection.vehicles.flatMap((vehicle) => {
    const visibleParts = vehicle.parts.filter(
      (part) => isRenderablePart(part)
        && isAnchorVisible(part.anchor, detection.width, detection.height)
        && doesBoxIntersectViewport(part.bbox, detection.width, detection.height),
    )
    return visibleParts.map((part, index) => ({
      vehicle,
      part,
      layout: calloutStyle(part, vehicle, detection.width, detection.height, index),
      polygon: polygonPoints(part, detection.width, detection.height),
    }))
  })

  return (
    <div className="ar-overlay">
      <div className="scan-line subtle" />
      <svg className="connector-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
        {callouts.map(({ vehicle, part, polygon }) => (
          polygon ? (
            <polygon
              key={`${vehicle.track_id}-${part.part_id}-polygon`}
              points={polygon}
              className={`part-mask ${selectedPart?.part_id === part.part_id ? 'active' : ''}`}
            />
          ) : null
        ))}
        {callouts.map(({ vehicle, part, layout }) => (
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
      {callouts.map(({ vehicle, part, layout }) => {
        const active = selectedPart?.part_id === part.part_id
        return (
          <div className={`part-callout ${layout.side} ${active ? 'active' : ''}`} key={`${vehicle.track_id}-${part.part_id}`}>
            <button
              className="part-marker"
              style={layout.marker}
              onClick={() => onSelectPart(vehicle, part)}
              title={part.name}
              type="button"
            >
              <span>{part.name}</span>
            </button>
            <button
              className="part-info-card"
              style={layout.card}
              onClick={() => onSelectPart(vehicle, part)}
              type="button"
            >
              <strong>{part.physical_info.title}</strong>
              <p>{part.physical_info.description}</p>
              <small>{vehicle.brand} {vehicle.model} · {part.method} · {(part.confidence * 100).toFixed(0)}%</small>
            </button>
          </div>
        )
      })}
      <div className="debug-panel compact">
        <div>Detection: {detection.detector}</div>
        <div>Frame ID: {detection.frame_id}</div>
        <div>Latency: {detection.latency_ms}ms</div>
        <div>Vehicles: {detection.vehicles.length}</div>
        <div>Seg Parts: {callouts.length}</div>
      </div>
    </div>
  )
}
