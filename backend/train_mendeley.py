#!/usr/bin/env python3
"""CLI Script: Train Stage 3 Supervised Calibrator on Mendeley Benchmark Dataset."""

import argparse
import json
import sys
from pathlib import Path

# Ensure backend root is in sys.path
BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal
from app.services.mendeley_pipeline import MendeleyPipeline


def main():
    parser = argparse.ArgumentParser(description="Train Stage 3 Supervised Grading Calibrator on Mendeley Exam Dataset")
    parser.add_argument("--limit", type=int, default=50, help="Number of student scripts to process (default: 50, max: 50)")
    parser.add_argument("--ocr-provider", type=str, default="auto", help="OCR engine provider strategy (auto, gemini, groq, openrouter, ollama, local_hybrid)")
    parser.add_argument("--dataset-dir", type=str, default=None, help="Path to Mendeley dataset directory")
    parser.add_argument("--force-refresh", action="store_true", help="Force recalculation and re-ingestion of all student records")
    args = parser.parse_args()

    print("=" * 76, flush=True)
    print("  SmartEd Studio — Mendeley Dataset Ingestion & Stage 3 Calibrator", flush=True)
    print(f"  Target Cohort Limit: {args.limit} Students | OCR Strategy: {args.ocr_provider}", flush=True)
    print("=" * 76, flush=True)

    d_dir = Path(args.dataset_dir) if args.dataset_dir else MendeleyPipeline.find_dataset_dir()
    print(f"  [Dataset Path]    : {d_dir}", flush=True)

    db = SessionLocal()
    try:
        res = MendeleyPipeline.ingest_cohort(
            db=db,
            dataset_dir=d_dir,
            limit=args.limit,
            ocr_provider=args.ocr_provider,
            force_refresh=args.force_refresh or (args.limit > 10),
        )
        print("\n  [✓] Successfully Ingested Exam & Submissions:", flush=True)
        print(f"      Exam Title: {res['exam_title']} (ID: {res['exam_id']})", flush=True)
        print(f"      Students Inscribed: {res['students_ingested']}", flush=True)

        metrics = res.get("training_metrics", {})
        if metrics and "metrics" in metrics:
            m = metrics["metrics"]
            cw = metrics["calibrated_weights"]
            print(f"\n  [✓] Stage 3 Supervised Calibrator Trained ({cw.get('cv_strategy', 'GroupKFold CV')}):", flush=True)
            print(f"      Mean Absolute Error (MAE) : {m.get('mean_absolute_error', 0.0):.4f} marks", flush=True)
            print(f"      Root Mean Squared Error   : {m.get('root_mean_squared_error', 0.0):.4f}", flush=True)
            print(f"      Accuracy Within 0.5 Marks : {m.get('accuracy_within_half_mark_pct', 0.0):.1f}%", flush=True)
            print(f"      Human-AI Correlation (r)  : {m.get('pearson_correlation', 0.0):.4f}", flush=True)
            print(f"      Learned Feature Weights   : {dict(zip(cw.get('feature_names', []), cw.get('weights', [])))}", flush=True)
            print(f"      Fit Intercept             : {cw.get('fit_intercept', False)}", flush=True)
            print("\n  [✓] Calibration Artifacts Saved:", flush=True)
            print("      - app/services/calibrated_weights.json", flush=True)
            print("      - data/mendeley_dataset/training_metrics.json", flush=True)
            print("      - data/mendeley_dataset/ocr_cache.json", flush=True)
        else:
            print("  [!] Training completed without metrics.", flush=True)

    finally:
        db.close()


if __name__ == "__main__":
    main()
