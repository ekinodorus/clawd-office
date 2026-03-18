import webbrowser
from pathlib import Path


def truncate_text(text: str, max_len: int) -> str:
    """Truncate text to max_len, appending '...' if truncated."""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def get_static_dir() -> Path:
    """Return the path to the client build output directory."""
    return Path(__file__).resolve().parent.parent.parent / "client" / "dist"


def open_browser(url: str) -> None:
    """Open the given URL in the default browser. Silently ignores errors."""
    try:
        webbrowser.open(url)
    except Exception:
        pass
