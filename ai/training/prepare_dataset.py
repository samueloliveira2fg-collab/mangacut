"""Validate MangaCut supervised samples and assemble SkyTNT's paired dataset."""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
import shutil
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

STYLES = {"auto", "manga-bw", "comic-color", "mixed"}

def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value).strip("_")[:70]
    return cleaned or "sample"

def resolve_sibling(folder: Path, value: str) -> Path:
    # Manifests are only allowed to point to sibling files, never arbitrary paths.
    name = Path(value).name
    if name != value or value in {"", ".", ".."}:
        raise ValueError(f"Nome de arquivo inválido no manifesto: {value!r}")
    return folder / name

def infer_style(image: Image.Image, declared: str) -> str:
    if declared in {"manga-bw", "comic-color", "mixed"}:
        return declared
    thumb = image.convert("RGB").resize((96, 96))
    pixels = list(thumb.getdata())
    # Simple saturation estimate used only as a metadata hint, not as ground truth.
    colorful = 0
    for r, g, b in pixels:
        if max(r, g, b) - min(r, g, b) > 35:
            colorful += 1
    return "comic-color" if colorful / max(1, len(pixels)) >= 0.08 else "manga-bw"

def main():
    parser = argparse.ArgumentParser(description="Validar e preparar pares imagem/máscara do MangaCut.")
    parser.add_argument("--source", type=Path, default=Path(__file__).parent / "samples")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "dataset")
    parser.add_argument("--style", choices=["all", "manga-bw", "comic-color", "mixed"], default="all")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    source = args.source.resolve(); output = args.output.resolve()
    if not source.exists():
        raise SystemExit(f"Pasta de amostras não encontrada: {source}")
    images_dir, masks_dir = output / "images", output / "masks"
    if output.exists() and args.overwrite:
        shutil.rmtree(output)
    images_dir.mkdir(parents=True, exist_ok=True); masks_dir.mkdir(parents=True, exist_ok=True)
    manifests = sorted(source.rglob("*.mcut-sample.json"))
    if not manifests:
        raise SystemExit("Nenhum *.mcut-sample.json encontrado. Baixe imagem, máscara e manifesto juntos do MangaCut.")
    rows=[]; skipped=[]; seen=set()
    for manifest_path in manifests:
        try:
            data=json.loads(manifest_path.read_text(encoding="utf-8"))
            if data.get("format") != "mangacut-supervised-sample":
                raise ValueError("formato de manifesto não reconhecido")
            if not data.get("reviewed_by_user"):
                raise ValueError("amostra não marcada como revisada")
            img_path=resolve_sibling(manifest_path.parent, data.get("input_file", ""))
            mask_path=resolve_sibling(manifest_path.parent, data.get("mask_file", ""))
            if not img_path.is_file() or not mask_path.is_file():
                raise ValueError("imagem original ou máscara não encontrada ao lado do manifesto")
            with Image.open(img_path) as raw_img:
                image=ImageOps.exif_transpose(raw_img).convert("RGB")
            with Image.open(mask_path) as raw_mask:
                mask=ImageOps.exif_transpose(raw_mask).convert("L")
            if image.size != mask.size:
                raise ValueError(f"dimensões diferentes: imagem {image.size}, máscara {mask.size}")
            w,h=image.size
            if w < 32 or h < 32:
                raise ValueError("imagem menor que 32 × 32 px")
            declared=data.get("image_style", "auto")
            if declared not in STYLES: declared="auto"
            style=infer_style(image, declared)
            if args.style != "all" and style != args.style:
                continue
            # Avoid overwriting on duplicate IDs from multiple downloaded folders.
            key=f"{manifest_path.as_posix()}|{img_path.name}|{mask_path.name}"
            uid=hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
            stem=f"mcut_{safe_name(data.get('id', manifest_path.stem))}_{uid}"
            if stem in seen: raise ValueError("identificador duplicado")
            seen.add(stem)
            out_img=images_dir / f"{stem}.png"; out_mask=masks_dir / f"{stem}.png"
            image.save(out_img, format="PNG", optimize=True)
            mask.save(out_mask, format="PNG", optimize=True)
            hist=mask.histogram(); total=max(1,w*h)
            foreground=sum(hist[77:]) / total
            rows.append({"id":stem,"style":style,"image":out_img.name,"mask":out_mask.name,"width":w,"height":h,"foreground_ratio":round(foreground,6),"source_manifest":str(manifest_path.relative_to(source))})
            if foreground < 0.005 or foreground > 0.995:
                print(f"AVISO: {manifest_path.name}: máscara quase vazia ou quase toda branca ({foreground:.1%}); revise.")
        except (OSError, ValueError, KeyError, json.JSONDecodeError, UnidentifiedImageError) as exc:
            skipped.append((str(manifest_path), str(exc)))
    if len(rows) < 5:
        raise SystemExit(f"Apenas {len(rows)} amostras válidas. São necessárias pelo menos 5; recomendado 50–100+ diversas por tipo para uma avaliação inicial.")
    csv_path=output / "dataset_manifest.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0].keys()));writer.writeheader();writer.writerows(rows)
    summary={"format":"mangacut-anime-seg-dataset","version":1,"total":len(rows),"by_style":{s:sum(1 for r in rows if r['style']==s) for s in ("manga-bw","comic-color","mixed")},"skipped":len(skipped),"warning":"SkyTNT's upstream data loader binarizes target masks at 0.3 and crops 10 px from each border; soft gray edges are not preserved as soft training labels in that loader."}
    (output / "dataset_summary.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding="utf-8")
    if skipped:
        (output / "skipped_samples.txt").write_text("\n".join(f"{p}: {e}" for p,e in skipped),encoding="utf-8")
    print(json.dumps(summary,indent=2,ensure_ascii=False))
    print(f"Pares preparados em: {output}")

if __name__ == "__main__": main()
