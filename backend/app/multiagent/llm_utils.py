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
