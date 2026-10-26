from fastapi import APIRouter
from app.api.v1.endpoints import auth, patients, visits, reports, admin, revisions, kader

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autentikasi"])
api_router.include_router(kader.router, prefix="/kader", tags=["Dashboard Kader"])
api_router.include_router(patients.router, prefix="/patients", tags=["Data Pasien"])
api_router.include_router(visits.router, prefix="/visits", tags=["Kunjungan & Analisis AI"])
api_router.include_router(reports.router, prefix="/reports", tags=["Validasi Laporan & PDF"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin Puskesmas"])
api_router.include_router(revisions.router, prefix="/revisions", tags=["Pengajuan Revisi Kunjungan"])

