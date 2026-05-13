"""
AI Financial Analyst - FastAPI Backend v2
Suppresses ChromaDB telemetry errors and starts the ingestion scheduler.
"""
import os
import logging

# Suppress ChromaDB telemetry errors before importing anything else
logging.getLogger("chromadb.telemetry").setLevel(logging.CRITICAL)
logging.getLogger("posthog").setLevel(logging.CRITICAL)
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"]     = "False"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from scheduler import start_scheduler
        start_scheduler()
        print("[main] Scheduler started")
    except Exception as e:
        print(f"[main] Scheduler failed: {e}")
    yield
    try:
        from scheduler import scheduler
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        pass


app = FastAPI(
    title="AI Financial Analyst API",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health():
    try:
        from scheduler import get_schedule_status
        return {"status": "ok", "version": "0.3.0", "schedule": get_schedule_status()}
    except Exception:
        return {"status": "ok", "version": "0.3.0"}
