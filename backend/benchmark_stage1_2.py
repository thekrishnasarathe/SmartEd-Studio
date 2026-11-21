#!/usr/bin/env python3
"""
AstraGrade v3.0 — Stage 1 & 2 Benchmark CLI (benchmark_stage1_2.py).

Runs the full OpenCV pre-processing pipeline (Stage 1) and pluggable
multi-provider OCR extraction (Stage 2) on any image, PDF, or folder of
answer sheets, then prints a clean terminal summary table and persists
detailed results to JSON.

Usage:
    python benchmark_stage1_2.py --input uploads/
    python benchmark_stage1_2.py --input uploads/sheet_cse26_014.png
    python benchmark_stage1_2.py --input uploads/ --provider auto
    python benchmark_stage1_2.py --input uploads/ --provider gemini
"""

import argparse
import json
import sys
import time
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

import cv2
import numpy as np

from app.services.image_preprocess import ImagePreprocessor
from app.services.ocr_service import OCRService

BENCHMARK_DIR = Path(__file__).resolve().parent / "uploads" / "benchmark"
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".pdf"}

# Default expected questions (matches the seeded CS-502 exam)
DEFAULT_QUESTIONS = ["Q1", "Q2", "Q3", "Q4"]


def _truncate(text: str, max_len: int = 50) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _print_table(rows: list) -> None:
    """Print a clean, beautifully-aligned terminal table."""
    print()
    print("=" * 122)
    print(
        f"{'File':<24} {'Pages':>5} {'Deskew°':>8} {'Time(ms)':>9} │ "
        f"{'Q#':<5} {'Conf':>6} {'Strikethrough Ignored':<22} {'Text Preview':<38}"
    )
    print("-" * 122)

    for row in rows:
        first_answer = True
        answers = row.get("answers", [])
        if not answers:
            print(
                f"{row['file']:<24} {row['page_count']:>5} "
                f"{row['deskew_angle']:>8.2f} {row['stage1_time_ms']:>9.1f} │ "
                f"{'—':<5} {'—':>6} {'—':<22} {'(no OCR results)':<38}"
            )
        for ans in answers:
            prefix = (
                f"{row['file']:<24} {row['page_count']:>5} "
                f"{row['deskew_angle']:>8.2f} {row['stage1_time_ms']:>9.1f}"
                if first_answer
                else " " * 49
            )
            text_preview = _truncate(ans.get("transcribed_text", ""), 38)
            strikes = ans.get("strikethrough_ignored", [])
            strike_str = _truncate(", ".join(strikes) if strikes else "—", 20)
            conf = ans.get("ocr_confidence", 0.0)
            print(
                f"{prefix} │ {ans['question_number']:<5} {conf:>6.2f} "
                f"{strike_str:<22} {text_preview:<38}"
            )
            first_answer = False
    print("=" * 122)
    print()


def _save_side_by_side_composite(page_results: list, stem: str) -> None:
    """Creates and saves a visual side-by-side composite: Original | CLAHE | Binary."""
    for page in page_results:
        p_num = page.get("page_number", 1)
        orig_p = Path(page.get("original", ""))
        clahe_p = Path(page.get("clahe", ""))
        bin_p = Path(page.get("binary", ""))

        if not (orig_p.exists() and clahe_p.exists() and bin_p.exists()):
            continue

        try:
            im_orig = cv2.imread(str(orig_p))
            im_clahe = cv2.imread(str(clahe_p))
            im_bin = cv2.imread(str(bin_p))

            if im_orig is None or im_clahe is None or im_bin is None:
                continue

            # Ensure all 3 images are 3-channel BGR
            if len(im_clahe.shape) == 2:
                im_clahe = cv2.cvtColor(im_clahe, cv2.COLOR_GRAY2BGR)
            if len(im_bin.shape) == 2:
                im_bin = cv2.cvtColor(im_bin, cv2.COLOR_GRAY2BGR)

            target_h = 720
            scale = target_h / im_orig.shape[0]
            target_w = int(im_orig.shape[1] * scale)

            r_orig = cv2.resize(im_orig, (target_w, target_h))
            r_clahe = cv2.resize(im_clahe, (target_w, target_h))
            r_bin = cv2.resize(im_bin, (target_w, target_h))

            # Banner titles
            cv2.rectangle(r_orig, (0, 0), (target_w, 42), (25, 25, 25), -1)
            cv2.putText(r_orig, "1. ORIGINAL", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

            cv2.rectangle(r_clahe, (0, 0), (target_w, 42), (25, 25, 25), -1)
            cv2.putText(r_clahe, "2. SHADOW-NORMALIZED CLAHE", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (50, 220, 100), 2)

            cv2.rectangle(r_bin, (0, 0), (target_w, 42), (25, 25, 25), -1)
            cv2.putText(r_bin, "3. LINES SUPPRESSED BINARY", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (220, 150, 50), 2)

            composite = np.hstack([r_orig, r_clahe, r_bin])
            comp_path = BENCHMARK_DIR / f"{stem}_p{p_num}_side_by_side.png"
            cv2.imwrite(str(comp_path), composite)
        except Exception:
            pass


def run_benchmark(input_path: Path, provider: str) -> list:
    """Run Stage 1 + Stage 2 on every file and return structured results."""
    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)

    if input_path.is_file():
        files = [input_path]
    elif input_path.is_dir():
        # Discover genuine submission files, skipping generated derivatives and subdirs
        candidates = sorted(
            f
            for f in input_path.iterdir()
            if f.is_file()
            and f.suffix.lower() in SUPPORTED_EXTENSIONS
            and not f.name.endswith(("_original.png", "_clahe.png", "_binary.png", "_side_by_side.png"))
        )
        # Prefer base un-suffixed sheets if available
        base_sheets = [f for f in candidates if "_p" not in f.stem]
        files = base_sheets if base_sheets else candidates
    else:
        print(f"[ERROR] Path does not exist: {input_path}")
        sys.exit(1)

    if not files:
        print(f"[WARNING] No supported image/PDF files found in {input_path}")
        sys.exit(0)

    all_results = []

    for fpath in files:
        print(f"[STAGE 1] Processing OpenCV Pipeline: {fpath.name} ...")
        stem = fpath.stem

        # ── Stage 1: Image Pre-processing ──
        t0 = time.perf_counter()
        page_results = ImagePreprocessor.process_answer_sheet(
            fpath, BENCHMARK_DIR, stem
        )
        stage1_ms = round((time.perf_counter() - t0) * 1000, 1)

        page_count = len(page_results)
        deskew_angle = page_results[0].get("deskew_angle", 0.0) if page_results else 0.0

        # Create side-by-side comparison images
        _save_side_by_side_composite(page_results, stem)

        # Collect CLAHE image paths for OCR
        clahe_paths = [Path(pr["clahe"]) for pr in page_results]

        # ── Stage 2: OCR Extraction ──
        print(f"[STAGE 2] Pluggable OCR ({provider}) on {page_count} page(s) ...")
        t1 = time.perf_counter()
        answers, ocr_provider, ocr_warning = OCRService.extract_handwriting_multipage(
            page_image_paths=clahe_paths,
            expected_questions=DEFAULT_QUESTIONS,
            provider_override=provider,
        )
        stage2_ms = round((time.perf_counter() - t1) * 1000, 1)

        result = {
            "file": fpath.name,
            "page_count": page_count,
            "deskew_angle": deskew_angle,
            "stage1_time_ms": stage1_ms,
            "stage2_time_ms": stage2_ms,
            "ocr_provider": ocr_provider,
            "ocr_warning": ocr_warning,
            "pages": [dict(pr) for pr in page_results],
            "answers": answers,
        }
        all_results.append(result)

    return all_results


def main():
    parser = argparse.ArgumentParser(
        description="AstraGrade Stage 1 & 2 Benchmark — OpenCV Pipeline + OCR Extraction"
    )
    parser.add_argument(
        "--input",
        type=str,
        required=True,
        help="Path to an image, PDF, or folder of answer sheets.",
    )
    parser.add_argument(
        "--provider",
        type=str,
        default="auto",
        choices=["auto", "gemini", "groq", "openrouter", "ollama"],
        help="OCR provider to use (default: auto).",
    )
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    print()
    print("=" * 70)
    print("  AstraGrade v3.0 — Stage 1 & Stage 2 Benchmark Pipeline")
    print(f"  Target Input : {input_path}")
    print(f"  OCR Provider : {args.provider}")
    print(f"  Output Dir   : {BENCHMARK_DIR}")
    print("=" * 70)

    results = run_benchmark(input_path, args.provider)

    # Print terminal table
    _print_table(results)

    # Summary stats
    total_pages = sum(r["page_count"] for r in results)
    total_s1_ms = sum(r["stage1_time_ms"] for r in results)
    total_s2_ms = sum(r["stage2_time_ms"] for r in results)
    provider_used = results[0]["ocr_provider"] if results else "N/A"
    print(f"  Summary Statistics:")
    print(f"  -------------------")
    print(f"  Files processed : {len(results)}")
    print(f"  Total pages     : {total_pages}")
    print(f"  Stage 1 total   : {total_s1_ms:.1f} ms")
    print(f"  Stage 2 total   : {total_s2_ms:.1f} ms")
    print(f"  OCR Provider    : {provider_used}")
    print()

    # Save JSON report
    json_path = BENCHMARK_DIR / "ocr_benchmark_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"  ✓ Full benchmark output saved to: {json_path}")
    print()


if __name__ == "__main__":
    main()
