from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class PhysicalInfo(BaseModel):
    title: str
    description: str
    selling_points: list[str] = []


class PartDetection(BaseModel):
    part_id: str
    name: str
    confidence: float
    method: str
    bbox: list[int]
    anchor: list[int]
    physical_info: PhysicalInfo


class VehicleDetection(BaseModel):
    track_id: int
    class_name: str
    confidence: float
    bbox: list[int]
    model: str = "演示车型"
    parts: list[PartDetection]


class DetectResponse(BaseModel):
    frame_id: int
    width: int
    height: int
    latency_ms: int
    detector: str
    mode: str
    vehicles: list[VehicleDetection]


class CurrentVehicle(BaseModel):
    track_id: Optional[int] = None
    class_name: Optional[str] = None
    model: Optional[str] = "演示车型"


class CurrentPart(BaseModel):
    part_id: Optional[str] = None
    name: Optional[str] = None


class ChatRequest(BaseModel):
    question: str
    current_vehicle: Optional[CurrentVehicle] = None
    current_part: Optional[CurrentPart] = None
    city: str = "北京"


class Offer(BaseModel):
    id: str
    model: str
    city: str
    dealer: str
    title: str
    description: str
    cash_discount: int = 0
    gift: list[str] = []
    finance_policy: str = ""
    valid_until: str
    sales_note: str = ""


class ChatResponse(BaseModel):
    answer: str
    intent: str
    related_offers: list[Offer] = []
