"""Fine-tune official SkyTNT ISNet on reviewed MangaCut image/mask pairs."""
from __future__ import annotations
import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from huggingface_hub import hf_hub_download

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO_DIR = HERE / "_anime-segmentation-source"
CKPT_REVISION = "a0a563c41338cbe0d23dfb4bfc3e243c518e5768"
CKPT_SHA256 = "2c8f6b9a77386c54dcdbf55b6c917108c4bdf4328abca9152c7bce5727b74d18"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print("\n> ", " ".join(str(x) for x in cmd), flush=True)
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Fine-tuning ISNet com dados revisados do MangaCut.")
    ap.add_argument("--dataset", type=Path, default=HERE / "dataset")
    ap.add_argument("--style", choices=["all", "manga-bw", "comic-color"], default="all")
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=1)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--data-split", type=float, default=0.8)
    ap.add_argument("--repo-dir", type=Path, default=REPO_DIR)
    args = ap.parse_args()

    try:
        import torch  # noqa: F401
    except Exception:
        print("PyTorch não está instalado. Instale-o pelo seletor oficial: https://pytorch.org/get-started/locally/")
        return 2
    dataset = args.dataset.resolve()
    manifest = dataset / "dataset_manifest.csv"
    if not manifest.is_file():
        print("Dataset ainda não preparado. Primeiro execute prepare_dataset.py.")
        return 2
    import csv
    with manifest.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if args.style != "all":
        rows = [r for r in rows if r.get("style") == args.style]
    if len(rows) < 10:
        print(f"Há apenas {len(rows)} pares para {args.style}. O mínimo operacional deste roteiro é 10; recomendado 50–100+ diversos por estilo.")
        return 2
    if args.epochs < 1 or args.epochs > 100:
        print("Use entre 1 e 100 épocas para este roteiro inicial.")
        return 2
    if not (0.6 <= args.data_split <= 0.9):
        print("data-split deve ficar entre 0.6 e 0.9 para reservar validação.")
        return 2

    # For style-specific training, materialize a filtered sibling dataset.
    if args.style != "all":
        import tempfile
        import json
        filtered = HERE / f"dataset_{args.style}"
        if filtered.exists(): shutil.rmtree(filtered)
        (filtered / "images").mkdir(parents=True)
        (filtered / "masks").mkdir(parents=True)
        filtered_rows=[]
        for row in rows:
            shutil.copy2(dataset / "images" / row["image"], filtered / "images" / row["image"])
            shutil.copy2(dataset / "masks" / row["mask"], filtered / "masks" / row["mask"])
            filtered_rows.append(row)
        import csv as csvmod
        with (filtered / "dataset_manifest.csv").open("w",newline="",encoding="utf-8-sig") as f:
            w=csvmod.DictWriter(f,fieldnames=list(filtered_rows[0].keys()));w.writeheader();w.writerows(filtered_rows)
        dataset=filtered

    if not args.repo_dir.exists():
        run(["git", "clone", "--depth", "1", "https://github.com/SkyTNT/anime-segmentation.git", str(args.repo_dir)])
    elif not (args.repo_dir / "train.py").is_file():
        print(f"A pasta {args.repo_dir} existe, mas não parece conter train.py. Renomeie-a para baixar uma cópia limpa.")
        return 2

    pretrained = Path(hf_hub_download(
        repo_id="skytnt/anime-seg",
        filename="isnetis.ckpt",
        revision=CKPT_REVISION,
        repo_type="model",
    ))
    if sha256(pretrained) != CKPT_SHA256:
        print("O checkpoint oficial não passou na verificação SHA-256. Treinamento cancelado.")
        return 3

    for name in ("fg", "bg"):
        (dataset / name).mkdir(parents=True, exist_ok=True)

    train_cmd = [
        sys.executable, "train.py", "--net", "isnet_is",
        "--pretrained-ckpt", str(pretrained),
        "--data-dir", str(dataset), "--fg-dir", "fg", "--bg-dir", "bg",
        "--img-dir", "images", "--mask-dir", "masks",
        "--img-ext", ".png", "--mask-ext", ".png",
        "--data-split", str(args.data_split), "--img-size", "1024",
        "--epoch", str(args.epochs),
        "--batch-size-train", str(args.batch_size), "--batch-size-val", "1",
        "--workers-train", str(args.workers), "--workers-val", str(args.workers),
        "--acc-step", "4", "--accelerator", "auto", "--devices", "1",
        "--fp32", "--val-epoch", "1", "--log-step", "1", "--cache", "0",
    ]
    run(train_cmd, cwd=args.repo_dir)

    checkpoints = list((args.repo_dir / "lightning_logs").glob("**/checkpoints/*.ckpt"))
    checkpoints = [p for p in checkpoints if p.name.lower() not in {"last.ckpt", "last-v1.ckpt"}] or checkpoints
    if not checkpoints:
        print("Treino terminou, mas nenhum checkpoint foi encontrado. Verifique lightning_logs.")
        return 4
    # ModelCheckpoint keeps the highest val/f1 plus a last checkpoint. Prefer the
    # best checkpoint whose filename includes val/f1; otherwise newest file.
    with_scores = [p for p in checkpoints if re.search(r"f1[=_-]([0-9.]+)", p.name, re.I)]
    best = max(with_scores, key=lambda p: float(re.search(r"f1[=_-]([0-9.]+)", p.name, re.I).group(1))) if with_scores else max(checkpoints, key=lambda p:p.stat().st_mtime)

    target_dir = ROOT / "ai_backend" / "models"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_name = {
        "all": "mangacut_isnet_v12_mixed.onnx",
        "manga-bw": "mangacut_isnet_v12_bw.onnx",
        "comic-color": "mangacut_isnet_v12_color.onnx",
    }[args.style]
    target = target_dir / target_name
    run([sys.executable, "export.py", "--net", "isnet_is", "--ckpt", str(best), "--to", "onnx", "--out", str(target), "--img-size", "1024"], cwd=args.repo_dir)
    print("\nFine-tuning concluído.")
    print(f"Checkpoint selecionado: {best}")
    print(f"Modelo exportado: {target}")
    print("Reabra o serviço local do MangaCut; ele selecionará o modelo correspondente ao estilo se disponível.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
