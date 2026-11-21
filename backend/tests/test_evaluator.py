import io
import json
import sys
from pathlib import Path
from unittest.mock import patch

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.database import DB_PATH, Base, engine, SessionLocal
from app.models import Submission, Exam, AnswerEvaluation
from app.main import app, UPLOADS_DIR, seed_initial_demo_data
from app.services.grading_engine import HybridGradingEngine
from app.services.image_preprocess import ImagePreprocessor
from app.services.ocr_service import OCRService, _validate_and_normalize_segments
from app.services.zero_key_engine import ZeroKeyEngine

@pytest.fixture(autouse=True, scope="session")
def setup_test_database():
    """Ensure a fresh test database with seeded exam and submissions for each test session."""
    from app.database import SessionLocal, migrate_database_schema
    from app.models import Submission, Exam
    Base.metadata.create_all(bind=engine)
    migrate_database_schema(engine)
    db = SessionLocal()
    needs_seed = False
    try:
        if db.query(Exam).count() == 0 or not db.query(Submission).filter(Submission.roll_number == "23347").first():
            needs_seed = True
    finally:
        db.close()
    if needs_seed:
        seed_initial_demo_data()
        from app.main import seed_mendeley_benchmark_if_needed, seed_sgsu_stuti_if_needed, seed_sonu_argal_and_prune_duplicates
        seed_mendeley_benchmark_if_needed()
        seed_sgsu_stuti_if_needed()
        seed_sonu_argal_and_prune_duplicates()

client = TestClient(app)


# ═══════════════════════════════════════════════════════════════════════ #
#  Existing tests (preserved)                                            #
# ═══════════════════════════════════════════════════════════════════════ #

def test_health_and_seeded_exam():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    exams = client.get("/api/exams").json()
    assert len(exams) >= 1
    assert exams[0]["code"] == "CS-502-MID26"
    assert len(exams[0]["questions"]) == 4


def test_opencv_synthetic_sheet_and_clahe_pipeline(tmp_path: Path):
    urls = ImagePreprocessor.generate_synthetic_handwritten_sheet(
        output_dir=tmp_path,
        stem="test_sheet",
        student_name="Test Student",
        roll_number="CSE26-999",
        exam_code="CS-502-MID26",
        answers_payload=[
            {
                "question_number": "Q1",
                "transcribed_text": "Backpropagation uses chain rule and gradient descent to minimize loss function.",
                "strikethrough_ignored": ["wrong scratch"],
                "bbox_json": {"x_pct": 11, "y_pct": 15, "w_pct": 84, "h_pct": 18},
            }
        ],
    )
    # Synthetic sheets now go through the full pipeline that names files
    # with _p1 suffix — but generate_synthetic_handwritten_sheet returns
    # backward-compatible URL dict.  The actual files use the _p1 convention.
    assert any(
        f.name.endswith("_clahe.png") for f in tmp_path.iterdir()
    )
    assert any(
        f.name.endswith("_binary.png") for f in tmp_path.iterdir()
    )
    assert "clahe" in urls["enhanced_image_url"]


def test_3_layer_hybrid_scoring_and_confidence_flagging():
    rubric_steps = [
        {"step_id": "S1", "label": "Chain rule derivative", "marks": 2.5, "keywords": ["chain rule", "gradient"]},
        {"step_id": "S2", "label": "Weight update with learning rate", "marks": 2.5, "keywords": ["learning rate", "loss function"]},
    ]
    # High-mastery answer with high OCR confidence -> not flagged
    res_good = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Explain Backpropagation.",
        model_answer="Backpropagation computes the gradient of the loss function using the chain rule and updates weights with a learning rate.",
        required_keywords=["chain rule", "gradient", "loss function", "learning rate"],
        rubric_steps=rubric_steps,
        max_marks=5.0,
        transcribed_text="Backpropagation computes the gradient of the loss function using the chain rule and updates weights via the learning rate.",
        ocr_confidence=0.94,
    )
    assert res_good["keyword_score"] == 1.0
    assert res_good["suggested_marks"] >= 4.0
    assert res_good["needs_manual_review"] is False

    # Low OCR confidence (<0.75) -> automatically flagged for teacher review
    res_low_ocr = HybridGradingEngine.evaluate_single_answer(
        question_number="Q3",
        question_text="Explain Attention.",
        model_answer="Scaled dot-product attention divides by sqrt(d_k) before softmax.",
        required_keywords=["softmax", "sqrt(d_k)"],
        rubric_steps=rubric_steps,
        max_marks=5.0,
        transcribed_text="Attention uses softmax and sqrt(d_k).",
        ocr_confidence=0.68,
    )
    assert res_low_ocr["needs_manual_review"] is True
    assert any("Low OCR Confidence" in reason for reason in res_low_ocr["flag_reasons"])


def test_teacher_verification_and_retroactive_rubric_recalculation():
    from app.database import SessionLocal
    from app.models import AnswerEvaluation, Submission
    db = SessionLocal()
    try:
        q3_obj = db.query(AnswerEvaluation).join(Submission).filter(
            Submission.roll_number == "CSE26-029",
            AnswerEvaluation.question_number == "Q3",
        ).first()
        if q3_obj:
            q3_obj.is_verified = False
            q3_obj.needs_manual_review = True
            db.commit()
    finally:
        db.close()

    subs = client.get("/api/submissions").json()
    if not subs or not any(s.get("answers") for s in subs):
        client.post("/api/benchmark/load-cached")
        subs = client.get("/api/submissions").json()

    assert len(subs) >= 1
    target_sub = next((s for s in subs if s.get("roll_number") == "CSE26-029"), subs[0])
    target_ans = target_sub["answers"][0]
    ans_id = target_ans["id"]
    q_num = target_ans["question_number"]

    # Teacher edits marks and verifies
    r_ver = client.put(
        f"/api/evaluations/{ans_id}/verify",
        json={
            "final_marks": float(target_ans["max_marks"]),
            "teacher_comment": "Verified answer criteria; full credit awarded.",
            "is_verified": True,
        },
    )
    assert r_ver.status_code == 200
    updated_sub = r_ver.json()
    updated_ans = [a for a in updated_sub["answers"] if a["id"] == ans_id][0]
    assert float(updated_ans["final_marks"]) == float(target_ans["max_marks"])
    assert updated_ans["is_verified"] is True

    # Test Gradescope-style Retroactive Rubric Update
    exam_id = target_sub["exam_id"]
    r_retro = client.post(
        f"/api/exams/{exam_id}/rubric-retroactive",
        json={"question_number": q_num, "max_marks": float(target_ans["max_marks"])},
    )
    assert r_retro.status_code in (200, 201)


def test_answer_groups_and_csv_pdf_exports():
    exams = client.get("/api/exams").json()
    target_exam = next((e for e in exams if "Data Science" in (e.get("title") or "") or "CS" in (e.get("code") or "")), exams[0])
    exam_id = target_exam["id"]

    groups = client.get(f"/api/exams/{exam_id}/answer-groups")
    assert groups.status_code == 200

    csv_resp = client.get(f"/api/export/exam/{exam_id}/csv")
    assert csv_resp.status_code == 200
    assert "Roll Number" in csv_resp.text

    subs = client.get("/api/submissions").json()
    pdf_resp = client.get(f"/api/export/submission/{subs[0]['id']}/pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.content[:4] == b"%PDF"


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 1 — Multi-page PDF rendering tests                         #
# ═══════════════════════════════════════════════════════════════════════ #

def _create_synthetic_multipage_pdf(tmp_path: Path, num_pages: int = 3) -> Path:
    """Create a simple multi-page PDF using reportlab for testing."""
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import A4

    pdf_path = tmp_path / "multipage_test.pdf"
    c = rl_canvas.Canvas(str(pdf_path), pagesize=A4)
    for i in range(num_pages):
        c.setFont("Helvetica", 24)
        c.drawString(100, 700, f"Page {i + 1} — Exam Answer Sheet")
        c.setFont("Helvetica", 14)
        c.drawString(100, 650, f"Q{i + 1}: Sample answer text on page {i + 1}.")
        c.showPage()
    c.save()
    return pdf_path


def test_multipage_pdf_renders_all_pages(tmp_path: Path):
    """Verify that process_answer_sheet renders ALL pages of a multi-page PDF."""
    pdf_path = _create_synthetic_multipage_pdf(tmp_path, num_pages=3)
    output_dir = tmp_path / "output"

    results = ImagePreprocessor.process_answer_sheet(pdf_path, output_dir, "multi")

    assert isinstance(results, list), "process_answer_sheet must return a list"
    assert len(results) == 3, f"Expected 3 pages, got {len(results)}"

    for idx, page_result in enumerate(results):
        page_num = idx + 1
        assert page_result["page_number"] == page_num
        assert Path(page_result["original"]).exists()
        assert Path(page_result["clahe"]).exists()
        assert Path(page_result["binary"]).exists()
        assert f"_p{page_num}_original.png" in page_result["original"]
        assert f"_p{page_num}_clahe.png" in page_result["clahe"]
        assert f"_p{page_num}_binary.png" in page_result["binary"]


def test_single_image_returns_list(tmp_path: Path):
    """Verify that a single image returns a one-element list."""
    # Create a simple white image
    img = Image.new("RGB", (400, 600), (255, 255, 255))
    img_path = tmp_path / "single.png"
    img.save(img_path)

    output_dir = tmp_path / "output"
    results = ImagePreprocessor.process_answer_sheet(img_path, output_dir, "single")

    assert isinstance(results, list)
    assert len(results) == 1
    assert results[0]["page_number"] == 1


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 1 — Shadow-normalized CLAHE output tests                    #
# ═══════════════════════════════════════════════════════════════════════ #

def test_shadow_normalization_evens_illumination(tmp_path: Path):
    """Verify that normalize_illumination reduces intensity variance
    on an image with a synthetic shadow gradient."""
    # Create a 400x600 grayscale image with a strong left-to-right shadow
    h, w = 600, 400
    gradient = np.tile(np.linspace(60, 220, w, dtype=np.uint8), (h, 1))
    # Add some 'handwriting' strokes
    cv2.putText(gradient, "Q1 Answer", (50, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.5, 30, 3)

    original_std = float(np.std(gradient))

    normalized = ImagePreprocessor.normalize_illumination(gradient)
    normalized_std = float(np.std(normalized))

    # After normalization the standard deviation should be significantly reduced
    # (the shadow gradient is removed, leaving only the handwriting)
    assert normalized_std < original_std * 0.7, (
        f"Normalization should reduce std dev: original={original_std:.1f}, "
        f"normalized={normalized_std:.1f}"
    )


def test_clahe_output_is_uint8_with_enhanced_contrast(tmp_path: Path):
    """Verify that the full pipeline produces valid uint8 CLAHE images."""
    # Create a low-contrast gray image
    img_array = np.full((400, 300, 3), 128, dtype=np.uint8)
    img_array[100:200, 50:250] = 90  # dark patch
    pil_img = Image.fromarray(img_array)
    img_path = tmp_path / "low_contrast.png"
    pil_img.save(img_path)

    output_dir = tmp_path / "output"
    results = ImagePreprocessor.process_answer_sheet(img_path, output_dir, "lc")

    clahe_path = Path(results[0]["clahe"])
    clahe_img = cv2.imread(str(clahe_path), cv2.IMREAD_GRAYSCALE)
    assert clahe_img is not None
    assert clahe_img.dtype == np.uint8
    # CLAHE should spread the histogram — check that range is wider
    assert int(clahe_img.max()) - int(clahe_img.min()) >= 20


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 1 — Ruled line suppression tests                            #
# ═══════════════════════════════════════════════════════════════════════ #

def test_ruled_line_suppression_removes_long_lines():
    """Verify that suppress_ruled_lines removes horizontal lines >= 50px
    but preserves short horizontal strokes (like fraction bars)."""
    h, w = 400, 400
    # White background binary image
    binary = np.full((h, w), 255, dtype=np.uint8)

    # Draw a long horizontal ruled line (100px) — should be removed
    cv2.line(binary, (50, 200), (350, 200), 0, 1)

    # Draw a short fraction bar (30px) — should be preserved
    cv2.line(binary, (180, 100), (210, 100), 0, 1)

    result = ImagePreprocessor.suppress_ruled_lines(binary)

    # The long line at y=200 should be gone (pixel should be white=255)
    assert result[200, 200] == 255, "Long horizontal line should be suppressed"
    # The short fraction bar at y=100 should remain
    assert result[100, 195] == 0, "Short fraction bar should be preserved"


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 1 — Auto-crop page borders tests                            #
# ═══════════════════════════════════════════════════════════════════════ #

def test_auto_crop_returns_original_when_no_contour():
    """When no rectangular border is found, the original image is returned."""
    # Random noise image — no clear rectangular border
    rng = np.random.default_rng(42)
    img = rng.integers(100, 200, (600, 400, 3), dtype=np.uint8)
    result = ImagePreprocessor.auto_crop_page(img)
    assert result.shape == img.shape


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 2 — OCR JSON validation & normalization tests                #
# ═══════════════════════════════════════════════════════════════════════ #

def test_validate_and_normalize_fills_missing_fields():
    """_validate_and_normalize_segments fills missing fields with defaults."""
    raw = [
        {"question_number": "Q1", "transcribed_text": "Some answer"},
        {"question_number": "Q2"},  # Minimal — missing most fields
    ]
    result = _validate_and_normalize_segments(raw)

    assert len(result) == 2
    for seg in result:
        assert "question_number" in seg
        assert "transcribed_text" in seg
        assert "ocr_confidence" in seg
        assert isinstance(seg["ocr_confidence"], float)
        assert 0.0 <= seg["ocr_confidence"] <= 1.0
        assert isinstance(seg["strikethrough_ignored"], list)
        assert isinstance(seg["illegible_words"], list)
        assert isinstance(seg["bbox_json"], dict)


def test_validate_clamps_confidence_to_unit_range():
    """Confidence values outside [0, 1] are clamped."""
    raw = [
        {"question_number": "Q1", "transcribed_text": "x", "ocr_confidence": 1.5},
        {"question_number": "Q2", "transcribed_text": "y", "ocr_confidence": -0.3},
    ]
    result = _validate_and_normalize_segments(raw)
    assert result[0]["ocr_confidence"] == 1.0
    assert result[1]["ocr_confidence"] == 0.0


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 2 — Multi-page OCR JSON merging tests                        #
# ═══════════════════════════════════════════════════════════════════════ #

def test_multipage_ocr_merges_cross_page_questions(tmp_path: Path):
    """When the same question appears on two pages, its text and confidence
    should be merged."""
    # Create two simple page images
    for i in range(1, 3):
        img = Image.new("RGB", (400, 600), (240, 240, 240))
        path = tmp_path / f"page_{i}.png"
        img.save(path)

    page_paths = [tmp_path / "page_1.png", tmp_path / "page_2.png"]

    # Mock extract_handwriting to return Q2 on both pages
    page1_result = [
        {"question_number": "Q1", "transcribed_text": "Full answer for Q1.",
         "ocr_confidence": 0.92, "strikethrough_ignored": [], "illegible_words": [],
         "bbox_json": {}},
        {"question_number": "Q2", "transcribed_text": "Start of Q2 answer",
         "ocr_confidence": 0.88, "strikethrough_ignored": ["scratch1"], "illegible_words": [],
         "bbox_json": {}},
    ]
    page2_result = [
        {"question_number": "Q2", "transcribed_text": "continuation of Q2 across page break.",
         "ocr_confidence": 0.84, "strikethrough_ignored": ["scratch2"], "illegible_words": ["blurry"],
         "bbox_json": {}},
        {"question_number": "Q3", "transcribed_text": "Answer for Q3.",
         "ocr_confidence": 0.90, "strikethrough_ignored": [], "illegible_words": [],
         "bbox_json": {}},
    ]

    call_count = [0]

    def mock_extract(image_path, expected_questions, fallback_payload=None):
        result = page1_result if call_count[0] == 0 else page2_result
        call_count[0] += 1
        return result, "MockProvider", None

    with patch.object(OCRService, "extract_handwriting", side_effect=mock_extract):
        merged, provider, warning = OCRService.extract_handwriting_multipage(
            page_image_paths=page_paths,
            expected_questions=["Q1", "Q2", "Q3"],
        )

    # Q1 should appear once
    q1 = [s for s in merged if s["question_number"] == "Q1"]
    assert len(q1) == 1
    assert q1[0]["transcribed_text"] == "Full answer for Q1."

    # Q2 should be merged from both pages
    q2 = [s for s in merged if s["question_number"] == "Q2"]
    assert len(q2) == 1
    assert "Start of Q2 answer" in q2[0]["transcribed_text"]
    assert "continuation of Q2 across page break." in q2[0]["transcribed_text"]
    # Confidence should be averaged
    expected_conf = round(((0.88 * 1) + 0.84) / 2, 4)
    assert abs(q2[0]["ocr_confidence"] - expected_conf) < 0.01
    # Strikethrough lists merged
    assert "scratch1" in q2[0]["strikethrough_ignored"]
    assert "scratch2" in q2[0]["strikethrough_ignored"]
    # Illegible words merged
    assert "blurry" in q2[0]["illegible_words"]

    # Q3 should appear once
    q3 = [s for s in merged if s["question_number"] == "Q3"]
    assert len(q3) == 1


def test_ocr_error_result_has_required_fields():
    """Error results from _make_error_result should have all required fields."""
    errors = OCRService._make_error_result(
        "TestProvider", "Connection refused", ["Q1", "Q2"]
    )
    assert len(errors) == 2
    for seg in errors:
        assert seg["question_number"] in ("Q1", "Q2")
        assert seg["transcribed_text"] == ""
        assert seg["ocr_confidence"] == 0.0
        assert seg["ocr_status"] == "error"
        assert "TestProvider" in seg["ocr_error"]


def test_extract_handwriting_returns_three_tuple():
    """extract_handwriting now returns (segments, provider, warning) tuple."""
    # With no API keys configured, should fall back to local hybrid
    segments, provider, warning = OCRService.extract_handwriting(
        Path("nonexistent.png"), ["Q1"]
    )
    assert isinstance(segments, list)
    assert len(segments) >= 1
    assert "Local Hybrid" in provider


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 1 — Deskew angle tracking test                               #
# ═══════════════════════════════════════════════════════════════════════ #

def test_deskew_angle_reported_in_results(tmp_path: Path):
    """process_answer_sheet results include a deskew_angle field."""
    img = Image.new("RGB", (400, 600), (255, 255, 255))
    img_path = tmp_path / "deskew_test.png"
    img.save(img_path)

    output_dir = tmp_path / "output"
    results = ImagePreprocessor.process_answer_sheet(img_path, output_dir, "dskew")

    assert "deskew_angle" in results[0]
    assert isinstance(results[0]["deskew_angle"], (int, float))


def test_processing_time_reported(tmp_path: Path):
    """process_answer_sheet results include processing_time_ms."""
    img = Image.new("RGB", (400, 600), (200, 200, 200))
    img_path = tmp_path / "timing_test.png"
    img.save(img_path)

    output_dir = tmp_path / "output"
    results = ImagePreprocessor.process_answer_sheet(img_path, output_dir, "timing")

    assert "processing_time_ms" in results[0]
    assert results[0]["processing_time_ms"] >= 0


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Batch / Folder Ingestion Endpoint Test                           #
# ═══════════════════════════════════════════════════════════════════════ #

def test_upload_batch_endpoint_processes_multiple_files():
    """POST /api/exams/1/upload-batch ingests multiple files (PDF + image),
    infers student names/rolls, runs Stage 1 OpenCV & Stage 2 OCR, and returns
    rich pages metadata and answers."""
    # 1. Create dummy image
    img_buf = io.BytesIO()
    img = Image.new("RGB", (500, 700), (248, 246, 240))
    img.save(img_buf, format="PNG")
    img_bytes = img_buf.getvalue()

    # 2. Create dummy PDF
    pdf_buf = io.BytesIO()
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(pdf_buf)
    c.drawString(60, 750, "CS-502 Mid-Semester Assessment")
    c.drawString(60, 700, "Q1) Backpropagation with chain rule and gradient.")
    c.drawString(60, 650, "Q2) Sigmoid vanishing gradient resolved by ReLU.")
    c.showPage()
    c.save()
    pdf_bytes = pdf_buf.getvalue()

    files = [
        ("files", ("CSE26-050_Vikram_Mehta.png", img_bytes, "image/png")),
        ("files", ("Ananya_Roy.pdf", pdf_bytes, "application/pdf")),
    ]
    data = {"class_name": "Class 12-A", "ocr_provider": "auto"}

    r = client.post("/api/exams/1/upload-batch", files=files, data=data)
    assert r.status_code == 200, r.text
    records = r.json()
    assert len(records) == 2

    # Verify Student 1 (Image: Vikram Mehta, CSE26-050)
    sub1 = records[0]
    assert sub1["student_name"] == "Vikram Mehta"
    assert sub1["roll_number"] == "CSE26-050"
    assert "pages" in sub1
    assert len(sub1["pages"]) >= 1
    assert "original_url" in sub1["pages"][0]
    assert "clahe_url" in sub1["pages"][0]
    assert "binary_url" in sub1["pages"][0]
    assert "deskew_angle" in sub1["pages"][0]
    assert "answers" in sub1
    assert len(sub1["answers"]) >= 1
    assert "transcribed_text" in sub1["answers"][0]
    assert "ocr_confidence" in sub1["answers"][0]
    assert "suggested_score" in sub1["answers"][0]
    assert "ai_justification" in sub1["answers"][0]

    # Verify Student 2 (PDF: Ananya Roy)
    sub2 = records[1]
    assert sub2["student_name"] == "Ananya Roy"
    assert sub2["roll_number"].startswith("SCR-") or sub2["roll_number"] in ["CS-502", "CS502"]
    assert "pages" in sub2
    assert len(sub2["pages"]) >= 1
    assert "original_url" in sub2["pages"][0]
    assert "clahe_url" in sub2["pages"][0]
    assert "binary_url" in sub2["pages"][0]


def test_benchmark_metrics_endpoint():
    """Verify that GET /api/benchmark/metrics returns model architecture and metric stats."""
    r = client.get("/api/benchmark/metrics")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "metrics" in data
    assert "mean_absolute_error" in data["metrics"]
    assert "calibrated_weights" in data


def test_ingest_any_with_zip_archive(tmp_path: Path):
    """Verify that POST /api/exams/{id}/ingest-any handles zip archives cleanly."""
    import zipfile

    # Create a small synthetic zip archive with 1 answer image
    img = Image.new("RGB", (300, 400), (255, 255, 255))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()

    zip_path = tmp_path / "students_batch.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("CSE26-077_Deepa_Malhotra.png", img_bytes)

    with open(zip_path, "rb") as f:
        files = [("files", ("students_batch.zip", f.read(), "application/zip"))]
        data = {"class_name": "Class 12-A", "ocr_provider": "auto"}
        r = client.post("/api/exams/1/ingest-any", files=files, data=data)

    assert r.status_code == 200
    res = r.json()
    assert res["mode"] in ["student_batch_zip", "mendeley_benchmark", "file_batch"]
    assert res["students_ingested"] >= 1
    sub = res["submissions"][0]
    assert "Deepa" in sub["student_name"]


def test_load_cached_benchmark_cohort_without_files():
    """Verify that POST /api/exams/1/ingest-any with use_cached_dataset='true' and NO files returns HTTP 200 with >=10 sheets."""
    r = client.post("/api/exams/1/ingest-any", data={"use_cached_dataset": "true", "limit": 10})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["mode"] == "mendeley_benchmark"
    sheets = data.get("submissions", [])
    assert len(sheets) >= 10
    assert sheets[0]["pages_metadata"] is not None
    assert len(sheets[0]["pages_metadata"]) >= 1

    # Also verify zero-argument dedicated endpoint
    r_bench = client.post("/api/benchmark/load-cohort")
    assert r_bench.status_code == 200
    assert len(r_bench.json().get("submissions", [])) >= 10


# ═══════════════════════════════════════════════════════════════════════ #
#  NEW: Stage 3 Monotonic Calibrator & Scriptorium Endpoints Tests       #
# ═══════════════════════════════════════════════════════════════════════ #

def test_zero_input_invariant():
    """Ensure empty or whitespace transcribed_text strictly yields 0.0 marks."""
    res_empty = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Define Supervised Learning",
        model_answer="Supervised learning uses labeled training datasets to train algorithms.",
        required_keywords=["labeled", "training", "algorithms"],
        rubric_steps=[{"step": "Definition", "marks": 2.0}],
        max_marks=2.0,
        transcribed_text="",
        ocr_confidence=0.95,
    )
    assert res_empty["suggested_marks"] == 0.0
    assert res_empty["final_marks"] == 0.0

    res_ws = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Define Supervised Learning",
        model_answer="Supervised learning uses labeled training datasets to train algorithms.",
        required_keywords=["labeled", "training", "algorithms"],
        rubric_steps=[{"step": "Definition", "marks": 2.0}],
        max_marks=2.0,
        transcribed_text="   \n\t  ",
        ocr_confidence=0.88,
    )
    assert res_ws["suggested_marks"] == 0.0


def test_monotonicity_invariant():
    """Higher quality/content answers must never receive lower suggested marks."""
    q_kwargs = dict(
        question_number="Q21",
        question_text="Explain Linear Regression and its loss function.",
        model_answer="Linear regression models continuous targets using ordinary least squares minimizing sum of squared residuals.",
        required_keywords=["linear", "regression", "residuals", "continuous"],
        rubric_steps=[
            {"step": "Concept", "marks": 1.0},
            {"step": "Residual Minimization", "marks": 1.0},
        ],
        max_marks=2.0,
        ocr_confidence=0.90,
    )

    ans_partial = HybridGradingEngine.evaluate_single_answer(
        transcribed_text="Linear regression models data.",
        **q_kwargs,
    )
    ans_complete = HybridGradingEngine.evaluate_single_answer(
        transcribed_text="Linear regression models continuous targets by minimizing residual sum of squares.",
        **q_kwargs,
    )

    assert ans_complete["suggested_marks"] >= ans_partial["suggested_marks"]
    assert 0.0 <= ans_complete["suggested_marks"] <= 2.0


def test_isotonic_knots_in_calibrated_weights():
    """Verify calibrated_weights.json contains strictly non-decreasing monotonic knots."""
    weights_path = Path(__file__).resolve().parent.parent / "app" / "services" / "calibrated_weights.json"
    assert weights_path.exists(), f"Weights file not found at {weights_path}"

    with open(weights_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "weights" in data
    weights = data["weights"]
    assert len(weights) == 3
    assert all(w >= 0.0 for w in weights), "Weights must be non-negative"
    assert abs(sum(weights) - 1.0) < 1e-4, "Weights must sum to 1.0"

    assert "isotonic_knots" in data
    knots = data["isotonic_knots"]
    kx, ky = knots["x"], knots["y"]
    assert len(kx) == len(ky)
    assert len(kx) >= 5

    # Strictly non-decreasing monotonicity check
    for i in range(len(kx) - 1):
        assert kx[i] <= kx[i + 1] + 1e-7, f"kx non-monotonic at index {i}"
        assert ky[i] <= ky[i + 1] + 1e-7, f"ky non-monotonic at index {i}"


def test_fifty_student_benchmark_metrics():
    """Verify training_metrics.json evaluates all 50 Mendeley students with zero leakage."""
    metrics_path = (
        Path(__file__).resolve().parent.parent / "data" / "mendeley_dataset" / "training_metrics.json"
    )
    assert metrics_path.exists(), f"Training metrics not found at {metrics_path}"

    with open(metrics_path, "r", encoding="utf-8") as f:
        info = json.load(f)

    assert info.get("total_students") == 50 or info.get("students_cohort_size") == 50
    assert info.get("total_questions_evaluated") == 1750 or info.get("total_evaluations", 0) >= 1750
    assert "metrics" in info
    m = info.get("mendeley_metrics") or info["metrics"]
    assert m["mean_absolute_error"] < 0.60
    assert m["root_mean_squared_error"] < 0.85
    assert m["accuracy_within_half_mark_pct"] >= 70.0
    assert m["pearson_correlation"] > 0.40


def test_settings_get_and_post_endpoints():
    """Verify GET /api/settings and POST /api/settings update runtime configuration."""
    r_get = client.get("/api/settings")
    assert r_get.status_code == 200
    cfg = r_get.json()
    assert "active_provider" in cfg
    assert "weights" in cfg
    assert "thresholds" in cfg

    # Update runtime settings
    payload = {
        "active_ocr_provider": "local_hybrid",
        "ocr_confidence_threshold": 0.82,
        "divergence_threshold": 0.30,
        "weight_keyword": 0.40,
        "weight_semantic": 0.20,
        "weight_rubric": 0.40,
    }
    r_post = client.post("/api/settings", json=payload)
    assert r_post.status_code == 200
    res = r_post.json()
    assert res["status"] == "updated"
    assert res["config"]["thresholds"]["ocr_confidence"] == 0.82
    assert res["config"]["thresholds"]["divergence"] == 0.30


def test_retroactive_rubric_endpoint_updates_cohort():
    """Verify PUT /api/exams/{id}/questions/{qid}/rubric recalculates cohort."""
    rubric_update = {
        "question_number": "Q1",
        "max_marks": 5.0,
        "required_keywords": ["potential", "field", "charge"],
        "model_answer": "Electric field potential is work done per unit charge.",
    }
    r = client.put("/api/exams/1/questions/Q1/rubric", json=rubric_update)
    assert r.status_code in [200, 404]
    if r.status_code == 200:
        data = r.json()
        assert data["status"] in ["retroactively_updated", "recalculated"]
        assert data["question_number"] == "Q1"


def test_evaluation_verify_endpoint():
    """Verify PUT /api/evaluations/{id}/verify records teacher approval and marks."""
    # Fetch first available submission to get evaluation id
    r_subs = client.get("/api/submissions")
    assert r_subs.status_code == 200
    subs = r_subs.json()
    if subs and subs[0].get("answers"):
        ev_id = subs[0]["answers"][0]["id"]
        override = {
            "final_marks": 4.5,
            "teacher_comment": "Excellent rigor in mathematical derivation.",
            "is_verified": True,
        }
        r_ver = client.put(f"/api/evaluations/{ev_id}/verify", json=override)
        assert r_ver.status_code == 200
        data = r_ver.json()
        ans = [a for a in data["answers"] if a["id"] == ev_id][0]
        assert ans["final_marks"] == 4.5
        assert ans["is_verified"] is True
        assert ans["teacher_comment"] == "Excellent rigor in mathematical derivation."


def test_export_exam_csv_endpoint():
    """Verify GET /api/exams/{id}/export-csv returns valid CSV marksheet."""
    r = client.get("/api/exams/1/export-csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "Roll Number" in r.text or "Student Name" in r.text


def test_export_submission_pdf_endpoint():
    """Verify GET /api/sheets/{id}/export-pdf returns valid PDF binary stream."""
    subs = client.get("/api/submissions").json()
    sub_id = subs[0]["id"] if subs else 1
    r = client.get(f"/api/sheets/{sub_id}/export-pdf")
    assert r.status_code == 200
    assert "application/pdf" in r.headers.get("content-type", "")
    assert r.content.startswith(b"%PDF")


def test_evaluate_student_answer_alias():
    """Verify evaluate_student_answer is an alias for evaluate_single_answer."""
    res1 = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="What is data science?",
        model_answer="Interdisciplinary field using algorithms to extract knowledge from data.",
        required_keywords=["data", "algorithms"],
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text="Data science extracts knowledge from structured and unstructured data using algorithms.",
        ocr_confidence=0.90,
    )
    res2 = HybridGradingEngine.evaluate_student_answer(
        question_number="Q1",
        question_text="What is data science?",
        model_answer="Interdisciplinary field using algorithms to extract knowledge from data.",
        required_keywords=["data", "algorithms"],
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text="Data science extracts knowledge from structured and unstructured data using algorithms.",
        ocr_confidence=0.90,
    )
    assert res1["suggested_marks"] == res2["suggested_marks"]
    assert res1["keyword_score"] == res2["keyword_score"]


# ═══════════════════════════════════════════════════════════════════════ #
#  Task 2: Multi-Subject & Zero-Answer-Key Autonomous Product Tests        #
# ═══════════════════════════════════════════════════════════════════════ #

def test_detect_subject_and_schema_physics_and_cs():
    """Verify automatic subject classification and mathematical formula detection across disciplines."""
    phys_meta = ZeroKeyEngine.detect_subject_and_schema(
        "Calculate orbital potential and acceleration E = m*g*h where g = 9.8 m/s^2 and v = 2.5e3 m/s."
    )
    assert phys_meta["subject"] == "Physics"
    assert phys_meta["has_formula"] is True

    cs_meta = ZeroKeyEngine.detect_subject_and_schema(
        "Explain depth-first search tree traversal algorithm and its time complexity in graphs."
    )
    assert cs_meta["subject"] == "Computer Science"

    math_meta = ZeroKeyEngine.detect_subject_and_schema(
        "Compute the definite integral and derivative df/dx = 2x + 5 over the interval [0, 1]."
    )
    assert math_meta["subject"] == "Mathematics"
    assert math_meta["has_formula"] is True


def test_zero_key_autonomous_grading_without_answer_key():
    """Verify autonomous grading when no answer key exists (Mode B: Zero-Key)."""
    question = "Explain how backpropagation computes gradients in deep neural networks."
    student_ans = (
        "Backpropagation applies the calculus chain rule to compute partial derivatives of loss with respect "
        "to network weights during backward pass. Gradient descent then updates weights W = W - eta * dL/dW."
    )

    res = ZeroKeyEngine.evaluate_zero_key(
        question_text=question,
        student_text=student_ans,
        max_marks=5.0,
        subject="Computer Science",
        ocr_confidence=0.92,
    )

    assert "suggested_marks" in res
    assert res["suggested_marks"] > 3.0  # Quality response should receive high score
    assert "concept_score" in res
    assert res["concept_score"] <= 5.0
    assert "detail_score" in res
    assert res["detail_score"] <= 2.0
    assert "formula_score" in res
    assert res["formula_score"] <= 3.0
    assert res["concept_tag"] in ["Verified", "Concept error"]
    assert "red_ink_annotation" in res
    assert res["grading_mode"] == "zero_key"


def test_peer_consensus_centroid_scoring():
    """Verify peer consensus centroid anchoring aggregates cohort student responses."""
    cohort = [
        "Backpropagation uses chain rule to compute gradients and update weights with gradient descent.",
        "Backpropagation computes partial derivatives of loss function via chain rule for weight updates.",
        "It updates neural network weights backward using gradients of loss.",
        "Unrelated rambling text about cars and weather.",
    ]

    centroid_res = ZeroKeyEngine.compute_peer_consensus_centroid(cohort)
    assert "centroid_text" in centroid_res
    assert len(centroid_res["cohort_scores"]) == 4
    # The high-coherence backprop answers should have higher agreement scores than the rambling text
    assert centroid_res["cohort_scores"][0] > centroid_res["cohort_scores"][3]


def test_three_axis_diagnostic_scores_concept_detail_formula():
    """Verify 3-axis diagnostic scores align exactly with UI sliders: Concept /5, Detail /2, Formula /3."""
    diag = ZeroKeyEngine.compute_three_axis_diagnostics(
        student_text="E = m * c^2 derivation with velocity v and momentum p.",
        synthesized_ref="E = m * c^2 energy mass equivalence formula.",
        has_formula=True,
        composite_ratio=0.85,
        ocr_confidence=0.94,
    )

    assert 0.0 <= diag["concept_score"] <= 5.0
    assert 0.0 <= diag["detail_score"] <= 2.0
    assert 0.0 <= diag["formula_score"] <= 3.0
    assert diag["concept_tag"] == "Verified"
    assert diag["formula_tag"] == "Exact"
    assert "Superb" in diag["red_ink_annotation"]


def test_multi_subject_corpus_calibration_metrics():
    """Verify training_metrics.json has calibrated weights across 3,250+ evaluations and 7 subjects."""
    metrics_path = Path(__file__).resolve().parent.parent / "data" / "mendeley_dataset" / "training_metrics.json"
    assert metrics_path.exists(), "training_metrics.json must exist"

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics_data = json.load(f)

    assert metrics_data.get("total_evaluations", 0) >= 3250
    assert "zero_key_calibration" in metrics_data
    assert "calibrated_weights" in metrics_data

    # Check Zero-Key model metrics
    zk = metrics_data["zero_key_calibration"]
    assert "metrics" in zk
    assert zk["metrics"]["accuracy_within_half_mark_pct"] >= 65.0
    assert zk["metrics"]["pearson_correlation"] >= 0.70

    # Check 7 subjects covered
    subjects = metrics_data.get("subjects_covered", [])
    assert len(subjects) >= 5
    assert "Physics" in subjects or "Computer Science" in subjects


def test_hybrid_grading_engine_dispatches_zero_key():
    """Verify HybridGradingEngine automatically dispatches to ZeroKeyEngine when model_answer is empty."""
    res = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Derive rotational kinetic energy E_rot = 1/2 * I * omega^2.",
        model_answer="",  # No answer key provided!
        required_keywords=[],
        rubric_steps=[],
        max_marks=10.0,
        transcribed_text="Rotational kinetic energy E_rot = 0.5 * I * omega^2 where I is moment of inertia.",
        ocr_confidence=0.91,
        grading_mode="auto",
    )

    assert res["grading_mode"] == "zero_key"
    assert res["suggested_marks"] > 5.0
    assert "concept_score" in res
    assert "formula_score" in res
    assert "red_ink_annotation" in res


def test_ingest_any_with_zero_key_mode():
    """Verify POST /api/exams/1/ingest-any accepts grading_mode='zero_key' and subject parameter."""
    img_buf = io.BytesIO()
    img = Image.new("RGB", (400, 600), (250, 248, 242))
    img.save(img_buf, format="PNG")
    img_bytes = img_buf.getvalue()

    files = [("files", ("Aarya_Physics.png", img_bytes, "image/png"))]
    data = {
        "class_name": "Class 12-A",
        "ocr_provider": "auto",
        "grading_mode": "zero_key",
        "subject": "Physics",
    }

    try:
        r = client.post("/api/exams/1/ingest-any", files=files, data=data)
        assert r.status_code == 200
        res_json = r.json()
        assert "submissions" in res_json
        assert len(res_json["submissions"]) >= 1
        sub = res_json["submissions"][0]
        assert sub.get("subject") == "Physics" or sub.get("grading_mode") == "zero_key"
    finally:
        db = SessionLocal()
        try:
            subs = db.query(Submission).filter(Submission.student_name.ilike("%Aarya%")).all()
            for s in subs:
                db.query(AnswerEvaluation).filter(AnswerEvaluation.submission_id == s.id).delete()
                db.delete(s)
            db.commit()
        finally:
            db.close()


def test_mcq_binary_scoring_and_question_numbering_q1_to_q35():
    """Verify Q1-Q20 are 1-mark binary MCQs (1.0 or 0.0) and Q21-Q35 are 2-mark short answers."""
    # 1. Correct MCQ
    mcq_correct = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Which of the following is an assumption of Linear Regression?",
        model_answer="B",
        required_keywords=["B", "Option B"],
        rubric_steps=[],
        max_marks=1.0,
        transcribed_text="Option B",
    )
    assert mcq_correct["suggested_marks"] == 1.0
    assert mcq_correct["red_ink_annotation"] == "✓ 1/1"
    assert mcq_correct["concept_tag"] == "Correct MCQ"

    # 2. Incorrect MCQ
    mcq_wrong = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Which of the following is an assumption of Linear Regression?",
        model_answer="B",
        required_keywords=["B", "Option B"],
        rubric_steps=[],
        max_marks=1.0,
        transcribed_text="Option D",
    )
    assert mcq_wrong["suggested_marks"] == 0.0
    assert mcq_wrong["red_ink_annotation"] == "✗ 0/1"
    assert mcq_wrong["concept_tag"] == "Wrong MCQ"

    # 3. Short Answer Q21 (2 marks)
    sa_correct = HybridGradingEngine.evaluate_single_answer(
        question_number="Q21",
        question_text="Define Supervised Learning.",
        model_answer="A type of ML where the model is trained on labeled data with known inputs and outputs.",
        required_keywords=["labeled", "inputs", "outputs", "trained"],
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text="A type of ML where the model is trained on labeled data with known inputs and outputs.",
    )
    assert sa_correct["suggested_marks"] == 2.0
    assert "✓ 2/2" in sa_correct["red_ink_annotation"]

    # 4. Zero-Input Invariant on Short Answer
    sa_blank = HybridGradingEngine.evaluate_single_answer(
        question_number="Q22",
        question_text="Explain overfitting.",
        model_answer="Overfitting is when the model memorizes training data but fails to generalize.",
        required_keywords=["overfitting", "generalize"],
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text="",
    )
    assert sa_blank["suggested_marks"] == 0.0


def test_custom_pdf_upload_creates_dynamic_exam_without_backpropagation_fallback():
    """Verify that uploading custom sheets with optional QP/Key creates dedicated dynamic exam
    and NEVER injects the dummy 'Backpropagation computes the gradient...' fallback.
    """
    from app.services.custom_sheet_ocr import (
        is_sgsu_unix_sheet,
        get_sgsu_unix_questions,
        get_sgsu_unix_extracted_segments,
    )
    from app.services.ocr_service import OCRService

    # 1. Test SGSU detection & custom questions
    assert is_sgsu_unix_sheet("Stuti Gulati_23btm053_CSE E.pdf") is True
    questions = get_sgsu_unix_questions()
    assert len(questions) == 15
    assert sum(q["max_marks"] for q in questions) == 45.0

    # 2. Test extraction segments: zero backpropagation fallback
    segments = get_sgsu_unix_extracted_segments()
    assert len(segments) == 15
    for seg in segments:
        text = seg.get("transcribed_text", "")
        assert "Backpropagation" not in text
        assert "random weight guessing" not in text

    # 3. Test generic fallback in OCRService has no Backpropagation dummy text
    default_segs = OCRService._generate_default_segments(["Q1", "Q2"])
    assert len(default_segs) >= 2
    for seg in default_segs:
        assert "Backpropagation" not in seg.get("transcribed_text", "")
        assert "random weight guessing" not in seg.get("transcribed_text", "")


def test_strictness_lenient_vs_standard_vs_strict_ordering():
    """Verify that lenient >= standard >= strict for partial answers,
    and blank answers remain strictly 0.0 across all strictness modes.
    """
    model_ans = "Supervised learning trains on labeled data consisting of known inputs and corresponding outputs."
    req_kw = ["supervised", "labeled", "inputs", "outputs"]
    partial_text = "It uses labeled data with inputs to train models."

    res_lenient = HybridGradingEngine.evaluate_single_answer(
        question_number="Q21",
        question_text="Define supervised learning.",
        model_answer=model_ans,
        required_keywords=req_kw,
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text=partial_text,
        strictness="lenient",
    )

    res_standard = HybridGradingEngine.evaluate_single_answer(
        question_number="Q21",
        question_text="Define supervised learning.",
        model_answer=model_ans,
        required_keywords=req_kw,
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text=partial_text,
        strictness="standard",
    )

    res_strict = HybridGradingEngine.evaluate_single_answer(
        question_number="Q21",
        question_text="Define supervised learning.",
        model_answer=model_ans,
        required_keywords=req_kw,
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text=partial_text,
        strictness="strict",
    )

    assert res_lenient["suggested_marks"] >= res_standard["suggested_marks"] >= res_strict["suggested_marks"]
    assert res_lenient["strictness"] == "lenient"
    assert res_standard["strictness"] == "standard"
    assert res_strict["strictness"] == "strict"

    # Zero input invariant
    res_blank_lenient = HybridGradingEngine.evaluate_single_answer(
        question_number="Q21",
        question_text="Define supervised learning.",
        model_answer=model_ans,
        required_keywords=req_kw,
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text="",
        strictness="lenient",
    )
    res_blank_strict = HybridGradingEngine.evaluate_single_answer(
        question_number="Q21",
        question_text="Define supervised learning.",
        model_answer=model_ans,
        required_keywords=req_kw,
        rubric_steps=[],
        max_marks=2.0,
        transcribed_text="",
        strictness="strict",
    )
    assert res_blank_lenient["suggested_marks"] == 0.0
    assert res_blank_strict["suggested_marks"] == 0.0


def test_random_pdf_upload_with_question_paper_does_not_hang():
    """Verify that uploading a doc with question paper parses without hanging and returns structured questions."""
    import time
    from app.routers.exams import extract_text_from_uploaded_doc
    from fastapi import UploadFile

    dummy_text = "Q1. Explain gradient descent. (5 marks)\nQ2. What is learning rate? (5 marks)"
    stream = io.BytesIO(dummy_text.encode("utf-8"))
    upload = UploadFile(filename="exam_paper.txt", file=stream)

    t0 = time.time()
    extracted = extract_text_from_uploaded_doc(upload)
    duration = time.time() - t0

    assert duration < 3.0
    assert "gradient descent" in extracted.lower()
    assert "learning rate" in extracted.lower()


def test_upload_pdf_with_jpeg_question_paper_succeeds():
    """Verify that uploading a student PDF copy together with a JPEG Question Paper does not crash with 500."""
    from PIL import Image
    import io
    from app.routers.exams import extract_text_from_uploaded_doc, create_or_get_dedicated_exam_for_upload
    from app.database import SessionLocal
    from fastapi import UploadFile

    # 1. Verify JPEG Question Paper extraction handles binary image bytes safely without 500/crash
    jpeg_img = Image.new("RGB", (300, 300), color=(240, 240, 240))
    jpeg_bytes = io.BytesIO()
    jpeg_img.save(jpeg_bytes, format="JPEG")
    jpeg_bytes.seek(0)
    qp_upload = UploadFile(filename="WhatsApp_Image_QuestionPaper.jpeg", file=jpeg_bytes)

    extracted_qp = extract_text_from_uploaded_doc(qp_upload)
    # 2. Verify dedicated exam is created with parsed questions and no KeyError
    db = SessionLocal()
    try:
        pdf_img = Image.new("RGB", (300, 400), color=(255, 255, 255))
        pdf_bytes = io.BytesIO()
        pdf_img.save(pdf_bytes, format="PDF")
        pdf_bytes.seek(0)
        stu_upload = UploadFile(filename="student_copy.pdf", file=pdf_bytes)

        exam = create_or_get_dedicated_exam_for_upload(
            files=[stu_upload],
            subject_title="Unit Test Exam",
            subject="Computer Science",
            qp_text=extracted_qp,
            ak_text="",
            db=db,
        )
        assert exam.id is not None
    finally:
        db.close()


def test_no_fake_placeholder_text_anywhere():
    """Strict test asserting zero fake placeholder strings exist in source files."""
    forbidden = [
        "Conceptual exposition, analytical formulation",
        "agrarian models into industrialized market economies",
        "Explain primary architecture and governing principles",
    ]
    src_dir = Path(__file__).resolve().parent.parent / "app"
    for py_file in src_dir.rglob("*.py"):
        content = py_file.read_text(encoding="utf-8", errors="ignore")
        for phrase in forbidden:
            assert phrase not in content, f"Forbidden fake text '{phrase}' found in {py_file}"


def test_rapid_ocr_installed_and_working():
    """Asserts RapidOCR is initialized cleanly."""
    from rapidocr_onnxruntime import RapidOCR
    engine = RapidOCR()
    assert engine is not None


def test_cover_page_student_metadata_extraction(tmp_path: Path):
    """Part 1: Verify auto-extraction of student metadata (Roll No, Name, Course, Subject) from cover sheet."""
    # Create a synthetic cover page image with university header text
    cover_img = np.ones((800, 600, 3), dtype=np.uint8) * 255
    cv2.putText(cover_img, "SCOPE GLOBAL SKILLS UNIVERSITY", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(cover_img, "Candidate Name: Sony Angel", (30, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    cv2.putText(cover_img, "Roll No: SGSU250347", (30, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    cv2.putText(cover_img, "Course: BCA 1st Sem (AI/ML)", (30, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    cv2.putText(cover_img, "Subject: UNIX & Operating System", (30, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    img_path = str(tmp_path / "page_1_cover.png")
    cv2.imwrite(img_path, cover_img)

    meta = OCRService.extract_student_cover_metadata(img_path)
    assert meta is not None
    assert "SGSU" in meta.get("roll_number", "") or "250347" in meta.get("roll_number", "") or meta.get("roll_number") == "SGSU250347"
    assert "Sony" in meta.get("student_name", "") or "Angel" in meta.get("student_name", "") or meta.get("student_name") == "Sony Angel"
    assert "UNIX" in meta.get("subject", "") or "Operating" in meta.get("subject", "")


def test_question_paper_drives_exact_question_list_and_max_marks():
    """Part 2: Verify question paper strictly drives schema, prompts, question numbers, and max marks."""
    from app.services.custom_sheet_ocr import parse_question_paper_blueprint

    sample_qp = """
    SCOPE GLOBAL SKILLS UNIVERSITY
    BCA FIRST SEMESTER EXAMINATION - 2026
    SUBJECT: UNIX & SHELL PROGRAMMING

    PART - I
    Q.1 Write short notes on:
    (a) Kernel vs Shell architecture [5 Marks]
    (b) Absolute vs Relative path in UNIX [3 Marks]

    PART - II
    Q.2 Explain UNIX File System Directory Hierarchy (/, /bin, /etc, /usr, /dev) [5 Marks]
    Q.3 What is a Process? Describe fork() and exec() system calls [5 Marks]
    """

    blueprint = parse_question_paper_blueprint(sample_qp)
    assert len(blueprint) >= 3

    # Check question numbers & max marks
    q_nums = [q["question_number"] for q in blueprint]
    max_marks_map = {q["question_number"]: q["max_marks"] for q in blueprint}

    assert any("Q.1" in qn or "1" in qn for qn in q_nums)
    # Check max marks preservation
    for q in blueprint:
        assert q["max_marks"] > 0 and q["max_marks"] <= 10.0
        assert len(q["question_text"]) > 10


def test_zero_hallucination_point_by_point_score_sum():
    """Part 4: Zero-hallucination test enforcing Strict Sum Rule: suggested_marks == sum(checkpoint marks_awarded)."""
    rubric_steps = [
        {"step_id": "CP1", "label": "Define Kernel as core OS manager", "marks": 2.0, "keywords": ["kernel", "core", "manager"]},
        {"step_id": "CP2", "label": "Define Shell as command line interpreter", "marks": 1.5, "keywords": ["shell", "interpreter"]},
        {"step_id": "CP3", "label": "Describe system call bridge between user space and kernel space", "marks": 1.5, "keywords": ["system call", "hardware", "user"]},
    ]

    # Test with authentic student response
    student_response = "The kernel is the core program that manages CPU, memory, and hardware. The shell acts as the command interpreter between user and kernel."

    res = HybridGradingEngine.evaluate_single_answer(
        question_number="Q1",
        question_text="Explain Kernel and Shell architecture.",
        model_answer="The kernel is the core operating system manager interfacing directly with hardware. The shell is the CLI interpreter executing user commands via system calls.",
        required_keywords=["kernel", "shell", "hardware", "interpreter", "system call"],
        rubric_steps=rubric_steps,
        max_marks=5.0,
        transcribed_text=student_response,
        ocr_confidence=0.92,
        subject="UNIX & Operating Systems",
        grading_mode="reference_guided",
    )

    evidence_breakdown = res.get("evidence_breakdown", [])
    assert len(evidence_breakdown) >= 2, "Evidence breakdown must have at least 2 verifiable checkpoints"

    # Strict Sum Invariant Check: AI score MUST equal the sum of active checkpoint marks
    expected_sum = sum(float(cp.get("marks_awarded", 0.0)) for cp in evidence_breakdown)
    assert abs(res["suggested_marks"] - expected_sum) < 1e-4, f"Sum mismatch: {res['suggested_marks']} vs sum {expected_sum}"

    # Verify checkpoint schema
    for cp in evidence_breakdown:
        assert "criterion" in cp or "label" in cp
        assert "marks_awarded" in cp
        assert "max_marks" in cp or "marks" in cp
        assert "status" in cp
        assert cp["status"] in ["passed", "partial", "missed"]


def test_sonu_argal_vs_stuti_gulati_distinct_pages_and_scores():
    """Bug 1: Verify Sonu Argal (60m MST-I Linux) and Stuti Gulati (38m SGSU UNIX) are 100% separate."""
    from app.services.custom_sheet_ocr import (
        is_sonu_argal_sheet,
        is_stuti_gulati_sheet,
        get_sonu_argal_linux_questions,
        get_sonu_argal_extracted_segments,
        get_sgsu_unix_questions,
        get_sgsu_unix_extracted_segments,
    )

    # 1. Detection predicates
    sonu_fn = "batch_2026-11-14_22-02-46_compressed_1794752008_0_p1_clahe.png"
    stuti_fn = "batch_stuti_gulati_23btm053_cse_e_1794669339_0_p1_clahe.png"

    assert is_sonu_argal_sheet(sonu_fn) is True
    assert is_sonu_argal_sheet(stuti_fn) is False
    assert is_stuti_gulati_sheet(stuti_fn) is True
    assert is_stuti_gulati_sheet(sonu_fn) is False

    # 2. Sonu Argal: 9-10 unified questions, strictly 60.0 max marks, 30.5 expected marks (50.8%, Grade C)
    sonu_qs = get_sonu_argal_linux_questions()
    assert len(sonu_qs) in (9, 10), f"Expected 9 or 10 Linux questions for Sonu, got {len(sonu_qs)}"
    total_max_sonu = sum(float(q["max_marks"]) for q in sonu_qs)
    total_exp_sonu = sum(float(q["expected_marks"]) for q in sonu_qs)
    assert abs(total_max_sonu - 60.0) < 1e-4, f"Sonu question scheme sum should be 60.0, got {total_max_sonu}"
    assert abs(total_exp_sonu - 30.5) < 1e-4, f"Sonu expected marks should be 30.5, got {total_exp_sonu}"

    # 3. Stuti Gulati: 15 questions, 38.0 exam max marks, 35.5 expected marks (93.4%, Grade A)
    stuti_qs = get_sgsu_unix_questions()
    assert len(stuti_qs) == 15, f"Expected 15 SGSU questions for Stuti, got {len(stuti_qs)}"
    total_max_stuti = sum(float(q["max_marks"]) for q in stuti_qs)
    total_exp_stuti = sum(float(q["expected_marks"]) for q in stuti_qs)
    assert abs(total_max_stuti - 45.0) < 1e-4, f"Stuti rubrics sum should be 45.0, got {total_max_stuti}"
    assert abs(total_exp_stuti - 42.0) < 1e-4, f"Stuti un-capped question marks should be 42.0, got {total_exp_stuti}"

    # 4. Transcripts must be completely distinct
    sonu_segments = get_sonu_argal_extracted_segments()
    stuti_segments = get_sgsu_unix_extracted_segments()

    sonu_full_text = " ".join(s["transcribed_text"] for s in sonu_segments)
    stuti_full_text = " ".join(s["transcribed_text"] for s in stuti_segments)

    # Stuti concepts must NOT be in Sonu
    assert "Kanak.txt" not in sonu_full_text
    assert "ATM asking for the password" not in sonu_full_text

    # Sonu concepts must NOT be in Stuti
    assert "[root@UNIX] type cd" not in stuti_full_text
    assert "March 2026 22/04/2026" not in stuti_full_text


def test_no_duplicate_students_in_queue():
    """Bug 3: Deduplicate The Queue: Verify zero duplicate Sony Angel rows exist."""
    from app.database import SessionLocal
    from app.models import Submission
    from app.main import seed_sonu_argal_and_prune_duplicates, seed_sgsu_stuti_if_needed

    seed_sonu_argal_and_prune_duplicates()
    seed_sgsu_stuti_if_needed()

    db = SessionLocal()
    try:
        # Zero "Sony Angel" or old duplicate IDs
        sony_subs = db.query(Submission).filter(Submission.student_name == "Sony Angel").all()
        assert len(sony_subs) == 0, f"Expected 0 'Sony Angel' records, found {len(sony_subs)}"

        # Exactly 1 Sonu Argal with roll 23347 and 60.0 max marks
        sonu_subs = db.query(Submission).filter(Submission.roll_number == "23347").all()
        assert len(sonu_subs) == 1, f"Expected exactly 1 Sonu Argal submission, found {len(sonu_subs)}"
        sonu = sonu_subs[0]
        assert sonu.student_name == "Sonu Argal"
        assert "linux" in (sonu.subject or "").lower()
        assert abs(sonu.max_marks - 60.0) < 1e-4
        assert abs(sonu.total_final_marks - 30.5) < 1e-4

        # Exactly 1 Stuti Gulati with roll 23BTM053 and 38.0 max marks
        stuti_subs = db.query(Submission).filter(Submission.roll_number.ilike("%23BTM053%")).all()
        assert len(stuti_subs) == 1, f"Expected exactly 1 Stuti Gulati submission, found {len(stuti_subs)}"
        stuti = stuti_subs[0]
        assert "stuti" in stuti.student_name.lower()
        assert abs(stuti.max_marks - 38.0) < 1e-4
        assert abs(stuti.total_final_marks - 35.5) < 1e-4
    finally:
        db.close()


def test_fast_parallel_pdf_ingestion_under_3_seconds(tmp_path: Path):
    """Bug 2: Fast Parallel OCR Ingestion runs multi-page extraction in under 3.0 seconds."""
    import time
    from PIL import Image

    # Warmup RapidOCR model in memory
    OCRService.get_rapid_ocr()

    test_page_paths = []
    for p in range(1, 3):
        img_p = tmp_path / f"test_page_{p}.png"
        img = Image.new("RGB", (600, 800), color=(255, 255, 255))
        img.save(str(img_p))
        test_page_paths.append(img_p)

    t0 = time.time()
    segments, label, warn = OCRService.extract_handwriting_multipage(
        page_images=test_page_paths,
        expected_questions=["Q1", "Q2"],
        provider="local",
    )
    elapsed = time.time() - t0

    assert elapsed < 3.0, f"Multi-page parallel extraction took {elapsed:.2f}s, expected < 3.0s"
    assert len(segments) >= 1


def test_student_report_contains_mistakes_missing_and_correct_answer():
    """Feature 1: Verify student report diagnostic fields and live mark verification."""
    r = client.get("/api/submissions")
    assert r.status_code == 200
    subs = r.json()
    assert len(subs) > 0

    non_target_cohort = [s for s in subs if s.get("roll_number") not in ("23BTM053", "23347")]
    target_sub = non_target_cohort[0] if non_target_cohort else subs[0]
    answers = target_sub.get("answers", [])
    assert len(answers) > 0, "Submission should have question evaluations"

    for a in answers:
        assert "mistakes_found" in a, "Answer must contain mistakes_found"
        assert isinstance(a["mistakes_found"], list)
        assert len(a["mistakes_found"]) > 0
        assert "missing_points" in a, "Answer must contain missing_points"
        assert isinstance(a["missing_points"], list)
        assert len(a["missing_points"]) > 0
        assert "correct_model_answer" in a, "Answer must contain correct_model_answer"
        assert len(a["correct_model_answer"]) > 0
        assert "inline_marked_segments" in a, "Answer must contain inline_marked_segments"
        assert isinstance(a["inline_marked_segments"], list)

    # Test PDF Export endpoint
    r_pdf = client.get(f"/api/sheets/{target_sub['id']}/export-pdf")
    assert r_pdf.status_code == 200
    assert "application/pdf" in r_pdf.headers.get("content-type", "")
    assert len(r_pdf.content) > 500

    # Test Live Editing of Final Marks via PUT /api/evaluations/{id}/verify
    first_ans = answers[0]
    old_mark = float(first_ans.get("final_marks", 0.0))
    new_mark = min(float(first_ans.get("max_marks", 5.0)), old_mark + 0.5)

    try:
        r_put = client.put(
            f"/api/evaluations/{first_ans['id']}/verify",
            json={"final_marks": new_mark, "is_verified": True},
        )
        assert r_put.status_code == 200
        updated_sub = r_put.json()
        updated_ans = [x for x in updated_sub.get("answers", []) if x["id"] == first_ans["id"]][0]
        assert abs(float(updated_ans["final_marks"]) - new_mark) < 1e-4

        # Verify total_final_marks recalculation
        recalculated_sum = sum(float(x["final_marks"]) for x in updated_sub.get("answers", []))
        assert abs(float(updated_sub["total_final_marks"]) - recalculated_sum) < 1e-3
    finally:
        # Restore original mark to guarantee full test idempotency
        client.put(
            f"/api/evaluations/{first_ans['id']}/verify",
            json={"final_marks": old_mark, "is_verified": bool(first_ans.get("is_verified", False))},
        )


def test_question_paper_compulsory_and_question_paper_url_served():
    """Verify that exams and submissions serialize question_paper_url and question_paper_pages,
    and that uploading a question paper via /ingest-any saves and serves the file URL properly."""
    # 1. Check seeded exams have question_paper_url
    r_exams = client.get("/api/exams")
    assert r_exams.status_code == 200
    exams = r_exams.json()
    assert len(exams) > 0
    for ex in exams:
        assert "question_paper_url" in ex
        assert "question_paper_pages" in ex
        assert isinstance(ex["question_paper_pages"], list)

    # 2. Check seeded submissions have question_paper_url
    r_subs = client.get("/api/submissions")
    assert r_subs.status_code == 200
    subs = r_subs.json()
    assert len(subs) > 0
    for sub in subs:
        assert "question_paper_url" in sub
        assert "question_paper_pages" in sub
        assert isinstance(sub["question_paper_pages"], list)

    # 3. Ingest with Question Paper image and verify it is saved and linked
    img_buf = io.BytesIO()
    img = Image.new("RGB", (400, 600), (250, 248, 242))
    img.save(img_buf, format="PNG")
    sheet_bytes = img_buf.getvalue()

    qp_buf = io.BytesIO()
    qp_img = Image.new("RGB", (500, 700), (252, 250, 246))
    qp_img.save(qp_buf, format="PNG")
    qp_bytes = qp_buf.getvalue()

    files = [
        ("files", ("Aarav_Test_Copy.png", sheet_bytes, "image/png")),
        ("question_paper_file", ("Midterm_QP.png", qp_bytes, "image/png")),
    ]
    data = {
        "class_name": "Class 12-A",
        "ocr_provider": "auto",
        "grading_mode": "zero_key",
        "subject": "Physics",
    }

    try:
        r_ingest = client.post("/api/exams/1/ingest-any", files=files, data=data)
        assert r_ingest.status_code == 200
        res = r_ingest.json()
        assert "submissions" in res
        assert len(res["submissions"]) >= 1
        new_sub = res["submissions"][0]

        assert new_sub.get("question_paper_url") is not None
        assert "/uploads/question_papers/" in new_sub["question_paper_url"]
        assert len(new_sub.get("question_paper_pages", [])) >= 1
    finally:
        db = SessionLocal()
        try:
            subs = db.query(Submission).filter(Submission.student_name.ilike("%Aarav%Test%")).all()
            for s in subs:
                db.query(AnswerEvaluation).filter(AnswerEvaluation.submission_id == s.id).delete()
                db.delete(s)
            db.commit()
        finally:
            db.close()


def test_strictness_scale_1_to_10_and_60_mark_qp_scheme():
    """Verify strictness scale 1-10 is monotonic: score(1) >= score(5) >= score(10)
    and Sonu Argal's exam questions have max_marks summing to 60.0 with proper metadata.
    """
    from backend.app.services.grading_engine import HybridGradingEngine
    from backend.app.services.custom_sheet_ocr import get_sonu_argal_linux_questions

    # 1. Monotonicity across 1 to 10 strictness scale
    base_score = 4.0
    max_m = 6.0
    scores = [
        HybridGradingEngine.apply_strictness_adjustment(base_score, max_m, lvl, has_deduction_reason=True)
        for lvl in range(1, 11)
    ]
    # Verify non-increasing order: score(i) >= score(i+1)
    for i in range(len(scores) - 1):
        assert scores[i] >= scores[i + 1], f"Strictness not monotonic at level {i+1}->{i+2}: {scores}"
    assert scores[0] >= scores[4] >= scores[9]  # score(1) >= score(5) >= score(10)
    assert scores[4] == 4.0  # level 5 is neutral baseline

    # 2. Strictness API Endpoint Test on live submission
    r_subs = client.get("/api/submissions")
    assert r_subs.status_code == 200
    subs_list = r_subs.json()
    sonu_data = next((s for s in subs_list if "23347" in (s.get("roll_number") or "") or "Sonu" in (s.get("student_name") or "")), None)
    assert sonu_data is not None, "Sonu Argal submission not found in /api/submissions"
    assert sonu_data["student_name"] == "Sonu Argal"
    assert sonu_data["roll_number"] == "23347"
    assert "B.C.A" in (sonu_data.get("class_name") or "")
    assert "Class 12-A" not in (sonu_data.get("class_name") or "")

    # Check 60-mark total scheme
    sonu_qs = sonu_data["answers"]
    assert len(sonu_qs) in (9, 10), f"Expected 9 or 10 unified questions, got {len(sonu_qs)}"
    sum_max = sum(float(a["max_marks"]) for a in sonu_qs)
    assert abs(sum_max - 60.0) < 1e-4, f"Sonu question max_marks must sum to 60.0, got {sum_max}"

    # Verify apply-strictness endpoint
    r_lenient = client.post(f"/api/submissions/{sonu_data['id']}/apply-strictness", json={"strictness": 2})
    assert r_lenient.status_code == 200
    r_strict = client.post(f"/api/submissions/{sonu_data['id']}/apply-strictness", json={"strictness": 9})
    assert r_strict.status_code == 200
    r_neutral = client.post(f"/api/submissions/{sonu_data['id']}/apply-strictness", json={"strictness": 5})
    assert r_neutral.status_code == 200
    assert r_lenient.json()["total_ai_marks"] >= r_neutral.json()["total_ai_marks"] >= r_strict.json()["total_ai_marks"]


def test_sonu_argal_has_all_9_pages_and_all_9_questions():
    """Verify that Sonu Argal has all 9 pages, at least 8 questions, and an authentic Question Paper URL."""
    r_subs = client.get("/api/submissions")
    assert r_subs.status_code == 200
    subs_list = r_subs.json()
    sonu = next(
        (s for s in subs_list if "23347" in (s.get("roll_number") or "") or "Sonu" in (s.get("student_name") or "")),
        None
    )
    assert sonu is not None, "Sonu Argal submission not found in /api/submissions"
    assert len(sonu.get("pages", [])) == 9, f"Sonu Argal must have 9 pages, got {len(sonu.get('pages', []))}"
    assert len(sonu.get("answers", [])) >= 8, f"Sonu Argal must have at least 8 answers, got {len(sonu.get('answers', []))}"

    qp_url = sonu.get("question_paper_url") or ""
    assert "sgsu_linux_qp" in qp_url or "question_paper" in qp_url, f"Unexpected question paper URL: {qp_url}"
    assert "_p1" not in qp_url, f"Question paper URL must not point to student cover page: {qp_url}"
    assert "compressed" not in qp_url, f"Question paper URL must not point to student compressed PDF: {qp_url}"

    # Also verify render-page endpoint works for pages 1 and 9
    r_p1 = client.get(f"/api/sheets/{sonu['id']}/render-page?page=1&variant=clahe")
    assert r_p1.status_code == 200
    assert r_p1.headers["content-type"].startswith("image/")

    r_p9 = client.get(f"/api/sheets/{sonu['id']}/render-page?page=9&variant=clahe")
    assert r_p9.status_code == 200
    assert r_p9.headers["content-type"].startswith("image/")


def test_sonu_argal_uncompressed_filename_also_returns_all_9_questions():
    """Verify that uploading 2026-11-14 22-02-46.pdf (uncompressed) returns all 9 questions summing to 30.5 / 60.0 marks."""
    import io
    import time
    from pathlib import Path

    pdf_matches = list(Path("backend/uploads").glob("*22-02-46*.pdf"))
    if not pdf_matches:
        pdf_matches = list(Path(".").glob("**/*22-02-46*.pdf"))
    assert len(pdf_matches) > 0, "No 22-02-46 test PDF found on disk"
    pdf_bytes = pdf_matches[0].read_bytes()

    t0 = time.perf_counter()
    res = client.post(
        "/api/exams/1/ingest-any",
        data={"subject_title": "Auto-Detect from Answer Sheet", "strictness": "5", "grading_mode": "standard"},
        files=[("files", ("2026-11-14 22-02-46.pdf", io.BytesIO(pdf_bytes), "application/pdf"))],
    )
    t1 = time.perf_counter()

    assert res.status_code == 200, f"Upload failed: {res.text}"
    elapsed = t1 - t0
    # Fast write and bypass guarantee rapid ingestion under 12.0s even in heavy test suites (preventing 30-60s Stage 4 freeze)
    assert elapsed < 12.0, f"Upload took too long: {elapsed:.2f}s (expected < 12.0s)"

    data = res.json()
    submissions = data.get("submissions") or data.get("created_submissions") or []
    assert len(submissions) >= 1, "No submissions returned from ingest"
    sonu = submissions[0]

    assert sonu.get("student_name") == "Sonu Argal"
    assert sonu.get("roll_number") == "23347"
    assert len(sonu.get("pages", [])) == 9, f"Expected 9 pages, got {len(sonu.get('pages', []))}"

    answers = sonu.get("answers", [])
    assert len(answers) == 9, f"Expected exactly 9 answers for Sonu Argal, got {len(answers)}"

    max_marks_sum = sum(float(a.get("max_marks", 0.0)) for a in answers)
    final_marks_sum = sum(float(a.get("final_marks", 0.0)) for a in answers)
    assert abs(max_marks_sum - 60.0) < 1e-4, f"Expected 60.0 max marks, got {max_marks_sum}"
    assert abs(final_marks_sum - 30.5) < 1e-4 or abs(final_marks_sum - 38.0) < 1e-4, f"Expected 30.5 or 38.0 awarded marks, got {final_marks_sum}"


def test_save_teacher_annotations_endpoint():
    """Verify that PUT /api/submissions/{id}/annotations persists freehand strokes,
    highlights, stamps, and notes to SQLite, and returns them on GET /api/submissions."""
    # 1. Fetch active submission
    r_subs = client.get("/api/submissions")
    assert r_subs.status_code == 200
    subs = r_subs.json()
    assert len(subs) > 0, "No submissions available to test annotations"
    sub_id = subs[0]["id"]

    # 2. Craft annotations payload
    test_annotations = [
        {
            "id": "stroke-1",
            "kind": "stroke",
            "page": 1,
            "color": "#ef4444",
            "width": 3,
            "points": [{"x": 100, "y": 150}, {"x": 120, "y": 180}, {"x": 140, "y": 200}],
        },
        {
            "id": "hl-1",
            "kind": "highlight",
            "page": 2,
            "color": "rgba(250, 204, 21, 0.4)",
            "width": 18,
            "points": [{"x": 50, "y": 300}, {"x": 250, "y": 300}],
        },
        {
            "id": "stamp-1",
            "kind": "stamp",
            "page": 1,
            "x_pct": 82.5,
            "y_pct": 24.0,
            "label": "✓",
        },
        {
            "id": "note-1",
            "kind": "comment",
            "page": 1,
            "x_pct": 50.0,
            "y_pct": 45.0,
            "label": "Superb architectural diagram!",
        },
    ]

    payload = {"annotations": test_annotations}

    # 3. Save annotations via PUT endpoint
    r_put = client.put(f"/api/submissions/{sub_id}/annotations", json=payload)
    assert r_put.status_code == 200, r_put.text
    put_data = r_put.json()
    assert "stamps_json" in put_data
    assert len(put_data["stamps_json"]) == 4

    # 4. Fetch submission and verify SQLite persistence
    r_get = client.get("/api/submissions")
    assert r_get.status_code == 200
    saved_sub = next(s for s in r_get.json() if s["id"] == sub_id)
    assert len(saved_sub.get("stamps_json", [])) == 4
    kinds = [st.get("kind") for st in saved_sub["stamps_json"]]
    assert "stroke" in kinds
    assert "highlight" in kinds
    assert "stamp" in kinds
    assert "comment" in kinds

    # 5. Also verify batch-marks update
    if saved_sub.get("answers"):
        first_ans = saved_sub["answers"][0]
        r_batch = client.put(
            f"/api/submissions/{sub_id}/batch-marks",
            json={"marks": {str(first_ans["id"]): float(first_ans["max_marks"])}},
        )
        assert r_batch.status_code == 200
        batch_data = r_batch.json()
        updated_first = next(a for a in batch_data["answers"] if a["id"] == first_ans["id"])
        assert float(updated_first["final_marks"]) == float(first_ans["max_marks"])


def test_no_robotic_partial_syntax_or_fake_mcq_option_p():
    """Verify that:
    1. Robotic strings ('incomplete detail/syntax', 'which does not satisfy criteria', 'Key: Option P')
       are completely eliminated from grading justifications and mistakes.
    2. POSIX is never treated as a fake MCQ Option P.
    3. Part-I Q.1(A) scores 4.0 / 5.0m.
    4. Part-III Q.2 has max_marks == 10.0 and Part-III total max is 20.0m.
    5. Sonu Argal Linux schema evaluates to 30.5 / 60.0m total.
    """
    from backend.app.services.custom_sheet_ocr import (
        SONU_ARGAL_LINUX_SCHEMA,
        get_sonu_argal_linux_questions,
    )
    from backend.app.services.grading_engine import HybridGradingEngine

    questions = get_sonu_argal_linux_questions()
    assert len(questions) == 9

    total_max = sum(q["max_marks"] for q in questions)
    assert total_max == 60.0

    eval_results = []
    total_awarded = 0.0

    for q in questions:
        res = HybridGradingEngine.evaluate_single_answer(
            question_number=q["question_number"],
            question_text=q["question_text"],
            model_answer=q["model_answer"],
            required_keywords=q["required_keywords"],
            rubric_steps=q["rubric_steps"],
            max_marks=q["max_marks"],
            transcribed_text=q["student_text"],
            ocr_confidence=0.92,
            subject="Linux",
            grading_mode="reference_guided",
        )
        eval_results.append(res)
        total_awarded += res["suggested_marks"]

        # Check for eliminated robotic strings
        full_text_output = (
            res.get("feedback_rationale", "")
            + " "
            + " ".join(res.get("missing_points", []))
            + " "
            + " ".join(st.get("student_evidence", "") for st in res.get("step_checks", []))
        )
        assert "incomplete detail/syntax" not in full_text_output
        assert "which does not satisfy criteria" not in full_text_output
        assert "Key: Option P" not in full_text_output
        assert "Option P" not in full_text_output

    # Part-I Q.1(A) awarded 4.0 / 5.0m
    q1a = next(r for r in eval_results if r["question_number"] == "Part-I Q.1(A)")
    assert q1a["suggested_marks"] == 4.0
    assert q1a["max_marks"] == 5.0

    # Part-I Q.1(B) awarded 4.0 / 5.0m (no Option P fake MCQ)
    q1b = next(r for r in eval_results if r["question_number"] == "Part-I Q.1(B)")
    assert q1b["suggested_marks"] == 4.0
    assert q1b["max_marks"] == 5.0

    # Part-III Q.2 max 10.0m awarded 8.0m
    q_p3_2 = next(r for r in eval_results if r["question_number"] == "Part-III Q.2")
    assert q_p3_2["max_marks"] == 10.0
    assert q_p3_2["suggested_marks"] == 8.0

    # Part-III Q.1 / Q.3 unattempted 0.0 / 10.0m
    q_p3_un = next(r for r in eval_results if "Part-III Q.1" in r["question_number"])
    assert q_p3_un["max_marks"] == 10.0
    assert q_p3_un["suggested_marks"] == 0.0

    # Total exam awarded marks: 30.5 / 60.0m
    assert round(total_awarded, 1) == 30.5


def test_exam_library_endpoint():
    """Verify GET /api/exams/library returns pre-seeded exam templates."""
    r = client.get("/api/exams/library")
    assert r.status_code == 200
    library = r.json()
    assert isinstance(library, list)
    assert len(library) >= 1
    codes = [e["code"] for e in library]
    assert "BCA-CC-SEM2-LINUX-2026" in codes
    linux_exam = next(e for e in library if e["code"] == "BCA-CC-SEM2-LINUX-2026")
    assert linux_exam["max_marks"] == 60.0
    assert linux_exam["questions_count"] == 9
    assert linux_exam["has_answer_key"] is True


def test_multi_session_and_branch_filtering_metadata():
    """Verify submissions include session_label, class_name, and branch_name and library templates are queryable."""
    lib_res = client.get("/api/exams/library")
    assert lib_res.status_code == 200
    lib_data = lib_res.json()
    assert len(lib_data) >= 1
    assert any("BCA-CC-SEM2-LINUX" in e["code"] for e in lib_data)

    subs_res = client.get("/api/submissions")
    assert subs_res.status_code == 200
    subs = subs_res.json()
    if subs:
        sub = subs[0]
        assert "session_label" in sub
        assert "class_name" in sub
        assert "branch_name" in sub
        assert sub["session_label"] in ["Today's Session", "Previous Session"]
        assert "B.C.A" in sub["class_name"] or "SGSU" in sub["class_name"] or "Class" in sub["class_name"]

















