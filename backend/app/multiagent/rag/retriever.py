from typing import List, Dict, Any, Optional

from app.multiagent.rag.vectorstore import get_or_create_collection, get_legacy_collection
from app.multiagent.llm_utils import llm_available

# Mode retrieval yang dicatat di setiap chunk agar transparan di laporan/audit
RETRIEVAL_GEMINI = "GEMINI_EMBEDDING"
RETRIEVAL_FALLBACK = "FALLBACK_LOCAL_EMBEDDING"


def _to_chunks(results: Dict[str, Any], mode: str) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []
    if not results or not results.get("documents"):
        return chunks
    docs = results["documents"][0]
    metas = (results.get("metadatas") or [[{}] * len(docs)])[0]
    ids = (results.get("ids") or [[""] * len(docs)])[0]
    distances = (results.get("distances") or [[None] * len(docs)])[0]
    for i, doc in enumerate(docs):
        meta = metas[i] or {}
        chunks.append({
            "id": ids[i],
            "content": doc,
            "source": meta.get("source", "Buku KIA / PNPK"),
            "section": meta.get("section", "Umum"),
            "page": meta.get("page", "-"),
            "category": meta.get("category", "KIA"),
            "distance": distances[i] if i < len(distances) else None,
            "retrieval_mode": mode,
        })
    return chunks


def retrieve_clinical_guidelines(
    query: str,
    n_results: int = 3,
    category_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Semantic retrieval dokumen rujukan KIA & PNPK di ChromaDB (cosine similarity).

    1. Utama: kueri di-embed dengan Gemini (RETRIEVAL_QUERY) lalu dicari di koleksi v2.
    2. Cadangan: jika Gemini tidak tersedia/gagal atau koleksi v2 kosong, gunakan
       koleksi lama berembedding lokal agar layanan Posyandu tidak terhenti.

    Catatan: retrieval TIDAK lagi memicu auto-ingest, karena ingest dengan Gemini
    memerlukan ratusan panggilan API. Jalankan: python -m app.multiagent.rag.ingest
    """
    where = {"category": category_filter} if category_filter else None

    collection = get_or_create_collection()
    if llm_available() and collection.count() > 0:
        try:
            from app.multiagent.rag.embeddings import embed_query
            args = {
                "query_embeddings": [embed_query(query)],
                "n_results": min(n_results, collection.count()),
            }
            if where:
                args["where"] = where
            return _to_chunks(collection.query(**args), RETRIEVAL_GEMINI)
        except Exception as e:
            print(f"[RAG WARNING] Retrieval Gemini gagal, beralih ke koleksi lokal: {e}")

    legacy = get_legacy_collection()
    if legacy is None:
        print("[RAG WARNING] Tidak ada koleksi yang dapat digunakan. Jalankan ingest terlebih dahulu.")
        return []
    args = {"query_texts": [query], "n_results": min(n_results, legacy.count())}
    if where:
        args["where"] = where
    return _to_chunks(legacy.query(**args), RETRIEVAL_FALLBACK)


# Alias untuk kompatibilitas
retrieve_kia_guidelines = retrieve_clinical_guidelines
