from fastapi import APIRouter

from app.api.offers import find_offers
from app.llm.qa_service import ask_llm, detect_intent, fallback_answer
from app.schemas import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    vehicle = request.current_vehicle.model_dump() if request.current_vehicle else {"model": "演示车型"}
    part = request.current_part.model_dump() if request.current_part else {}
    intent = detect_intent(request.question)
    part_id = part.get("part_id")
    offers = []
    if intent == "offer_query":
        offers = find_offers(model=vehicle.get("model") or "演示车型", city=request.city, part=part_id)

    answer = ask_llm(request.question, vehicle, part, offers)
    if not answer:
        answer = fallback_answer(request.question, part_id, part.get("name"), offers)

    return ChatResponse(answer=answer, intent=intent, related_offers=offers)
