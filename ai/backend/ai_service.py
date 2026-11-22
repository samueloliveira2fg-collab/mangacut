"""Local inference bridge for SkyTNT Anime Segmentation (ISNet ONNX).

Only binds to 127.0.0.1. It accepts a small PNG/JPEG image from the MangaCut
editor and returns a grayscale alpha mask at the same dimensions.
"""
from __future__ import annotations

import hashlib
import io
import os
import shutil
import threading
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from huggingface_hub import hf_hub_download
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
BASE_MODEL = MODEL_DIR / "isnetis.onnx"
CUSTOM_MODELS = {
    "manga-bw": MODEL_DIR / "mangacut_isnet_v12_bw.onnx",
    "comic-color": MODEL_DIR / "mangacut_isnet_v12_color.onnx",
    "mixed": MODEL_DIR / "mangacut_isnet_v12_mixed.onnx",
}
MODEL_REPO = "skytnt/anime-seg"
MODEL_REVISION = "a0a563c41338cbe0d23dfb4bfc3e243c518e5768"
MODEL_SHA256 = "f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99"
MODEL_SIZE_BYTES = 176 * 1024 * 1024
MODEL_INPUT_SIZE = 1024
MAX_UPLOAD_BYTES = 16 * 1024 * 1024
MAX_INPUT_PIXELS = 2_500_000  # UI envia no máximo 1024 px no lado maior

app = FastAPI(title="MangaCut Local Anime Segmentation", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null", "http://localhost", "http://127.0.0.1"],
    allow_origin_regex=r"^(null|file://.*|http://(localhost|127\.0\.0\.1)(:\d+)?)$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-MangaCut-Model", "X-MangaCut-Style"],
)

# Chrome's private/local-network preflight may require the explicit opt-in header.
@app.middleware("http")
async def local_network_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Cache-Control"] = "no-store"
    return response

_session: Any = None
_session_path: Path | None = None
_session_lock = threading.Lock()
_inference_lock = threading.Lock()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def selected_model_path(style: str = "auto") -> Path:
    preferred = CUSTOM_MODELS.get(style)
    if preferred and preferred.is_file():
        return preferred
    if style == "auto" and CUSTOM_MODELS["mixed"].is_file():
        return CUSTOM_MODELS["mixed"]
    if CUSTOM_MODELS["mixed"].is_file():
        return CUSTOM_MODELS["mixed"]
    return BASE_MODEL


def ensure_model(style: str = "auto") -> Path:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = selected_model_path(style)
    if path.is_file() and path.stat().st_size > 50_000_000:
        if path == BASE_MODEL and sha256_file(path) != MODEL_SHA256:
            path.unlink(missing_ok=True)
        else:
            return path
    elif path.exists():
        # Remove interrupted/partial local model files before fallback.
        path.unlink(missing_ok=True)

    # Download a pinned official ONNX artifact, not an arbitrary checkpoint.
    cached = Path(hf_hub_download(
        repo_id=MODEL_REPO,
        filename="isnetis.onnx",
        revision=MODEL_REVISION,
        repo_type="model",
    ))
    if cached.stat().st_size < 50_000_000 or sha256_file(cached) != MODEL_SHA256:
        raise RuntimeError("O arquivo ONNX baixado não passou na verificação SHA-256 oficial.")
    shutil.copy2(cached, BASE_MODEL)
    return BASE_MODEL


def get_session(style: str = "auto"):
    global _session, _session_path
    with _session_lock:
        path = selected_model_path(style)
        if _session is not None and _session_path == path:
            return _session
        model_path = ensure_model(style)
        try:
            import onnxruntime as ort
        except ImportError as exc:
            raise RuntimeError(
                "onnxruntime não está instalado. Execute iniciar_ia_windows.bat."
            ) from exc

        available = ort.get_available_providers()
        providers = []
        # Prefer GPU only if the user installed a compatible runtime/provider.
        for candidate in ("DmlExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"):
            if candidate in available:
                providers.append(candidate)
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 2))
        options.inter_op_num_threads = 1
        _session = ort.InferenceSession(str(model_path), sess_options=options, providers=providers)
        _session_path = model_path
        return _session


def prepare_input(rgb: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int], tuple[int, int]]:
    """Mirror SkyTNT inference.py: scale long edge to 1024 and center-pad black."""
    h0, w0 = rgb.shape[:2]
    if h0 < 1 or w0 < 1:
        raise ValueError("Imagem vazia.")
    if h0 > w0:
        h, w = MODEL_INPUT_SIZE, max(1, int(MODEL_INPUT_SIZE * w0 / h0))
    else:
        h, w = max(1, int(MODEL_INPUT_SIZE * h0 / w0)), MODEL_INPUT_SIZE
    ph, pw = MODEL_INPUT_SIZE - h, MODEL_INPUT_SIZE - w
    resized = cv2.resize(rgb.astype(np.float32) / 255.0, (w, h), interpolation=cv2.INTER_LINEAR)
    square = np.zeros((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3), dtype=np.float32)
    y0, x0 = ph // 2, pw // 2
    square[y0:y0 + h, x0:x0 + w] = resized
    tensor = np.transpose(square, (2, 0, 1))[None, ...].astype(np.float32, copy=False)
    return tensor, (y0, x0, h, w), (h0, w0)


def infer_mask(image_bytes: bytes, style: str = "auto") -> tuple[bytes, str]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as im:
            if im.format not in {"PNG", "JPEG", "WEBP"}:
                raise ValueError("Envie PNG, JPEG ou WEBP.")
            im = ImageOps.exif_transpose(im)
            if im.width * im.height > MAX_INPUT_PIXELS:
                raise ValueError("A imagem enviada à IA excede 2,5 MP. O MangaCut deve reduzi-la para até 1024 px no lado maior.")
            rgb = np.asarray(im.convert("RGB"), dtype=np.uint8)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("O arquivo enviado não é uma imagem válida.") from exc

    tensor, (y0, x0, h, w), (h0, w0) = prepare_input(rgb)
    session = get_session(style)
    input_names = {item.name for item in session.get_inputs()}
    if "img" not in input_names:
        raise RuntimeError("O modelo ONNX não possui a entrada esperada 'img'.")
    with _inference_lock:
        outputs = session.run(["mask"], {"img": tensor})
    pred = np.asarray(outputs[0], dtype=np.float32)
    pred = np.squeeze(pred)
    if pred.ndim == 3:
        pred = pred[..., 0] if pred.shape[-1] in (1, 3) else pred[0]
    if pred.ndim != 2:
        raise RuntimeError(f"Formato de saída não reconhecido pelo ISNet: {pred.shape}.")
    if not np.isfinite(pred).all():
        pred = np.nan_to_num(pred, nan=0.0, posinf=1.0, neginf=0.0)
    # ISNet exported by SkyTNT returns sigmoid probabilities. Clamp without
    # hard-thresholding so soft hair/line edges remain editable in MangaCut.
    pred = np.clip(pred, 0.0, 1.0)
    pred = pred[y0:y0 + h, x0:x0 + w]
    pred = cv2.resize(pred, (w0, h0), interpolation=cv2.INTER_LINEAR)
    mask = np.round(np.clip(pred, 0.0, 1.0) * 255).astype(np.uint8)
    ok, encoded = cv2.imencode(".png", mask, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise RuntimeError("Não foi possível codificar a máscara PNG.")
    label = ("MangaCut fine-tune (" + _session_path.stem + ")") if _session_path in CUSTOM_MODELS.values() else "SkyTNT ISNet base"
    return encoded.tobytes(), label


@app.get("/health")
def health():
    path = selected_model_path("auto")
    providers = "Runtime ainda não instalado"
    runtime_ready = False
    try:
        import onnxruntime as ort
        providers = ", ".join(ort.get_available_providers())
        runtime_ready = True
    except ImportError:
        pass
    custom_models = {key: value.is_file() and value.stat().st_size > 50_000_000 for key, value in CUSTOM_MODELS.items()}
    model_ready = path.is_file() and path.stat().st_size > 50_000_000 or any(custom_models.values())
    model_label = ("MangaCut fine-tune (" + path.stem + ")") if path != BASE_MODEL and path.is_file() else ("Modelos MangaCut fine-tuned disponíveis; escolha o estilo" if any(custom_models.values()) else "SkyTNT ISNet pré-treinado")
    return {
        "ok": True,
        "runtime_ready": runtime_ready,
        "model_ready": model_ready,
        "model_size_mb": 176,
        "model_label": model_label,
        "custom_models": custom_models,
        "providers": providers,
        "input_size": MODEL_INPUT_SIZE,
        "note": "O mesmo modelo base é usado em colorido e P&B; a escolha de estilo é metadado até termos pesos especializados.",
    }


@app.post("/segment")
async def segment(file: UploadFile = File(...), style: str = Form("auto")):
    if style not in {"auto", "manga-bw", "comic-color"}:
        raise HTTPException(status_code=400, detail="Estilo de painel inválido.")
    if file.content_type not in {"image/png", "image/jpeg", "image/webp", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Formato não aceito. Envie uma imagem PNG, JPEG ou WEBP.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if not data:
        raise HTTPException(status_code=400, detail="Nenhuma imagem foi enviada.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Imagem muito grande para o serviço de IA. Reduza a prévia de inferência e tente novamente.")
    try:
        png, model_label = infer_mask(data, style)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Falha na IA local: {exc}") from exc
    return Response(
        content=png,
        media_type="image/png",
        headers={"X-MangaCut-Model": model_label, "X-MangaCut-Style": style},
    )


if __name__ == "__main__":
    import uvicorn
    print("MangaCut Anime Segmentation local service")
    print("Apenas localhost: http://127.0.0.1:8765")
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
