from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter

router = APIRouter()
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def load_offers() -> list[dict]:
    with (DATA_DIR / "offers.json").open("r", encoding="utf-8") as file:
        return json.load(file)


def find_offers(model: Optional[str] = None, city: Optional[str] = None, part: Optional[str] = None) -> list[dict]:
    offers = load_offers()
    result = []
    for offer in offers:
        if model and offer.get("model") not in {model, "演示车型"}:
            continue
        if city and offer.get("city") != city:
            continue
        if part and part.startswith("wheel") and "轮毂" not in offer.get("title", "") and "轮毂" not in offer.get("description", ""):
            if offer.get("id") != "offer_001":
                continue
        result.append(offer)
    return result


@router.get("/api/offers")
def get_offers(model: Optional[str] = None, city: Optional[str] = "北京", part: Optional[str] = None) -> dict:
    return {"offers": find_offers(model=model, city=city, part=part)}
