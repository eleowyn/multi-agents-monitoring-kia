import logging
import uvicorn
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine, Base, get_db, SessionLocal
from app.api.v1.router import api_router
from app.api.v1.endpoints.auth import seed_default_users
import app.models

logger = logging.getLogger("kia.errors")

app = FastAPI(
    title=settings.APP_NAME,
    description="Sistem Multi-Agent AI untuk Monitoring KIA pada 1.000 HPK di Posyandu Airmadidi",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


async def catch_unhandled_errors(request: Request, call_next):
    """
    Menangkap exception yang tidak tertangani dan mengembalikan JSON 500.
    Didaftarkan SEBELUM CORSMiddleware agar berada di dalamnya, sehingga respons
    error tetap membawa header CORS. Tanpa ini, browser memblokir respons 500
    dan frontend hanya menampilkan "Network Error".
    """
    try:
        return await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        detail = f"Kesalahan server: {type(exc).__name__}: {exc}" if settings.DEBUG else "Terjadi kesalahan pada server."
        return JSONResponse(status_code=500, content={"detail": detail})


app.add_middleware(BaseHTTPMiddleware, dispatch=catch_unhandled_errors)

# Setup CORS (ditambahkan terakhir = lapisan terluar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def on_startup():
    """Membuat tabel database dan menyemai user demo awal jika kosong."""
    try:
        Base.metadata.create_all(bind=engine)
        print(" [DATABASE] Seluruh tabel database MySQL berhasil diverifikasi/dibuat.")
        
        # Auto-seed users
        db = SessionLocal()
        try:
            seed_default_users(db)
        finally:
            db.close()
            
    except Exception as e:
        print(f" [DATABASE ERROR] Gagal inisialisasi: {e}")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "api_v1": settings.API_V1_STR,
        "docs": "/docs",
        "version": "1.1.0"
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {
        "status": "healthy",
        "database": "connected"
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
