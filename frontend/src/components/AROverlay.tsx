import type { DetectResponse, PartDetection, VehicleDetection } from '../types'

type Props = {
  detection: DetectResponse | null
  selectedPart?: PartDetection
  onSelectPart: (vehicle: VehicleDetection, part: PartDetection) => void
}

type Slot = {
  y: number
  side: 'right'
}

type CalloutLayout = {
  side: 'left' | 'right'
  marker: { left: string; top: string }
  card: { right: string; top: string }
  path: string
}

const CARD_WIDTH_PX = 220
const CARD_RIGHT_PX = 20

const FIXED_CARD_SLOTS: Record<string, Slot> = {
  windshield: { y: 8, side: 'right' },
  hood: { y: 26, side: 'right' },
  headlight: { y: 44, side: 'right' },
  side_window: { y: 62, side: 'right' },
  wheel: { y: 80, side: 'right' },
}

const PART_TITLE: Record<string, string> = {
  windshield: '前挡风玻璃',
  hood: '引擎盖',
  wheel: '轮毂',
  side_window: '侧窗',
  headlight: '前大灯',
}

const PART_TAGS: Record<string, string[]> = {
  windshield: ['开阔视野', '低风阻', '座舱通透', '安全视野'],
  hood: ['前备箱', '低机舱', '空间利用', '轻量布局'],
  wheel: ['低风阻', '运动姿态', '续航效率', '操控质感'],
  side_window: ['低腰线', '侧向视野', '后排通透', '采光舒适'],
  headlight: ['矩阵全LED', '高清透镜', '自适应调光', '转向补光'],
}

function basePartId(partId: string) {
  return partId.replace(/_(left|right|\d+)$/, '')
}

function shouldRenderMask(part: PartDetection) {
  return basePartId(part.part_id) !== 'body'
}

function cardTitle(part: PartDetection) {
  return PART_TITLE[basePartId(part.part_id)] ?? part.name
}

function cardTags(part: PartDetection) {
  return PART_TAGS[basePartId(part.part_id)] ?? part.physical_info.selling_points.slice(0, 4)
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
  const slot = FIXED_CARD_SLOTS[basePartId(part.part_id)] ?? { y: 80, side: 'right' as const }
  const cardLeftPercent = ((sourceWidth - CARD_RIGHT_PX - CARD_WIDTH_PX) / sourceWidth) * 100
  const titleGapPercent = (6 / sourceWidth) * 100
  const lineEndX = cardLeftPercent - titleGapPercent
  const lineEndY = slot.y + 2.2
  const bendX = Math.min(Math.max(point.x + 8, point.x), lineEndX - 4)
  const path = `M ${point.x} ${point.y} L ${bendX} ${point.y} L ${bendX} ${lineEndY} L ${lineEndX} ${lineEndY}`

  return {
    side: slot.side,
    marker: { left: `${point.x}%`, top: `${point.y}%` },
    card: { right: `${CARD_RIGHT_PX}px`, top: `${slot.y}%` },
    path,
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
          polygon && shouldRenderMask(part) && selectedPart?.part_id === part.part_id ? (
            <polygon
              key={`${vehicle.track_id}-${part.part_id}-polygon`}
              points={polygon}
              className={`part-mask ${selectedPart?.part_id === part.part_id ? 'active' : ''}`}
            />
          ) : null
        ))}
        {cardCallouts.map(({ vehicle, part, layout }) => (
          <path
            key={`${vehicle.track_id}-${part.part_id}-line`}
            d={layout.path}
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
            <strong>{cardTitle(part)}</strong>
            <div className="part-tags">
              {cardTags(part).map((tag) => (
                <span className="part-tag" key={tag}>{tag}</span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
