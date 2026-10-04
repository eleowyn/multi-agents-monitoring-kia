import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings

# ChromaDB persistence directory
PERSIST_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "chroma_db")
)
os.makedirs(PERSIST_DIR, exist_ok=True)


def get_chroma_client():
    """Mengembalikan ChromaDB PersistentClient."""
    return chromadb.PersistentClient(path=PERSIST_DIR)


def get_or_create_collection(name: str = None):
    """
    Mengambil atau membuat ChromaDB Collection untuk pedoman KIA/Stunting.
    """
    client = get_chroma_client()
    collection_name = name or settings.CHROMA_COLLECTION_NAME
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

