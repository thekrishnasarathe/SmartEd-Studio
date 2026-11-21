import os
from pathlib import Path
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(dotenv_path=None, override=False):
        if dotenv_path and Path(dotenv_path).exists():
            import os
            for line in Path(dotenv_path).read_text().splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)
load_dotenv(BASE_DIR.parent / ".env", override=True)


class RuntimeConfig:
    """Dynamic runtime configuration supporting hot-swapping API credentials from UI or .env."""

    def __init__(self):
        self.reload()

    def reload(self):
        load_dotenv(BASE_DIR / ".env", override=True)
        load_dotenv(BASE_DIR.parent / ".env", override=True)
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
        self.gemini_model: str = (os.getenv("GEMINI_MODEL") or "gemini-3-flash-preview").strip().strip('"').strip("'")
        if not self.gemini_model or "gemini-2" in self.gemini_model or "gemini-1" in self.gemini_model:
            self.gemini_model = "gemini-3-flash-preview"
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip().strip('"').strip("'")
        self.groq_vision_model: str = os.getenv(
            "GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"
        ).strip().strip('"').strip("'")
        self.groq_text_model: str = os.getenv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile").strip().strip('"').strip("'")
        self.openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "").strip().strip('"').strip("'")
        self.openrouter_model: str = os.getenv(
            "OPENROUTER_MODEL", "qwen/qwen-2.5-vl-7b-instruct:free"
        ).strip().strip('"').strip("'")
        self.ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
        self.ollama_vision_model: str = os.getenv("OLLAMA_VISION_MODEL", "qwen2.5-vl:7b").strip()
        self.ollama_text_model: str = os.getenv("OLLAMA_TEXT_MODEL", "llama3.2").strip()
        self.active_ocr_provider: str = os.getenv("ACTIVE_OCR_PROVIDER", "auto").strip()
        self.active_grading_provider: str = os.getenv("ACTIVE_GRADING_PROVIDER", "auto").strip()
        self.weight_keyword: float = float(os.getenv("WEIGHT_KEYWORD", "0.20"))
        self.weight_semantic: float = float(os.getenv("WEIGHT_SEMANTIC", "0.30"))
        self.weight_rubric: float = float(os.getenv("WEIGHT_RUBRIC", "0.50"))
        self.ocr_confidence_threshold: float = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.75"))
        self.divergence_threshold: float = float(os.getenv("DIVERGENCE_THRESHOLD", "0.35"))

    def update_credentials(self, payload: dict):
        for k, v in payload.items():
            if v is not None and hasattr(self, k):
                setattr(self, k, v.strip() if isinstance(v, str) else v)
                os.environ[k.upper()] = str(v)

    def resolve_active_provider(self) -> str:
        if self.active_grading_provider not in ("auto", ""):
            return self.active_grading_provider
        if self.gemini_api_key:
            return "gemini"
        if self.groq_api_key:
            return "groq"
        if self.openrouter_api_key:
            return "openrouter"
        return "local_hybrid"

    def status_dict(self) -> dict:
        return {
            "active_provider": self.resolve_active_provider(),
            "gemini_configured": bool(self.gemini_api_key),
            "groq_configured": bool(self.groq_api_key),
            "openrouter_configured": bool(self.openrouter_api_key),
            "ollama_base_url": self.ollama_base_url,
            "gemini_model": self.gemini_model,
            "groq_text_model": self.groq_text_model,
            "groq_vision_model": self.groq_vision_model,
            "weights": {
                "keyword": self.weight_keyword,
                "semantic": self.weight_semantic,
                "rubric": self.weight_rubric,
            },
            "thresholds": {
                "ocr_confidence": self.ocr_confidence_threshold,
                "divergence": self.divergence_threshold,
            },
            "has_vision_configured": bool(self.gemini_api_key or self.groq_api_key or self.openrouter_api_key),
            "vision_warning": None if (self.gemini_api_key or self.groq_api_key or self.openrouter_api_key) else "No Vision API key configured — add a Gemini or Groq key in Settings for accurate handwriting reading",
        }


settings = RuntimeConfig()
