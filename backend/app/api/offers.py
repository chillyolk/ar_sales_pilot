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

    def matches(offer: dict, allow_demo: bool) -> bool:
        if model and offer.get("model") != model:
            if not allow_demo or offer.get("model") != "演示车型":
                return False
        if city and offer.get("city") != city:
            return False
        return True

    exact = [offer for offer in offers if matches(offer, allow_demo=False)]
    if exact:
        return exact
    return [offer for offer in offers if matches(offer, allow_demo=True)]


@router.get("/api/offers")
def get_offers(model: Optional[str] = None, city: Optional[str] = "北京", part: Optional[str] = None) -> dict:
    return {"offers": find_offers(model=model, city=city, part=part)}
