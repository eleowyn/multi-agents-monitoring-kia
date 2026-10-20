"""
Embedding Gemini untuk RAG.

Embedding dihitung secara eksplisit (bukan lewat embedding_function bawaan Chroma)
agar task_type dokumen vs kueri dapat dibedakan dan batching/retry dapat dikontrol.
"""
import time
from typing import List

from app.core.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _embed(texts: List[str], task_type: str, max_retries: int = 5) -> List[List[float]]:
    from google.genai import types

    client = _get_client()
    config = types.EmbedContentConfig(
        task_type=task_type,
        output_dimensionality=settings.EMBEDDING_DIM,
    )
    delay = 2.0
    for attempt in range(max_retries):
        try:
            res = client.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=texts,
                config=config,
            )
            return [list(e.values) for e in res.embeddings]
        except Exception as e:  # rate limit / gangguan jaringan sementara
            msg = str(e)
            retryable = "429" in msg or "RESOURCE_EXHAUSTED" in msg or "503" in msg or "UNAVAILABLE" in msg
            if not retryable or attempt == max_retries - 1:
                raise
            # Jika terkena kuota per menit Gemini, tunggu minimal 40 detik
            wait_time = 40.0 if ("429" in msg or "RESOURCE_EXHAUSTED" in msg) else delay
            print(f"[EMBEDDING RETRY] Terkena limit kuota / jaringan ({type(e).__name__}). Menunggu {wait_time}s sebelum mencoba ulang (percobaan {attempt+1}/{max_retries})...")
            time.sleep(wait_time)
            delay *= 2
    return []


def embed_documents(texts: List[str]) -> List[List[float]]:
    """Embed potongan dokumen secara bertahap (batch + jeda) agar aman dari rate limit."""
    vectors: List[List[float]] = []
    size = settings.EMBEDDING_BATCH_SIZE
    for i in range(0, len(texts), size):
        vectors.extend(_embed(texts[i:i + size], task_type="RETRIEVAL_DOCUMENT"))
        if i + size < len(texts):
            time.sleep(settings.EMBEDDING_BATCH_DELAY_SEC)
    return vectors


def embed_query(text: str) -> List[float]:
    return _embed([text], task_type="RETRIEVAL_QUERY")[0]
