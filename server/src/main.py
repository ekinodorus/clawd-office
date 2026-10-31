"""clawd-office server: FastAPI + Socket.IO entry point."""

import asyncio
import os
import subprocess
import sys

# Windows needs ProactorEventLoop for subprocess support
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import socketio
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.agent_manager import AgentManager
from src.socket_handler import setup_socket_handler
from src.utils import get_static_dir, open_browser

# --- FastAPI app ---
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:8000", "http://127.0.0.1:8000",
                   "http://localhost:7723", "http://127.0.0.1:7723"]

app = FastAPI(title="clawd-office")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Socket.IO ---
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=ALLOWED_ORIGINS,
)
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# --- Core services ---
manager = AgentManager(sio)
setup_socket_handler(sio, manager)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


def _browse_directory_sync() -> str | None:
    if sys.platform == "darwin":
        # macOS: use AppleScript for reliable folder picker
        script = (
            'tell application "System Events" to activate\n'
            'set chosenFolder to choose folder with prompt "作業ディレクトリを選択"\n'
            'return POSIX path of chosenFolder'
        )
        try:
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=60,
            )
            path = result.stdout.strip().rstrip("/")
            return path if path else None
        except (subprocess.TimeoutExpired, Exception):
            return None
    else:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askdirectory()
        root.destroy()
        return path or None


@app.post("/api/browse-directory")
async def browse_directory():
    path = await asyncio.to_thread(_browse_directory_sync)
    return {"path": path}


class OpenPathRequest(BaseModel):
    path: str


@app.post("/api/open-path")
async def open_path(body: OpenPathRequest):
    """Open a file or directory with the system default application."""
    target = os.path.normpath(body.path)
    if not os.path.exists(target):
        raise HTTPException(status_code=400, detail="Path does not exist")
    try:
        if sys.platform == "win32":
            os.startfile(target)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", target])
        else:
            subprocess.Popen(["xdg-open", target])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open: {e}")
    return {"ok": True}


class OpenDirectoryRequest(BaseModel):
    path: str


@app.post("/api/open-directory")
async def open_directory(body: OpenDirectoryRequest):
    target = os.path.normpath(body.path)
    if not os.path.isdir(target):
        raise HTTPException(status_code=400, detail="Directory does not exist")
    try:
        if sys.platform == "win32":
            os.startfile(target)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", target])
        else:
            subprocess.Popen(["xdg-open", target])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open directory: {e}")
    return {"ok": True}


# --- Static file serving (production mode) ---
_static_dir = get_static_dir()
if _static_dir.is_dir():
    @app.get("/")
    async def serve_index():
        return FileResponse(_static_dir / "index.html")

    # Mount static assets after API routes so /api/* takes priority
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")


if __name__ == "__main__":
    dev_mode = "--dev" in sys.argv
    port = 7723

    import threading

    def _delayed_open(url: str, delay: float = 1.5) -> None:
        import time
        time.sleep(delay)
        open_browser(url)

    if not dev_mode and _static_dir.is_dir():
        # Production mode: serve built client, open browser after server starts
        threading.Thread(target=_delayed_open, args=(f"http://localhost:{port}",), daemon=True).start()
        uvicorn.run("src.main:socket_app", host="127.0.0.1", port=port)
    else:
        # Dev mode: use with Vite dev server (hot reload)
        uvicorn.run("src.main:socket_app", host="127.0.0.1", port=port, reload=True)
