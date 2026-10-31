import os
import re
from typing import List, Dict, Any, Tuple, Optional
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


def chunk_text(text: str, size: int, overlap: int) -> List[str]:
    """
    Memecah teks menjadi potongan berukuran `size` karakter dengan tumpang-tindih
    `overlap` karakter. Batas potongan digeser ke spasi terdekat agar kata tidak terpotong.
    """
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= size:
        return [text] if text else []
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + size // 2, end)
            if space != -1:
                end = space
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if c]


def chunk_markdown_file(
    file_path: str,
    doc_source: str,
    doc_prefix: str,
    default_category: str = "GENERAL_KIA"
) -> List[Dict[str, Any]]:
    """
    Memotong berkas Markdown (.md) berbasis struktur heading (#, ##, ###),
    mempertahankan tabel dan daftar secara utuh, serta memperkirakan nomor halaman.
    """
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    sections = re.split(r"\n(?=#{1,4}\s+)", content)
    chunks: List[Dict[str, Any]] = []
    current_page = 1
    page_re = re.compile(r"(?:KIA 2024 Book 2\.17\.5\s+(\d+)|-\s*(\d+)\s*-)")

    for sec_idx, sec in enumerate(sections):
        sec_text = sec.strip()
        if not sec_text or len(sec_text) < 40:
            continue
        p_match = page_re.search(sec_text)
        if p_match:
            current_page = int(p_match.group(1) or p_match.group(2))

        first_line = sec_text.split("\n")[0]
        header = re.sub(r"^[#\s]+", "", first_line).strip()
        header = re.sub(r"<[^>]+>", "", header).strip()
        clean_text = re.sub(r"!\[.*?\]\(.*?\)", "", sec_text).strip()
        if len(clean_text) < 50:
            continue

        cat = default_category
        lower_h = (header + " " + clean_text[:200]).lower()
        if "stunting" in lower_h or "gizi buruk" in lower_h or "gizi kurang" in lower_h:
            cat = "STUNTING_GIZI"
        elif "ibu hamil" in lower_h or "trimester" in lower_h or "kek" in lower_h or "anemia" in lower_h or "ttd" in lower_h or "lila" in lower_h:
            cat = "MATERNAL_KEK_ANEMIA"
        elif "bayi baru lahir" in lower_h or "bblr" in lower_h or "neonatus" in lower_h or "metode kanguru" in lower_h:
            cat = "NEONATAL_BBLR"
        elif "mp-asi" in lower_h or "asi" in lower_h or "baduta" in lower_h or "kms" in lower_h:
            cat = "BADUTA_GIZI"

        if len(clean_text) <= 1200:
            chunks.append({
                "id": f"{doc_prefix}_{sec_idx}_0",
                "source": doc_source,
                "section": header or f"Bagian {sec_idx}",
                "page": current_page,
                "category": cat,
                "origin": "MARKDOWN_DOC",
                "content": clean_text
            })
        else:
            parts = [clean_text[i:i + 1000] for i in range(0, len(clean_text), 850)]
            for p_idx, part in enumerate(parts):
                chunks.append({
                    "id": f"{doc_prefix}_{sec_idx}_{p_idx}",
                    "source": doc_source,
                    "section": f"{header} (Bagian {p_idx + 1})",
                    "page": current_page,
                    "category": cat,
                    "origin": "MARKDOWN_DOC",
                    "content": part
                })
    return chunks


def _collect_documents() -> Tuple[List[str], List[Dict[str, Any]], List[str]]:
    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    ids: List[str] = []

    # 1. Ringkasan pedoman terkurasi baku
    for item in DEFAULT_CLINICAL_GUIDELINES:
        documents.append(item["content"])
        metadatas.append({
            "source": item["source"],
            "section": item["section"],
            "page": item["page"],
            "category": item["category"],
            "origin": "CURATED_SUMMARY",
        })
        ids.append(item["id"])

    # 2. Prioritas 1: Dokumen Markdown (.md) resmi di knowledge_base/
    md_files = [f for f in sorted(os.listdir(KNOWLEDGE_BASE_DIR)) if f.lower().endswith(".md")]
    has_markdown = len(md_files) > 0

    if has_markdown:
        for filename in md_files:
            file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
            doc_prefix = "md_kia24" if "kia" in filename.lower() else "md_pnpk22"
            doc_source = (
                "Buku KIA 2024 (Kemenkes RI)"
                if "kia" in filename.lower()
                else "Pedoman Nasional Pelayanan Kedokteran Tata Laksana Stunting (KMK No. HK.01.07/Menkes/1928/2022)"
            )
            md_chunks = chunk_markdown_file(file_path, doc_source, doc_prefix)
            for c in md_chunks:
                documents.append(c["content"])
                metadatas.append({
                    "source": c["source"],
                    "section": c["section"],
                    "page": c["page"],
                    "category": c["category"],
                    "origin": c["origin"],
                })
                ids.append(c["id"])

    # 3. Prioritas 2 (Fallback): PDF di knowledge_base/ jika tidak ada markdown
    if not has_markdown:
        excluded = {f.strip().lower() for f in settings.RAG_EXCLUDED_FILES.split(",") if f.strip()}
        for filename in sorted(os.listdir(KNOWLEDGE_BASE_DIR)):
            if not filename.lower().endswith(".pdf") or filename.lower() in excluded:
                continue
            pdf_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
            try:
                reader = PdfReader(pdf_path)
            except Exception as e:
                print(f"[INGEST ERROR] Gagal membaca PDF {filename}: {e}")
                continue
            for page_idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if len(text.strip()) <= 100:
                    continue
                for chunk_idx, chunk in enumerate(
                    chunk_text(text, settings.RAG_CHUNK_SIZE, settings.RAG_CHUNK_OVERLAP)
                ):
                    documents.append(chunk)
                    metadatas.append({
                        "source": filename,
                        "section": f"Halaman {page_idx + 1}",
                        "page": page_idx + 1,
                        "category": "GENERAL_KIA",
                        "origin": "PDF",
                    })
                    ids.append(f"pdf_{filename}_{page_idx + 1}_{chunk_idx}")

    return documents, metadatas, ids


def get_all_knowledge_chunks(
    search: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Menyediakan daftar seluruh chunk rujukan klinis untuk ditampilkan
    pada antarmuka web Dokter, Kader, dan pembuktian sidang dosen.
    """
    documents, metadatas, ids = _collect_documents()
    items = []
    for i in range(len(ids)):
        m = metadatas[i]
        c = documents[i]
        c_id = ids[i]

        if source and source.lower() not in m.get("source", "").lower():
            continue
        if category and category.upper() != m.get("category", "").upper():
            continue
        if search:
            s_low = search.lower()
            if s_low not in c.lower() and s_low not in m.get("section", "").lower() and s_low not in m.get("source", "").lower():
                continue

        items.append({
            "id": c_id,
            "source": m.get("source"),
            "section": m.get("section"),
            "page": m.get("page"),
            "category": m.get("category"),
            "origin": m.get("origin"),
            "content": c,
            "char_count": len(c),
            "estimated_tokens": max(1, len(c) // 4)
        })

    total = len(items)
    paged = items[skip:skip + limit]
    return {
        "total_chunks": total,
        "skip": skip,
        "limit": limit,
        "chunks": paged
    }


def ingest_knowledge_base() -> int:
    """
    Mengindeks dokumen rujukan Buku KIA & PNPK ke koleksi ChromaDB berembedding Gemini.

    Bersifat idempoten: hanya potongan yang belum tersimpan yang di-embed, sehingga
    pemanggilan ulang tidak menghabiskan kuota API. Mengembalikan jumlah total
    potongan yang ada di koleksi setelah ingest.
    """
    from app.multiagent.llm_utils import llm_available

    collection = get_or_create_collection()
    documents, metadatas, ids = _collect_documents()

    existing = set(collection.get(ids=ids, include=[])["ids"]) if ids else set()
    pending = [i for i, doc_id in enumerate(ids) if doc_id not in existing]
    if not pending:
        print(f"[RAG INGEST] Koleksi sudah lengkap ({collection.count()} potongan).")
        return collection.count()

    if not llm_available():
        print("[RAG INGEST] GEMINI_API_KEY tidak tersedia; ingest embedding Gemini dilewati.")
        return collection.count()

    from app.multiagent.rag.embeddings import embed_documents

    print(f"[RAG INGEST] Meng-embed {len(pending)} potongan baru dengan {settings.EMBEDDING_MODEL}...")
    step = settings.EMBEDDING_BATCH_SIZE
    for start in range(0, len(pending), step):
        batch = pending[start:start + step]
        vectors = embed_documents([documents[i] for i in batch])
        collection.upsert(
            ids=[ids[i] for i in batch],
            documents=[documents[i] for i in batch],
            metadatas=[metadatas[i] for i in batch],
            embeddings=vectors,
        )
        print(f"[RAG INGEST] {min(start + step, len(pending))}/{len(pending)} potongan tersimpan.")

    print(f"[RAG INGEST] Selesai. Total {collection.count()} potongan di koleksi '{collection.name}'.")
    return collection.count()


if __name__ == "__main__":
    ingest_knowledge_base()
