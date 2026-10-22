import json
from typing import Any


def extract_text(content: Any) -> str:
    """
    Mengambil teks dari `message.content` LangChain.

    Model Gemini generasi baru (dengan thinking) mengembalikan `content` berupa
    list blok, mis. [{"type": "text", "text": "...", "extras": {...}}], bukan str.
    Blok non-teks (thinking/signature) diabaikan.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content or "")


def parse_llm_json(content: Any) -> Any:
    """Mengubah respons LLM (boleh dibungkus ```json ... ```) menjadi objek Python."""
    text = extract_text(content)
    clean = text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


# Penanda mode eksekusi yang dicatat pada state/laporan agar transparan bagi kader & audit
MODE_LLM = "LLM"
MODE_FALLBACK = "MODE_FALLBACK"


def is_koboillm() -> bool:
    """True jika provider diatur ke KoboiLLM / OpenAI proxy atau menggunakan key sk-..."""
    from app.core.config import settings
    if (settings.LLM_PROVIDER or "").lower() in ("koboillm", "openai"):
        return True
    if settings.KOBOILLM_API_KEY:
        return True
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.startswith("sk-"):
        return True
    return False


def llm_available() -> bool:
    """True jika API key LLM (Google Gemini atau KoboiLLM) terisi dengan nilai yang valid."""
    from app.core.config import settings
    if is_koboillm():
        key = settings.KOBOILLM_API_KEY or settings.GEMINI_API_KEY
        return bool(key) and len(key) > 5 and not key.startswith("YOUR_")
    key = settings.GEMINI_API_KEY
    return bool(key) and len(key) > 10 and not key.startswith("YOUR_")


def get_chat_llm(temperature: float = 0.2):
    """
    Membuat klien chat LLM (Google Gemini atau KoboiLLM / OpenAI-compatible).
    Mengembalikan None jika API key tidak tersedia, sehingga pemanggil dapat
    beralih ke mode fallback deterministik.
    """
    if not llm_available():
        return None
    from app.core.config import settings
    
    if is_koboillm():
        from langchain_openai import ChatOpenAI
        key = settings.KOBOILLM_API_KEY or settings.GEMINI_API_KEY
        model = settings.KOBOILLM_MODEL or "gemini-3.1-flash-lite"
        base_url = settings.KOBOILLM_BASE_URL or "https://api.koboillm.com/v1"
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url=base_url,
            temperature=temperature,
            max_retries=2,
        )
        
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
        max_retries=1,
    )
