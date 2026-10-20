from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "MultiAgent KIA Posyandu Airmadidi"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "default_secret_key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/multiagent_kia_db"
    
    # Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.6-flash"
    # text-embedding-004 sudah tidak tersedia (404) -> gunakan gemini-embedding-001
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIM: int = 768
    EMBEDDING_BATCH_SIZE: int = 50
    EMBEDDING_BATCH_DELAY_SEC: float = 1.0
    
    # ChromaDB
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "kia_guidelines_v2"          # embedding Gemini
    CHROMA_LEGACY_COLLECTION_NAME: str = "kia_guidelines"      # embedding default Chroma (cadangan offline)
    RAG_CHUNK_SIZE: int = 800
    RAG_CHUNK_OVERLAP: int = 150
    RAG_EXCLUDED_FILES: str = "TABEL_WHO.pdf"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

