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

# Ringkasan Terkurasi Peneliti (Bab 1.5.1 no.10 & Tabel 26).
# Ditulis ulang oleh peneliti dari Buku KIA 2024 dan PNPK 2022, BUKAN kutipan verbatim,
# sehingga diberi sumber "Ringkasan Terkurasi Peneliti" dan tanpa nomor halaman buku.
CURATED_SOURCE_LABEL = "Ringkasan Terkurasi Peneliti"
CURATED_SUMMARIES = [
    {
        "id": "kia_stunting_01",
        "category": "STUNTING_GIZI",
        "source": CURATED_SOURCE_LABEL,
        "derived_from": "PNPK 2022 Tata Laksana Stunting",
        "section": "Pencegahan Stunting Tingkat Kader dan Puskesmas",
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
        "source": CURATED_SOURCE_LABEL,
        "derived_from": "Buku KIA 2024",
        "section": "Pemenuhan Gizi Usia 6 - 24 Bulan (Syarat MPASI)",
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
        "source": CURATED_SOURCE_LABEL,
        "derived_from": "Buku KIA 2024",
        "section": "Pengukuran Lingkar Lengan Atas (LiLA) dan Pemantauan Gizi",
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
        "source": CURATED_SOURCE_LABEL,
        "derived_from": "Buku KIA 2024",
        "section": "Pencegahan Anemia dan Konsumsi Tablet Tambah Darah (TTD)",
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
        "source": CURATED_SOURCE_LABEL,
        "derived_from": "Buku KIA 2024",
        "section": "Perawatan Metode Kanguru untuk Bayi Kecil",
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
        "source": CURATED_SOURCE_LABEL,
        "derived_from": "Buku KIA 2024",
        "section": "Skrining Kehamilan Risiko Tinggi dan Tanda Bahaya",
        "content": (
            "Pemeriksaan kehamilan oleh dokter dan tenaga kesehatan dilakukan minimal 6 kali selama kehamilan, termasuk skrining faktor risiko "
            "obstetri. Kenali dan periksa tanda bahaya: perdarahan, bengkak kaki/tangan/wajah disertai sakit kepala/kejang, demam tinggi, "
            "keluar air ketuban sebelum waktunya, atau gerakan bayi berkurang. Segera bawa ke fasilitas pelayanan kesehatan terdekat jika "
            "ditemukan tanda kehamilan risiko tinggi."
        )
    }
]


# ---------------------------------------------------------------------------
# Pembersihan artefak konversi & pemotongan chunk verbatim
# ---------------------------------------------------------------------------
# Yang dibuang HANYA artefak non-isi hasil konversi PDF -> Markdown (penanda halaman,
# timestamp cetak, footer situs, referensi gambar, tag HTML, penanda tebal/miring/coret).
# Kata-kata buku tidak diubah, tidak diparafrasekan, dan tidak ditambah.
KIA_PAGE_MARKER_RE = re.compile(r"KIA 2024 Book 2\.17\.5\s+(\d+)")
PNPK_PAGE_MARKER_RE = re.compile(r"^\s*-\s*(\d+)\s*-\s*$")
PRINT_TIMESTAMP_RE = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2}\s+\d{1,2}:\d{2}\b")
FOOTER_RE = re.compile(r"[*_\s]*jdih\.kemkes\.go\.id[*_\s]*", re.IGNORECASE)
IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
CELL_BREAK_RE = re.compile(r"</t[dh]>\s*<t[dh][^>]*>", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
HEADING_RE = re.compile(r"^\s*(#{1,6})\s+(.*)$")
LIST_OR_ROW_RE = re.compile(r"^(\s*[-•□]\s|\s*\d+[.)]\s|\s*\|)")


def clean_line(line: str) -> str:
    """Membuang markup (gambar, tag HTML, penanda tebal/miring/coret) tanpa mengubah kata."""
    line = IMAGE_RE.sub("", line)
    line = CELL_BREAK_RE.sub(" | ", line)          # pemisah sel tabel HTML
    line = HTML_TAG_RE.sub(" ", line)               # teks di dalam tag dipertahankan
    line = line.replace("~~", "").replace("**", "").replace("__", "")
    line = re.sub(r"(?<![\w*])\*(?=\S)|(?<=\S)\*(?![\w*])", "", line)  # *miring*
    return re.sub(r"[ \t]+", " ", line).strip()


def clean_markdown_blocks(content: str) -> List[Dict[str, Any]]:
    """
    Mengubah Markdown hasil konversi menjadi daftar blok (paragraf / heading / butir / baris tabel)
    beserta nomor halaman PDF dan heading terdekat.
    Halaman dibaca dari penanda awal halaman: "KIA 2024 Book 2.17.5 N" (Buku KIA)
    atau "- N -" (PNPK). Teks sebelum penanda pertama berada di halaman 1.
    """
    blocks: List[Dict[str, Any]] = []
    state = {"page": 1, "heading": ""}
    buffer: List[str] = []

    def flush():
        if buffer:
            text = " ".join(buffer).strip()
            if text:
                blocks.append({"text": text, "page": state["page"], "section": state["heading"], "is_heading": False})
            buffer.clear()

    for raw in content.splitlines():
        pnpk_marker = PNPK_PAGE_MARKER_RE.match(raw)
        if pnpk_marker:
            flush()
            state["page"] = int(pnpk_marker.group(1))
            continue
        kia_marker = KIA_PAGE_MARKER_RE.search(raw)
        if kia_marker:
            # Penanda halaman bisa berdiri sendiri atau menempel di awal baris
            flush()
            state["page"] = int(kia_marker.group(1))
            raw = KIA_PAGE_MARKER_RE.sub(" ", raw)
        raw = FOOTER_RE.sub(" ", PRINT_TIMESTAMP_RE.sub(" ", raw))
        if not raw.strip():
            continue
        heading = HEADING_RE.match(raw)
        if heading:
            flush()
            text = clean_line(heading.group(2))
            if text:
                state["heading"] = text
                blocks.append({"text": text, "page": state["page"], "section": text, "is_heading": True})
            continue
        text = clean_line(raw)
        if not text:
            flush()
            continue
        if LIST_OR_ROW_RE.match(raw) or raw.lstrip().lower().startswith("<tr"):
            flush()
            blocks.append({"text": text, "page": state["page"], "section": state["heading"], "is_heading": False})
        else:
            buffer.append(text)
    flush()
    return blocks


def _split_long_text(text: str, size: int) -> List[str]:
    """Memecah satu blok panjang di batas kalimat; bila tidak ada, di batas spasi. Kata tidak terpotong."""
    parts: List[str] = []
    rest = text
    while len(rest) > size:
        window = rest[:size]
        cut = max(window.rfind(". "), window.rfind("; "), window.rfind("? "), window.rfind("! "))
        if cut < size // 3:
            cut = window.rfind(" ")
        if cut <= 0:
            cut = size - 1
        parts.append(rest[:cut + 1].strip())
        rest = rest[cut + 1:].strip()
    if rest:
        parts.append(rest)
    return parts


def _categorize(section: str, text: str, default_category: str) -> str:
    lower_h = (section + " " + text[:200]).lower()
    if "stunting" in lower_h or "gizi buruk" in lower_h or "gizi kurang" in lower_h:
        return "STUNTING_GIZI"
    if any(k in lower_h for k in ["ibu hamil", "trimester", "kek", "anemia", "ttd", "lila"]):
        return "MATERNAL_KEK_ANEMIA"
    if any(k in lower_h for k in ["bayi baru lahir", "bblr", "neonatus", "metode kanguru"]):
        return "NEONATAL_BBLR"
    if any(k in lower_h for k in ["mp-asi", "mpasi", "asi", "baduta", "kms"]):
        return "BADUTA_GIZI"
    return default_category


def chunk_markdown_file(
    file_path: str,
    doc_source: str,
    doc_prefix: str,
    default_category: str = "GENERAL_KIA",
    size: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Memotong berkas Markdown menjadi chunk verbatim ±RAG_CHUNK_SIZE karakter.
    - Pemotongan di batas paragraf/butir/kalimat; kata tidak pernah terpotong.
    - Chunk baru dimulai pada heading; bagian < 200 karakter digabung dengan bagian berikutnya.
    - Halaman chunk = halaman PDF tempat blok pertamanya berada.
    """
    if not os.path.exists(file_path):
        return []
    size = size or settings.RAG_CHUNK_SIZE
    with open(file_path, "r", encoding="utf-8") as f:
        blocks = clean_markdown_blocks(f.read())

    pieces: List[Dict[str, Any]] = []
    for b in blocks:
        for t in _split_long_text(b["text"], size):
            pieces.append({**b, "text": t})

    chunks: List[Dict[str, Any]] = []
    current: List[Dict[str, Any]] = []

    def emit():
        body = [p for p in current if not p["is_heading"]]
        text = "\n".join(p["text"] for p in current).strip()
        if body and len(text) >= 40:
            section = body[0]["section"] or "Tanpa Judul Bagian"
            chunks.append({
                "id": f"{doc_prefix}_{len(chunks):04d}",
                "source": doc_source,
                "section": section,
                "page": current[0]["page"],
                "category": _categorize(section, text, default_category),
                "origin": "MARKDOWN_DOC",
                "content": text,
            })
        current.clear()

    # Bagian yang sangat pendek (hanya judul atau satu kalimat) digabung dengan bagian berikutnya
    min_len = 200
    for p in pieces:
        current_len = sum(len(x["text"]) + 1 for x in current)
        has_body = any(not x["is_heading"] for x in current)
        if (p["is_heading"] and has_body and current_len >= min_len) or (has_body and current_len + len(p["text"]) > size):
            emit()
        current.append(p)
    emit()
    return chunks


def chunk_text(text: str, size: int, overlap: int) -> List[str]:
    """Pemotongan teks PDF (jalur cadangan) dengan tumpang-tindih, tanpa memotong kata."""
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
        nxt = max(end - overlap, start + 1)
        space_after = text.find(" ", nxt)
        start = space_after + 1 if 0 <= space_after < end else nxt
    return [c for c in chunks if c]


KIA_SOURCE_LABEL = "Buku KIA 2024 (Kemenkes RI)"
PNPK_SOURCE_LABEL = "Pedoman Nasional Pelayanan Kedokteran Tata Laksana Stunting (KMK No. HK.01.07/Menkes/1928/2022)"


def _collect_documents(include_curated: bool = True) -> Tuple[List[str], List[Dict[str, Any]], List[str]]:
    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    ids: List[str] = []

    # 1. Ringkasan Terkurasi Peneliti (berlabel jelas, bukan kutipan buku)
    if include_curated:
        for item in CURATED_SUMMARIES:
            documents.append(item["content"])
            metadatas.append({
                "source": item["source"],
                "section": item["section"],
                "page": "-",
                "category": item["category"],
                "origin": "CURATED_SUMMARY",
                "derived_from": item["derived_from"],
            })
            ids.append(item["id"])

    # 2. Dokumen Markdown resmi di knowledge_base/
    md_files = [f for f in sorted(os.listdir(KNOWLEDGE_BASE_DIR)) if f.lower().endswith(".md")]
    for filename in md_files:
        is_kia = "kia" in filename.lower()
        md_chunks = chunk_markdown_file(
            os.path.join(KNOWLEDGE_BASE_DIR, filename),
            KIA_SOURCE_LABEL if is_kia else PNPK_SOURCE_LABEL,
            "md_kia24" if is_kia else "md_pnpk22",
        )
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

    # 3. Cadangan: PDF di knowledge_base/ bila tidak ada Markdown
    if not md_files:
        excluded = {f.strip().lower() for f in settings.RAG_EXCLUDED_FILES.split(",") if f.strip()}
        for filename in sorted(os.listdir(KNOWLEDGE_BASE_DIR)):
            if not filename.lower().endswith(".pdf") or filename.lower() in excluded:
                continue
            try:
                reader = PdfReader(os.path.join(KNOWLEDGE_BASE_DIR, filename))
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


def _read_collection_items() -> Tuple[List[Dict[str, Any]], str]:
    """Isi koleksi ChromaDB utama (yang benar-benar dipakai agent). Kosong bila belum di-ingest."""
    try:
        collection = get_or_create_collection()
        if collection.count() == 0:
            return [], "CHROMADB_KOSONG"
        data = collection.get(include=["documents", "metadatas"])
    except Exception as e:
        print(f"[RAG WARNING] Gagal membaca ChromaDB: {e}")
        return [], "CHROMADB_TIDAK_TERHUBUNG"
    items = []
    for c_id, doc, meta in zip(data["ids"], data["documents"], data["metadatas"]):
        items.append({"id": c_id, "content": doc, **(meta or {})})
    items.sort(key=lambda x: x["id"])
    return items, "CHROMADB"


def get_all_knowledge_chunks(
    search: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Daftar chunk rujukan untuk halaman Koleksi Rujukan.
    Dibaca langsung dari koleksi ChromaDB yang dipakai agent, sehingga yang tampil
    sama dengan yang di-retrieve. Bila ChromaDB belum terisi, daftar kosong
    beserta `store_status` agar tidak menampilkan chunk yang tidak dipakai agent.
    """
    raw_items, store_status = _read_collection_items()
    items = []
    for m in raw_items:
        c = m.get("content") or ""
        if source and source.lower() not in (m.get("source") or "").lower():
            continue
        if category and category.upper() != (m.get("category") or "").upper():
            continue
        if search:
            s_low = search.lower()
            if s_low not in c.lower() and s_low not in (m.get("section") or "").lower() and s_low not in (m.get("source") or "").lower():
                continue
        items.append({
            "id": m["id"],
            "source": m.get("source"),
            "section": m.get("section"),
            "chapter": m.get("section"),
            "page": m.get("page"),
            "category": m.get("category"),
            "origin": m.get("origin"),
            "derived_from": m.get("derived_from"),
            "content": c,
            "text": c,
            "snippet": c[:280] + ("..." if len(c) > 280 else ""),
            "char_count": len(c),
            "estimated_tokens": max(1, len(c) // 4),
        })

    return {
        "total_chunks": len(items),
        "store_status": store_status,
        "skip": skip,
        "limit": limit,
        "chunks": items[skip:skip + limit],
    }


def _sync_collection(collection, documents, metadatas, ids, embed_fn=None) -> None:
    """Menghapus ID usang lalu menambahkan/memperbarui chunk agar koleksi = isi dokumen saat ini."""
    existing = collection.get(include=[]) if collection.count() else {"ids": []}
    stale = sorted(set(existing["ids"]) - set(ids))
    if stale:
        for start in range(0, len(stale), 500):
            collection.delete(ids=stale[start:start + 500])
        print(f"[RAG INGEST] {len(stale)} chunk usang dihapus dari '{collection.name}'.")

    current = {}
    if ids:
        got = collection.get(ids=ids, include=["documents"])
        current = dict(zip(got["ids"], got["documents"]))
    pending = [i for i, doc_id in enumerate(ids) if current.get(doc_id) != documents[i]]
    if not pending:
        print(f"[RAG INGEST] Koleksi '{collection.name}' sudah sesuai ({collection.count()} chunk).")
        return

    step = settings.EMBEDDING_BATCH_SIZE
    for start in range(0, len(pending), step):
        batch = pending[start:start + step]
        kwargs = {
            "ids": [ids[i] for i in batch],
            "documents": [documents[i] for i in batch],
            "metadatas": [metadatas[i] for i in batch],
        }
        if embed_fn is not None:
            kwargs["embeddings"] = embed_fn([documents[i] for i in batch])
        collection.upsert(**kwargs)
        print(f"[RAG INGEST] '{collection.name}': {min(start + step, len(pending))}/{len(pending)} chunk tersimpan.")


def ingest_knowledge_base(rebuild: bool = False) -> int:
    """
    Mengindeks Buku KIA 2024 & PNPK 2022 (+ Ringkasan Terkurasi Peneliti) ke ChromaDB.

    - Koleksi utama (embedding Gemini) dan koleksi cadangan offline (embedding lokal
      Chroma) berisi chunk yang SAMA PERSIS: ID, teks, dan metadata identik.
    - Chunk yang tidak lagi dihasilkan dari dokumen dihapus (tidak ada chunk usang).
    - rebuild=True menghapus kedua koleksi terlebih dahulu.
    """
    from app.multiagent.llm_utils import llm_available
    from app.multiagent.rag.vectorstore import get_chroma_client

    client = get_chroma_client()
    if rebuild:
        for name in (settings.CHROMA_COLLECTION_NAME, settings.CHROMA_LEGACY_COLLECTION_NAME):
            try:
                client.delete_collection(name)
                print(f"[RAG INGEST] Koleksi '{name}' dihapus.")
            except Exception:
                pass

    documents, metadatas, ids = _collect_documents()

    legacy = client.get_or_create_collection(
        name=settings.CHROMA_LEGACY_COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )
    _sync_collection(legacy, documents, metadatas, ids)

    collection = get_or_create_collection()
    if not llm_available():
        print("[RAG INGEST] GEMINI_API_KEY tidak tersedia; koleksi utama (embedding Gemini) dilewati.")
        return collection.count()

    from app.multiagent.rag.embeddings import embed_documents
    print(f"[RAG INGEST] Embedding dengan {settings.EMBEDDING_MODEL}...")
    _sync_collection(collection, documents, metadatas, ids, embed_fn=embed_documents)
    print(f"[RAG INGEST] Selesai. '{collection.name}': {collection.count()} chunk, '{legacy.name}': {legacy.count()} chunk.")
    return collection.count()


if __name__ == "__main__":
    import sys
    ingest_knowledge_base(rebuild="--rebuild" in sys.argv)
