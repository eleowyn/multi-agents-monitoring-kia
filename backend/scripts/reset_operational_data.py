import os
import sys

# Tambahkan direktori root backend ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.report import Report
from app.models.revision import RevisionRequest
from app.models.audit_log import AuditLog
from app.models.user import User


def reset_all_operational_data():
    db = SessionLocal()
    try:
        print("=== MEMULAI PEMBERSIHAN DATA OPERASIONAL ===")
        
        # 1. Hitung data sebelum dihapus
        total_revisions = db.query(RevisionRequest).count()
        total_audits = db.query(AuditLog).count()
        total_reports = db.query(Report).count()
        total_visits = db.query(Visit).count()
        total_patients = db.query(Patient).count()
        total_users = db.query(User).count()

        print(f"Data awal ditemukan:")
        print(f" - Pasien: {total_patients}")
        print(f" - Kunjungan: {total_visits}")
        print(f" - Laporan KIA: {total_reports}")
        print(f" - Pengajuan Revisi: {total_revisions}")
        print(f" - Audit Log AI: {total_audits}")
        print(f" - Akun Pengguna (Akan DIPERTAHANKAN): {total_users}")

        # 2. Hapus pengajuan revisi
        print("\nMenghapus seluruh pengajuan revisi...")
        db.query(RevisionRequest).delete(synchronize_session=False)

        # 3. Hapus audit log
        print("Menghapus seluruh audit log...")
        db.query(AuditLog).delete(synchronize_session=False)

        # 4. Hapus laporan KIA
        print("Menghapus seluruh laporan KIA...")
        db.query(Report).delete(synchronize_session=False)

        # 5. Hapus rekam kunjungan
        print("Menghapus seluruh rekam kunjungan...")
        db.query(Visit).delete(synchronize_session=False)

        # 6. Lepas foreign key mother_id antar pasien
        print("Melepaskan relasi mother_id pada tabel pasien...")
        db.query(Patient).update({Patient.mother_id: None}, synchronize_session=False)

        # 7. Hapus seluruh pasien
        print("Menghapus seluruh data pasien...")
        db.query(Patient).delete(synchronize_session=False)

        # Commit ke database
        db.commit()
        print("Pembersihan database berhasil di-commit!")

        # 8. Hapus file PDF di generated_reports jika ada
        pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "generated_reports"))
        deleted_pdf_count = 0
        if os.path.exists(pdf_dir):
            for fname in os.listdir(pdf_dir):
                if fname.lower().endswith(".pdf"):
                    fpath = os.path.join(pdf_dir, fname)
                    try:
                        os.remove(fpath)
                        deleted_pdf_count += 1
                    except Exception as e:
                        print(f"Gagal menghapus file {fname}: {e}")
        print(f"File PDF laporan dihapus: {deleted_pdf_count} file.")

        # 9. Verifikasi akhir
        print("\n=== STATUS DATA SETELAH PEMBERSIHAN ===")
        print(f" - Pasien: {db.query(Patient).count()}")
        print(f" - Kunjungan: {db.query(Visit).count()}")
        print(f" - Laporan KIA: {db.query(Report).count()}")
        print(f" - Pengajuan Revisi: {db.query(RevisionRequest).count()}")
        print(f" - Audit Log AI: {db.query(AuditLog).count()}")
        print(f" - Akun Pengguna Tersedia:")
        users = db.query(User).all()
        for u in users:
            print(f"   * [{u.role.value}] Username: {u.username} | Nama: {u.full_name} | Wilayah: {u.village_name or '-'} ({u.posyandu_name or '-'})")

        print("\nSELURUH DATA OPERASIONAL BERHASIL DIRESET.")
        print("Sistem siap untuk pengujian alur baru dari awal!")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Pembersihan gagal, rollback dilakukan: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    reset_all_operational_data()
