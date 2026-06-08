import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

type Props = {
  detection: DetectResponse | null
  selectedPart?: PartDetection
  onSelectPart: (vehicle: VehicleDetection, part: PartDetection) => void
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

function calloutStyle(part: PartDetection, sourceWidth: number, sourceHeight: number) {
  const point = toPercent(part.anchor, sourceWidth, sourceHeight)
  const side = point.x > 58 ? 'left' : 'right'
  const cardX = side === 'right' ? Math.min(point.x + 5, 70) : Math.max(point.x - 33, 3)
  const cardY = Math.min(Math.max(point.y - 8, 8), 74)
  const dx = side === 'right' ? cardX - point.x : point.x - cardX
  const dy = cardY + 8 - point.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, side === 'right' ? dx : -dx) * (180 / Math.PI)

  return {
    side,
    marker: { left: `${point.x}%`, top: `${point.y}%` },
    card: { left: `${cardX}%`, top: `${cardY}%` },
    line: {
      left: `${point.x}%`,
      top: `${point.y}%`,
      width: `${length}%`,
      transform: `rotate(${side === 'right' ? angle : 180 - angle}deg)`,
    },
  }
}

export default function AROverlay({ detection, selectedPart, onSelectPart }: Props) {
  if (!detection) {
    return <div className="ar-overlay idle">等待实时帧识别...</div>
  }

  return (
    <div className="ar-overlay">
      <div className="scan-line subtle" />
      {detection.vehicles.map((vehicle) => {
        const visibleParts = vehicle.parts.filter(
          (part) => isAnchorVisible(part.anchor, detection.width, detection.height)
            && doesBoxIntersectViewport(part.bbox, detection.width, detection.height),
        )
        const highlighted = visibleParts.slice(0, 4)
        return (
          <div key={vehicle.track_id}>
            {highlighted.map((part) => {
              const active = selectedPart?.part_id === part.part_id
              const style = calloutStyle(part, detection.width, detection.height)
              return (
                <div className={`part-callout ${style.side} ${active ? 'active' : ''}`} key={`${vehicle.track_id}-${part.part_id}`}>
                  <button
                    className="part-marker"
                    style={style.marker}
                    onClick={() => onSelectPart(vehicle, part)}
                    title={part.name}
                    type="button"
                  >
                    <span>{part.name}</span>
                  </button>
                  <div className="part-connector" style={style.line} />
                  <button
                    className="part-info-card"
                    style={style.card}
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
          </div>
        )
      })}
      <div className="debug-panel compact">
        <div>Detection: {detection.detector}</div>
        <div>Frame ID: {detection.frame_id}</div>
        <div>Latency: {detection.latency_ms}ms</div>
        <div>Vehicles: {detection.vehicles.length}</div>
        <div>Mode: {detection.mode}</div>
      </div>
    </div>
  )
}
