"""Authenticated, origin-limited bridge to ears and Seven Ears local services.

Run behind TLS with an HTTPS reverse proxy. Do not expose upstream services.
"""
import hmac
import os
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

TOKEN = os.environ.get("XY_HEARING_TOKEN", "")
ORIGIN = os.environ.get("XY_HEARING_ORIGIN", "")
EARS = os.environ.get("XY_EARS_LOCAL", "http://127.0.0.1:8020")
SEVEN = os.environ.get("XY_SEVEN_LOCAL", "http://127.0.0.1:8765")
MAX_BYTES = 18 * 1024 * 1024

if len(TOKEN) < 24 or not ORIGIN or "*" in ORIGIN:
    raise RuntimeError("Set a strong XY_HEARING_TOKEN and exact XY_HEARING_ORIGIN")
for upstream in (EARS, SEVEN):
    url = urlparse(upstream)
    if url.scheme != "http" or url.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise RuntimeError("Backends must stay on localhost")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ORIGIN],
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type"],
)

def authorize(value):
    expected = "Bearer " + TOKEN
    if not hmac.compare_digest(value or "", expected):
        raise HTTPException(status_code=401, detail="Not authorized")

async def forward(url, upload, extras):
    raw = await upload.read(MAX_BYTES + 1)
    if len(raw) < 700 or len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Invalid audio size")
    filename = (upload.filename or "voice.webm").split("/")[-1].split("\\")[-1]
    files = {("file" if not extras else "audio"): (filename, raw, upload.content_type or "application/octet-stream")}
    try:
        async with httpx.AsyncClient(timeout=110.0, follow_redirects=False) as client:
            result = await client.post(url, files=files, data=extras)
        payload = result.json()
        if not isinstance(payload, dict):
            raise ValueError("Non-object response")
        return JSONResponse(payload, status_code=result.status_code)
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=502, detail="Hearing backend unavailable")

@app.post("/ears/api/listen")
async def ears_listen(file: UploadFile = File(...), authorization: str = Header(default="")):
    authorize(authorization)
    return await forward(EARS.rstrip("/") + "/api/listen", file, {})

@app.post("/seven/analyze")
async def seven_analyze(
    audio: UploadFile = File(...),
    transcript: str = "",
    transcript_source: str = "none",
    stt: str = "none",
    whisper_model: str = "small",
    authorization: str = Header(default=""),
):
    authorize(authorization)
    extras = {
        "transcript": transcript[:8000],
        "transcript_source": transcript_source[:32],
        "stt": stt if stt in ("none", "whisper") else "none",
        "whisper_model": whisper_model if whisper_model in ("small", "base", "base.en") else "small",
    }
    return await forward(SEVEN.rstrip("/") + "/analyze", audio, extras)
