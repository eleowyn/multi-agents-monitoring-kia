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
    """Mengubah respons LLM (boleh dibungkus ```json ... ```) menjadi objek Python secara robust."""
    import re
    text = extract_text(content).strip()
    if not text:
        return {}

    # 1. Coba cari blok code block ```json ... ```
    match = re.search(r"```(?:json)?\s*([\[{].*?[\]}])\s*```", text, re.DOTALL)
    if match:
        raw_json = match.group(1).strip()
    else:
        # 2. Coba cari kurung terluar [ ... ] atau { ... }
        match_bracket = re.search(r"([\[{].*[\]}])", text, re.DOTALL)
        if match_bracket:
            raw_json = match_bracket.group(1).strip()
        else:
            raw_json = text.replace("```json", "").replace("```", "").strip()

    # Percobaan 1: Direct loads dengan strict=False (mengizinkan newline unescaped)
    try:
        return json.loads(raw_json, strict=False)
    except Exception:
        pass

    # Percobaan 2: json_repair (mengatasi trailing commas, missing quotes, single quotes)
    try:
        import json_repair
        return json_repair.repair_json(raw_json, return_objects=True)
    except Exception:
        pass

    # Percobaan 3: Pembersihan regex trailing commas
    cleaned = re.sub(r",\s*([\]}])", r"\1", raw_json)
    try:
        return json.loads(cleaned, strict=False)
    except Exception:
        pass

    # Percobaan 4: ast.literal_eval untuk format python dict/list
    try:
        import ast
        return ast.literal_eval(raw_json)
    except Exception:
        pass

    # Terakhir: throw json.loads error
    return json.loads(raw_json)


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


def get_chat_llm(temperature: float = 0.2, max_tokens: int = None):
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
        model = settings.KOBOILLM_MODEL or "gemini/gemini-3.1-pro-preview"
        if "gemini" in model.lower() and not model.startswith("gemini/"):
            model = f"gemini/{model}"
        base_url = settings.KOBOILLM_BASE_URL or "https://api.koboillm.com/v1"
        kwargs = {
            "model": model,
            "api_key": key,
            "base_url": base_url,
            "temperature": temperature,
            "max_retries": 2,
            "timeout": 90.0,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        return ChatOpenAI(**kwargs)
        
    from langchain_google_genai import ChatGoogleGenerativeAI
    kwargs = {
        "model": settings.GEMINI_MODEL,
        "google_api_key": settings.GEMINI_API_KEY,
        "temperature": temperature,
        "max_retries": 1,
    }
    if max_tokens:
        kwargs["max_output_tokens"] = max_tokens
    return ChatGoogleGenerativeAI(**kwargs)
