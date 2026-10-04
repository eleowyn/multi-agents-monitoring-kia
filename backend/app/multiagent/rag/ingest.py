import os
import json
from typing import List, Dict, Any
from pypdf import PdfReader
from app.core.config import settings
from app.multiagent.rag.vectorstore import get_or_create_collection

KNOWLEDGE_BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "knowledge_base")
)
os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)

# Dataset Baku Klinis (Buku KIA & PNPK Stunting KMK 1928/2022)
DEFAULT_CLINICAL_GUIDELINES = [
    {
        "id": "kia_stunting_01",
        "category": "STUNTING_GIZI",
        "source": "Pedoman Nasional Pelayanan Kedokteran Tata Laksana Stunting (KMK No. HK.01.07/Menkes/1928/2022)",
        "section": "Tata Laksana Balita Stunting dan Gizi Kurang",
        "page": 18,
        "content": (
            "Balita dengan status stunting (PB/U atau TB/U < -2 SD) dan gizi kurang (BB/PB < -2 SD) "
            "memerlukan intervensi gizi spesifik segera. Kader Posyandu harus merujuk anak ke Puskesmas "
            "untuk konfirmasi klinis oleh dokter/tenaga gizi. Berikan edukasi pemberian Makanan Tambahan Pemulihan (PMT-P) "
            "berbasis pangan lokal kaya protein hewani (telur, ikan, daging) minimal 1 butir telur per hari, "
            "serta pemantauan kenaikan berat badan (weight faltering) setiap 2 minggu."
        )
    },
    {
        "id": "kia_stunting_02",
        "category": "STUNTING_PENCEGAHAN",
        "source": "Buku KIA Kesehatan Anak (Kemenkes RI 2020)",
        "section": "Pemantauan Pertumbuhan dan Perkembangan Baduta",
        "page": 32,
        "content": (
            "Pencegahan stunting pada fase baduta (6-24 bulan) berfokus pada pemberian ASI Eksklusif hingga 6 bulan "
            "dilanjutkan MP-ASI yang adekuat secara kualitas dan kuantitas. MP-ASI harus mengandung zat gizi makro dan mikro, "
            "terutama zat besi dan zink dari sumber hewani. Pastikan kebersihan sanitasi air minum dan cuci tangan pakai sabun (CTPS) "
            "untuk mencegah infeksi berulang seperti diare kronis yang menjadi pemicu utama gagal tumbuh."
        )
    },
    {
        "id": "kia_maternal_kek",
        "category": "MATERNAL_KEK",
        "source": "Buku KIA Kesehatan Ibu Hamil (Kemenkes RI 2020)",
        "section": "Perawatan Ibu Hamil dengan Kurang Energi Kronis (KEK)",
        "page": 14,
        "content": (
            "Ibu hamil dengan Lingkar Lengan Atas (LiLA) < 23.5 cm dinyatakan mengalami Kurang Energi Kronis (KEK). "
            "KEK meningkatkan risiko Bayi Berat Lahir Rendah (BBLR) dan stunting pada anak di kemudian hari. "
            "Tindakan kader: Berikan Makanan Tambahan (MT) Ibu Hamil kaya kalori dan protein selama 90 hari, "
            "anjurkan konsumsi porsi kecil tapi sering, serta jadwalkan pemeriksaan ANC minimal 6 kali selama kehamilan "
            "dengan pemantauan kenaikan berat badan ibu setiap bulan."
        )
    },
    {
        "id": "kia_maternal_anemia",
        "category": "MATERNAL_ANEMIA",
        "source": "Buku KIA Kesehatan Ibu Hamil (Kemenkes RI 2020)",
        "section": "Penanganan Anemia pada Kehamilan",
        "page": 16,
        "content": (
            "Ibu hamil dengan kadar Hemoglobin (Hb) < 11.0 g/dL (Trimester 1 & 3) atau < 10.5 g/dL (Trimester 2) "
            "mengalami anemia. Anemia berisiko memicu perdarahan postpartum, persalinan prematur, dan janin BBLR. "
            "Tindakan kader: Pastikan ibu meminum Tablet Tambah Darah (TTD) minimal 90 tablet selama kehamilan, "
            "diminum malam hari dengan air putih atau jus jeruk (hindari teh/kopi/susu saat minum TTD), "
            "serta tingkatkan konsumsi sayuran hijau gelap, hati ayam, dan daging merah."
        )
    },
    {
        "id": "kia_neonatal_bblr",
        "category": "NEONATAL_BBLR",
        "source": "Buku KIA Kesehatan Bayi Baru Lahir (Kemenkes RI 2020)",
        "section": "Perawatan Bayi Berat Lahir Rendah (BBLR) di Rumah",
        "page": 24,
        "content": (
            "Bayi dengan berat lahir < 2.500 gram (BBLR) rentan mengalami hipotermia, infeksi, dan gangguan pertumbuhan. "
            "Kader Posyandu mendampingi keluarga untuk: Menerapkan Perawatan Metode Kanguru (PMK) untuk menjaga kehangatan suhu tubuh bayi, "
            "memastikan pemberian ASI eksklusif sesering mungkin (setiap 2 jam), menunda memandikan bayi hingga suhu stabil, "
            "serta segera merujuk jika bayi tampak malas menyusu, kuning, atau napas cepat."
        )
    },
    {
        "id": "kia_maternal_kspr",
        "category": "MATERNAL_RISIKO_TINGGI",
        "source": "Pedoman Skrining Antenatal Poedji Rochjati (Kemenkes RI)",
        "section": "Rujukan dan Tata Laksana Ibu Hamil Risiko Tinggi (KRT/KRST)",
        "page": 9,
        "content": (
            "Ibu hamil dengan Skor KSPR 6-10 (Kehamilan Risiko Tinggi/KRT) atau >= 12 (Kehamilan Risiko Sangat Tinggi/KRST) "
            "harus dirujuk untuk pemeriksaan Antenatal Care (ANC) oleh dokter spesialis obstetri/Puskesmas mampu PONED. "
            "Kader Posyandu bertugas memantau kepatuhan kontrol kehamilan, mengedukasi tanda bahaya kehamilan (perdarahan, sakit kepala hebat, "
            "pandangan kabur, kejang), serta menyusun Perencanaan Persalinan dan Pencegahan Komplikasi (P4K) termasuk calon donor darah."
        )
    }
]


def ingest_knowledge_base():
    """
    Mengindeks dokumen rujukan Buku KIA & PNPK ke dalam ChromaDB.
    """
    collection = get_or_create_collection()
    
    # 1. Ingest Data Standar Baku
    documents = []
    metadatas = []
    ids = []
    
    for item in DEFAULT_CLINICAL_GUIDELINES:
        documents.append(item["content"])
        metadatas.append({
            "source": item["source"],
            "section": item["section"],
            "page": item["page"],
            "category": item["category"]
        })
        ids.append(item["id"])
    
    # 2. Ingest file PDF tambahan jika tersedia di knowledge_base/
    for filename in os.listdir(KNOWLEDGE_BASE_DIR):
        if filename.lower().endswith(".pdf"):
            pdf_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
            try:
                reader = PdfReader(pdf_path)
                for page_idx, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text and len(text.strip()) > 100:
                        doc_id = f"pdf_{filename}_{page_idx+1}"
                        documents.append(text[:1500]) # Batas potongan 1500 char per halaman
                        metadatas.append({
                            "source": filename,
                            "section": f"Halaman {page_idx+1}",
                            "page": page_idx + 1,
                            "category": "GENERAL_KIA"
                        })
                        ids.append(doc_id)
            except Exception as e:
                print(f"[INGEST ERROR] Gagal membaca PDF {filename}: {e}")

    # Simpan ke ChromaDB
    collection.upsert(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    print(f"[RAG INGEST] Berhasil mengindeks {len(ids)} potongan dokumen ke ChromaDB.")
    return len(ids)


if __name__ == "__main__":
    ingest_knowledge_base()

