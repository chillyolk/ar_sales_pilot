import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.cv.frame_utils import read_image
from app.cv.vehicle_detector import VehicleDetector
from app.schemas import DetectResponse

router = APIRouter()
detector = VehicleDetector()


@router.post("/api/detect-frame", response_model=DetectResponse)
async def detect_frame(
    frame: UploadFile = File(...),
    frame_id: int = Form(...),
    video_time: float = Form(0),
    width: int = Form(0),
    height: int = Form(0),
) -> DetectResponse:
    started = time.perf_counter()
    try:
        image = await read_image(frame)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    image_height, image_width = image.shape[:2]
    vehicles = detector.detect(image)
    latency_ms = round((time.perf_counter() - started) * 1000)
    return DetectResponse(
        frame_id=frame_id,
        width=width or image_width,
        height=height or image_height,
        latency_ms=latency_ms,
        detector=detector.model_name,
        mode="realtime frame detection",
        vehicles=vehicles,
    )
