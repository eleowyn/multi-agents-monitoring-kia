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


def extract_token_usage(
    response: Any = None,
    prompt_text: str = "",
    output_text: str = "",
    is_llm_call: bool = True,
) -> dict:
    """
    Mengekstrak konsumsi token (input_tokens, output_tokens, total_tokens) dari
    respons API LLM (LangChain AIMessage usage_metadata / response_metadata).
    Jika proxy API tidak menyertakan header usage pada panggilan LLM aktif,
    gunakan estimator tokenizer (karakter / 4). Jika mode deterministik/single-pass,
    kembalikan 0 token beserta estimasi penghematan token.
    """
    if not is_llm_call or response is None:
        est_saved = max(180, (len(str(prompt_text or "")) + len(str(output_text or ""))) // 4)
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "llm_calls": 0,
            "source": "DETERMINISTIC_ZERO_TOKEN",
            "estimated_saved_tokens": est_saved,
        }

    in_tok = 0
    out_tok = 0
    tot_tok = 0
    source = "API_METADATA"

    usage_meta = getattr(response, "usage_metadata", None)
    if isinstance(usage_meta, dict):
        in_tok = int(usage_meta.get("input_tokens") or usage_meta.get("prompt_tokens") or 0)
        out_tok = int(usage_meta.get("output_tokens") or usage_meta.get("completion_tokens") or 0)
        tot_tok = int(usage_meta.get("total_tokens") or (in_tok + out_tok))

    if tot_tok == 0:
        resp_meta = getattr(response, "response_metadata", None) or {}
        if isinstance(resp_meta, dict):
            tu = resp_meta.get("token_usage") or resp_meta.get("usage") or {}
            if isinstance(tu, dict):
                in_tok = int(tu.get("prompt_tokens") or tu.get("input_tokens") or 0)
                out_tok = int(tu.get("completion_tokens") or tu.get("output_tokens") or 0)
                tot_tok = int(tu.get("total_tokens") or (in_tok + out_tok))

    if tot_tok == 0:
        source = "TOKENIZER_ESTIMATE"
        p_str = str(prompt_text or "")
        o_str = str(output_text or extract_text(getattr(response, "content", "")) or "")
        in_tok = max(32, len(p_str) // 4)
        out_tok = max(16, len(o_str) // 4)
        tot_tok = in_tok + out_tok

    return {
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "total_tokens": tot_tok,
        "llm_calls": 1,
        "source": source,
        "estimated_saved_tokens": 0,
    }


def merge_token_usage(usages: list) -> dict:
    """Menggabungkan beberapa catatan penggunaan token (misal dari multi-step ReAct loop)."""
    valid = [u for u in (usages or []) if isinstance(u, dict)]
    if not valid:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "llm_calls": 0,
            "source": "DETERMINISTIC_ZERO_TOKEN",
            "estimated_saved_tokens": 0,
        }
    in_tok = sum(int(u.get("input_tokens", 0)) for u in valid)
    out_tok = sum(int(u.get("output_tokens", 0)) for u in valid)
    tot_tok = sum(int(u.get("total_tokens", 0)) for u in valid)
    calls = sum(int(u.get("llm_calls", 0)) for u in valid)
    saved = sum(int(u.get("estimated_saved_tokens", 0)) for u in valid)
    sources = {u.get("source") for u in valid if u.get("source")}
    if "API_METADATA" in sources:
        src = "API_METADATA"
    elif "TOKENIZER_ESTIMATE" in sources:
        src = "TOKENIZER_ESTIMATE"
    else:
        src = "DETERMINISTIC_ZERO_TOKEN"
    return {
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "total_tokens": tot_tok,
        "llm_calls": calls,
        "source": src,
        "estimated_saved_tokens": saved,
    }


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
