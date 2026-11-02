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

# Dataset Baku Klinis Verbatim Murni (Buku KIA 2024 & PNPK Stunting KMK 1928/2022)
DEFAULT_CLINICAL_GUIDELINES = [
    {
        "id": "kia_stunting_01",
        "category": "STUNTING_GIZI",
        "source": "Pedoman Nasional Pelayanan Kedokteran Tata Laksana Stunting (KMK No. HK.01.07/Menkes/1928/2022)",
        "section": "Pencegahan Stunting Tingkat Kader dan Puskesmas",
        "page": 34,
        "content": (
            "Pencegahan primer dilakukan mulai dari tingkat kader di posyandu. Kader melakukan pemantauan pertumbuhan, "
            "pengukuran Panjang Badan atau Tinggi Badan (PB atau TB) dan Berat Badan (BB) menggunakan alat dan metode pengukuran standar, "
            "serta memberikan edukasi kepada orang tua/pengasuh mengenai pemberian ASI eksklusif dan MPASI dengan kandungan gizi lengkap "
            "terutama protein hewani. Saat pelaksanaan posyandu, diusahakan Pemberian Makanan Tambahan (PMT) yang mengandung protein hewani "
            "seperti telur, ayam, ikan, daging, susu dan produk olahan susu. Jika didapatkan anak dengan PB atau TB berdasarkan usia dan jenis "
            "kelamin <-2 SD, BB/U <- 2 SD, atau weight faltering (kenaikan berat tidak memadai) dan growth deceleration (perlambatan pertumbuhan linier), "
            "maka anak tersebut harus dirujuk ke Fasilitas Kesehatan Tingkat Pertama (FKTP) atau puskesmas."
        )
    },
    {
        "id": "kia_stunting_02",
        "category": "STUNTING_PENCEGAHAN",
        "source": "Buku KIA 2024 (Kemenkes RI)",
        "section": "Pemenuhan Gizi Usia 6 - 24 Bulan (Syarat MPASI)",
        "page": 31,
        "content": (
            "Melanjutkan pemberian ASI disertai Makanan Pendamping ASI (MPASI). Pemberian MPASI yang baik harus sesuai syarat berikut ini: "
            "1. Tepat waktu: MPASI diberikan saat ASI saja sudah tidak mencukupi kebutuhan gizi bayi (usia 6 bulan). "
            "2. Adekuat: MPASI memenuhi kebutuhan energi, protein, dan mikronutrien anak. Terutama protein hewani (ikan, telur, ayam, daging). "
            "3. Aman dan higienis: Disiapkan dan disimpan dengan cara yang bersih. "
            "4. Diberikan dengan cara yang benar: responsive feeding (peka terhadap tanda lapar dan kenyang anak)."
        )
    },
    {
        "id": "kia_maternal_kek",
        "category": "MATERNAL_KEK",
        "source": "Buku KIA 2024 (Kemenkes RI)",
        "section": "Pengukuran Lingkar Lengan Atas (LiLA) dan Pemantauan Gizi",
        "page": 26,
        "content": (
            "Pengukuran Lingkar Lengan Atas (LiLA) dilakukan pada ibu hamil dan anak untuk skrining, deteksi dini dan rujukan masalah gizi. "
            "Pada ibu hamil, batas LiLA kurang dari 23,5 cm mengindikasikan Kurang Energi Kronis (KEK) yang meningkatkan risiko berat lahir "
            "rendah (BBLR) dan stunting pada janin. Ibu hamil dengan KEK memerlukan konfirmasi pengukuran oleh tenaga kesehatan di fasilitas "
            "pelayanan kesehatan dan intervensi Pemberian Makanan Tambahan (PMT) pemulihan gizi."
        )
    },
    {
        "id": "kia_maternal_anemia",
        "category": "MATERNAL_ANEMIA",
        "source": "Buku KIA 2024 (Kemenkes RI)",
        "section": "Pencegahan Anemia dan Konsumsi Tablet Tambah Darah (TTD)",
        "page": 4,
        "content": (
            "Minum tablet tambah darah (TTD)/multivitamin setiap hari selama kehamilan minimal 90 tablet untuk mencegah anemia defisiensi "
            "zat besi. Minum pada malam hari sebelum tidur bersama air putih atau air jeruk, hindari minum bersama teh, kopi, atau susu "
            "karena dapat menghambat penyerapan zat besi. Kenali dan cek tanda bahaya kehamilan dan segera periksa ke fasilitas pelayanan "
            "kesehatan jika kadar Hemoglobin (Hb) di bawah 11 g/dL."
        )
    },
    {
        "id": "kia_neonatal_bblr",
        "category": "NEONATAL_BBLR",
        "source": "Buku KIA 2024 (Kemenkes RI)",
        "section": "Perawatan Metode Kanguru untuk Bayi Kecil",
        "page": 25,
        "content": (
            "Jika berat lahir < 2500 gram atau usia kehamilan <= 37 minggu, bayi menggunakan Buku KIA Khusus Bayi Kecil. Lakukan perawatan "
            "metode kanguru jika berat badan bayi < 2500 gram. Bayi kecil atau bayi prematur (< 37 minggu), bayi berat lahir rendah (< 2500 gram) "
            "akan mendapatkan perawatan di Puskesmas, Rumah Sakit atau Klinik Bersalin untuk menjaga kehangatan suhu tubuh dan memantau "
            "pemberian ASI eksklusif sesering mungkin."
        )
    },
    {
        "id": "kia_maternal_kspr",
        "category": "MATERNAL_RISIKO_TINGGI",
        "source": "Buku KIA 2024 (Kemenkes RI)",
        "section": "Skrining Kehamilan Risiko Tinggi dan Tanda Bahaya",
        "page": 8,
        "content": (
            "Pemeriksaan kehamilan oleh dokter dan tenaga kesehatan dilakukan minimal 6 kali selama kehamilan, termasuk skrining faktor risiko "
            "obstetri. Kenali dan periksa tanda bahaya: perdarahan, bengkak kaki/tangan/wajah disertai sakit kepala/kejang, demam tinggi, "
            "keluar air ketuban sebelum waktunya, atau gerakan bayi berkurang. Segera bawa ke fasilitas pelayanan kesehatan terdekat jika "
            "ditemukan tanda kehamilan risiko tinggi."
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
            p_match = page_re.search(clean_text)
            if p_match:
                current_page = int(p_match.group(1) or p_match.group(2))
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
                part_match = page_re.search(part)
                if part_match:
                    current_page = int(part_match.group(1) or part_match.group(2))
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
            "chapter": m.get("section") or m.get("chapter") or "Pedoman Klinis",
            "page": m.get("page"),
            "category": m.get("category"),
            "origin": m.get("origin"),
            "content": c,
            "text": c,
            "snippet": c[:280] + ("..." if len(c) > 280 else ""),
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
