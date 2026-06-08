import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

type Props = {
  detection: DetectResponse | null
  selectedPart?: PartDetection
  onSelectPart: (vehicle: VehicleDetection, part: PartDetection) => void
}

function scaleBox(box: [number, number, number, number], sourceWidth: number, sourceHeight: number) {
  const [x1, y1, x2, y2] = box
  return {
    left: `${(x1 / sourceWidth) * 100}%`,
    top: `${(y1 / sourceHeight) * 100}%`,
    width: `${((x2 - x1) / sourceWidth) * 100}%`,
    height: `${((y2 - y1) / sourceHeight) * 100}%`,
  }
}

function scaleAnchor(anchor: [number, number], sourceWidth: number, sourceHeight: number) {
  return {
    left: `${(anchor[0] / sourceWidth) * 100}%`,
    top: `${(anchor[1] / sourceHeight) * 100}%`,
  }
}

export default function AROverlay({ detection, selectedPart, onSelectPart }: Props) {
  if (!detection) {
    return <div className="ar-overlay idle">等待实时帧识别...</div>
  }

  return (
    <div className="ar-overlay">
      <div className="scan-line" />
      {detection.vehicles.map((vehicle) => (
        <div key={vehicle.track_id}>
          <div className="vehicle-box" style={scaleBox(vehicle.bbox, detection.width, detection.height)}>
            <span>Track #{vehicle.track_id} · {vehicle.class_name} · {(vehicle.confidence * 100).toFixed(0)}%</span>
          </div>
          {vehicle.parts.map((part) => {
            const active = selectedPart?.part_id === part.part_id
            return (
              <button
                key={`${vehicle.track_id}-${part.part_id}`}
                className={`part-box ${active ? 'active' : ''}`}
                style={scaleBox(part.bbox, detection.width, detection.height)}
                onClick={() => onSelectPart(vehicle, part)}
                type="button"
              >
                <span className="part-dot" />
                <span className="part-label">{part.name}</span>
              </button>
            )
          })}
          {vehicle.parts.slice(0, 4).map((part, index) => {
            const position = scaleAnchor(part.anchor, detection.width, detection.height)
            return (
              <div key={`${vehicle.track_id}-${part.part_id}-card`} className={`info-card card-${index}`} style={position}>
                <strong>{part.physical_info.title}</strong>
                <p>{part.physical_info.description}</p>
                <small>{part.method} · {(part.confidence * 100).toFixed(0)}%</small>
              </div>
            )
          })}
        </div>
      ))}
      <div className="debug-panel">
        <div>Detection: {detection.detector}</div>
        <div>Frame ID: {detection.frame_id}</div>
        <div>Latency: {detection.latency_ms}ms</div>
        <div>Vehicles: {detection.vehicles.length}</div>
        <div>Parts: geometry estimated</div>
        <div>Mode: {detection.mode}</div>
      </div>
    </div>
  )
}
