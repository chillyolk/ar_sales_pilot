from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

import requests

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def load_knowledge() -> dict:
    with (DATA_DIR / "vehicle_knowledge.json").open("r", encoding="utf-8") as file:
        return json.load(file)


def detect_intent(question: str) -> str:
    offer_words = ["优惠", "降价", "补贴", "折扣", "活动", "权益", "便宜", "多少钱"]
    if any(word in question for word in offer_words):
        return "offer_query"
    return "part_or_vehicle_query"


def fallback_answer(question: str, part_id: Optional[str], part_name: Optional[str], offers: list[dict]) -> str:
    if offers:
        offer = offers[0]
        gifts = "、".join(offer.get("gift", []))
        return (
            f"当前门店针对{offer.get('model', '这款车')}有{offer.get('cash_discount', 0)}元现金优惠，"
            f"并包含{gifts}等权益。{offer.get('finance_policy', '')}"
        )

    knowledge = load_knowledge()
    key = part_id or "body"
    data = knowledge.get(key, knowledge.get("body", {}))
    title = data.get("title", part_name or "当前部位")
    description = data.get("description", "当前画面聚焦到车辆相关区域。")
    points = "、".join(data.get("selling_points", []))
    if points:
        return f"当前画面聚焦到{part_name or title}区域。{description}主要好处是{points}。"
    return f"当前画面聚焦到{part_name or title}区域。{description}"


def ask_llm(question: str, vehicle: dict, part: dict, offers: list[dict]) -> Optional[str]:
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        return None

    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    prompt = (
        "你是懂车帝智能汽车导购。回答要简洁，适合语音播报。"
        "优先使用本地优惠和车辆知识，不要编造优惠。"
        "如果部位来自 geometry，表达为当前画面聚焦到该区域，不要说成高精度识别。\n"
        f"用户问题：{question}\n"
        f"当前车辆：{vehicle}\n"
        f"当前部位：{part}\n"
        f"本地优惠：{offers}\n"
    )
    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
            },
            timeout=12,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None
