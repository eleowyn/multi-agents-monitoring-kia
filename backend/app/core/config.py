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
    
    # LLM Provider ("google" atau "koboillm")
    LLM_PROVIDER: str = "google"
    
    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.6-flash"
    
    # KoboiLLM Gateway (OpenAI-compatible)
    KOBOILLM_API_KEY: Optional[str] = None
    KOBOILLM_BASE_URL: str = "https://api.koboillm.com/v1"
    KOBOILLM_MODEL: str = "gemini-3.1-flash-lite"
    
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

    # WeasyPrint (Windows): folder DLL Pango/GTK dari MSYS2, mis. C:\msys64\mingw64\bin
    WEASYPRINT_DLL_DIRECTORIES: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

