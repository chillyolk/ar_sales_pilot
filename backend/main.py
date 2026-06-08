from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.detect import router as detect_router
from app.api.offers import router as offers_router

load_dotenv()

app = FastAPI(title="AR AI 汽车导购 Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detect_router)
app.include_router(chat_router)
app.include_router(offers_router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
