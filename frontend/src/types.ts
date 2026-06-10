export type PhysicalInfo = {
  title: string
  description: string
  selling_points: string[]
}

export type PartDetection = {
  part_id: string
  name: string
  confidence: number
  method: string
  bbox: [number, number, number, number]
  anchor: [number, number]
  physical_info: PhysicalInfo
  polygon?: [number, number][]
}

export type VehicleDetection = {
  track_id: number
  class_name: string
  confidence: number
  bbox: [number, number, number, number]
  brand: string
  model: string
  parts: PartDetection[]
}

export type VehicleProfile = {
  brand: string
  model: string
  label: string
}

export type DetectResponse = {
  frame_id: number
  width: number
  height: number
  latency_ms: number
  detector: string
  mode: string
  vehicles: VehicleDetection[]
}

export type Offer = {
  id: string
  model: string
  city: string
  dealer: string
  title: string
  description: string
  cash_discount: number
  gift: string[]
  finance_policy: string
  valid_until: string
  sales_note: string
}

export type ChatResponse = {
  answer: string
  intent: string
  related_offers: Offer[]
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}
