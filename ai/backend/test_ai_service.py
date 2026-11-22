import io
import importlib.util
from pathlib import Path
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

SERVICE_PATH = Path(__file__).with_name("ai_service.py")
spec = importlib.util.spec_from_file_location("mangacut_ai_service", SERVICE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FakeInput:
    name = "img"

class FakeSession:
    def get_inputs(self):
        return [FakeInput()]
    def run(self, names, inputs):
        assert names == ["mask"]
        arr = inputs["img"]
        assert arr.shape == (1, 3, 1024, 1024)
        # A centered, soft elliptical prediction for deterministic integration tests.
        y, x = np.mgrid[0:1024, 0:1024]
        d = ((x - 512) / 340) ** 2 + ((y - 512) / 420) ** 2
        m = np.clip((1.08 - d) * 4.0, 0, 1).astype(np.float32)
        return [m[None, None, :, :]]


def make_image(width=720, height=480):
    image = Image.new("RGB", (width, height), "white")
    b = io.BytesIO(); image.save(b, format="PNG"); return b.getvalue()


def test_preprocess_dims_and_mask_roundtrip():
    raw = make_image()
    rgb = np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"))
    tensor, bbox, original = mod.prepare_input(rgb)
    assert tensor.shape == (1, 3, 1024, 1024)
    assert original == (480, 720)
    assert bbox[2:] == (682, 1024)
    mod.get_session = lambda style="auto": FakeSession()
    png, label = mod.infer_mask(raw, "auto")
    result = Image.open(io.BytesIO(png))
    assert result.size == (720, 480)
    assert result.mode == "L"
    assert label.startswith("SkyTNT ISNet")


def test_api_and_cors():
    mod.get_session = lambda style="auto": FakeSession()
    client = TestClient(mod.app)
    preflight = client.options(
        "/segment",
        headers={
            "Origin": "null",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == "null"
    assert preflight.headers.get("access-control-allow-private-network") == "true"
    response = client.post(
        "/segment",
        data={"style": "manga-bw"},
        files={"file": ("test.png", make_image(400, 300), "image/png")},
        headers={"Origin": "null"},
    )
    assert response.status_code == 200, response.text
    result = Image.open(io.BytesIO(response.content))
    assert result.size == (400, 300)
    assert response.headers.get("access-control-allow-origin") == "null"
    assert response.headers.get("x-mangacut-style") == "manga-bw"

if __name__ == "__main__":
    test_preprocess_dims_and_mask_roundtrip()
    test_api_and_cors()
    print("AI service tests passed")
