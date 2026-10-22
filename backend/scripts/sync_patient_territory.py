"""
Script sinkronisasi wilayah kerja pasien untuk testing & operasional.
Memastikan seluruh data pasien di database memiliki village_name dan posyandu_name
yang selaras dengan wilayah kerja Kader demo (Airmadidi Atas / Posyandu Mawar)
atau wilayah yang ditentukan, untuk mencegah HTTP 403 (Akses ditolak).
"""
import sys
import os

# Menambahkan root backend ke path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.models.patient import Patient


def sync_patients(target_village: str = "Airmadidi Atas", target_posyandu: str = "Posyandu Mawar"):
    db = SessionLocal()
    try:
        patients = db.query(Patient).all()
        print(f"[*] Total pasien ditemukan di database: {len(patients)}")
        
        updated_count = 0
        for p in patients:
            needs_update = False
            
            # Cek jika village_name kosong atau berbeda dengan wilayah target
            current_v = p.village_name or ""
            if not current_v or current_v.strip().lower() != target_village.strip().lower():
                print(f"[-] Pasien ID {p.id} ('{p.name}'): village '{p.village_name}' -> diubah ke '{target_village}'")
                p.village_name = target_village
                needs_update = True
                
            # Cek jika posyandu_name kosong atau berbeda
            current_pos = p.posyandu_name or ""
            if not current_pos or current_pos.strip().lower() != target_posyandu.strip().lower():
                print(f"[-] Pasien ID {p.id} ('{p.name}'): posyandu '{p.posyandu_name}' -> diubah ke '{target_posyandu}'")
                p.posyandu_name = target_posyandu
                needs_update = True
                
            if needs_update:
                updated_count += 1
                
        if updated_count > 0:
            db.commit()
            print(f"\n[SUKSES] Berhasil memperbarui {updated_count} pasien ke wilayah kerja '{target_village}' ({target_posyandu}).")
        else:
            print("\n[INFO] Seluruh data pasien sudah selaras dengan wilayah kerja target. Tidak ada perubahan yang diperlukan.")
            
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Gagal menyinkronkan data pasien: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    target_v = sys.argv[1] if len(sys.argv) > 1 else "Airmadidi Atas"
    target_p = sys.argv[2] if len(sys.argv) > 2 else "Posyandu Mawar"
    print(f"=== Menjalankan Sinkronisasi Wilayah Pasien ===")
    print(f"Target Desa: {target_v}")
    print(f"Target Posyandu: {target_p}\n")
    sync_patients(target_village=target_v, target_posyandu=target_p)
