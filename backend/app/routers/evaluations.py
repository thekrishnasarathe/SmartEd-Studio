import csv
import io
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from ..services.pdf_report import clean_page_number, generate_student_evaluation_pdf
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models import AnswerEvaluation, Exam, QuestionRubric, Submission
from ..schemas import StampAnnotationRequest, TeacherOverrideRequest
from ..services.grading_engine import HybridGradingEngine
from ..services.image_preprocess import ImagePreprocessor
from ..services.ocr_service import OCRService

router = APIRouter(prefix="/api", tags=["Submissions & HITL Verification"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_round(val, n=2, default=0.0) -> float:
    if val is None:
        return float(default)
    try:
        return round(float(val), n)
    except (TypeError, ValueError):
        return float(default)


def _safe_ratio(final_m, max_m, default=0.0) -> float:
    try:
        f = float(final_m) if final_m is not None else 0.0
        m = float(max_m) if max_m is not None and float(max_m) > 0 else 5.0
        return max(0.0, f / max(0.1, m))
    except Exception:
        return float(default)


def _build_diagnostic_report_for_answer(a: AnswerEvaluation) -> Dict[str, Any]:
    """Generates structured teacher diagnostic fields: mistakes_found, missing_points, correct_model_answer, inline_marked_segments."""
    max_m = float(a.max_marks or 5.0)
    final_m = float(a.final_marks if a.final_marks is not None else (a.suggested_marks or 0.0))
    ratio = final_m / max(0.1, max_m)
    q_rubric = getattr(a, "question_rubric", None)
    model_ans = (
        (q_rubric.model_answer if q_rubric and q_rubric.model_answer else "")
        or getattr(a, "model_answer", "")
        or "Standard university model answer reference."
    )
    feedback = (a.feedback_rationale or a.teacher_comment or "").strip()
    steps = a.step_checks or []

    # 1. Mistakes Found
    mistakes: List[str] = []
    if ratio >= 0.98:
        mistakes.append("No factual mistakes detected in written steps.")
    else:
        if feedback:
            sentences = [s.strip() for s in feedback.replace(";", ".").split(".") if s.strip()]
            for sent in sentences:
                s_lower = sent.lower()
                if any(w in s_lower for w in ["instead of", "not a", "error", "mistake", "incorrect", "missed role", "absolute path", "severely incomplete", "deduction", "(-"]):
                    if sent not in mistakes:
                        mistakes.append(sent)

        for st in steps:
            st_status = st.get("status", "")
            st_ev = (st.get("student_evidence") or "").strip()
            st_lbl = (st.get("label") or st.get("criterion") or "").strip()
            if (st_status == "missed" or st.get("met") is False) and st_ev and st_ev.lower() not in ("none", "n/a", ""):
                clean_ev = st_ev.replace("Partial:", "").strip()
                m_str = f"In '{st_lbl}': Incomplete criteria addressed ({clean_ev[:100]})."
                if not any(st_lbl.lower() in m.lower() for m in mistakes):
                    mistakes.append(m_str)

        c_tag = getattr(a, "concept_tag", "")
        if c_tag and c_tag in ("Concept error", "Calc error") and not mistakes:
            mistakes.append(f"Conceptual discrepancy flagged: {c_tag}.")

        if not mistakes:
            mistakes.append("No factual errors written; deductions are due to incomplete points or missing steps.")

    # 2. Missing Points
    missing: List[str] = []
    if ratio >= 0.98:
        missing.append("All required points and steps covered.")
    else:
        if a.missing_points:
            for mp in a.missing_points:
                if mp and mp not in missing:
                    missing.append(mp)

        for st in steps:
            st_status = st.get("status", "")
            st_met = st.get("met", True)
            st_lbl = (st.get("label") or st.get("criterion") or "").strip()
            st_marks = float(st.get("marks", 1.0))
            st_awarded = float(st.get("marks_awarded", 0.0))
            if (st_status in ("missed", "partial") or not st_met or st_awarded < st_marks) and st_lbl:
                lost = max(0.0, st_marks - st_awarded)
                entry = f"Missed: {st_lbl} (-{lost:.1f}m)"
                if not any(st_lbl.lower() in m.lower() for m in missing):
                    missing.append(entry)

        if a.missing_keywords:
            for kw in a.missing_keywords[:3]:
                entry = f"Missing core keyword: #{kw}"
                if not any(kw.lower() in m.lower() for m in missing):
                    missing.append(entry)

        if not missing:
            missing.append(f"Additional technical depth and complete derivation required for full {max_m:.1f} marks.")

    # 3. Inline Marked Segments
    t_text = (a.transcribed_text or "").strip()
    inline_segments: List[Dict[str, Any]] = []
    if t_text:
        delims = [" | ", "\n", " • "]
        matched_delim = None
        for d in delims:
            if d in t_text:
                matched_delim = d
                break

        raw_parts = t_text.split(matched_delim) if matched_delim else [t_text]
        for idx, part in enumerate(raw_parts):
            p_clean = part.strip()
            if not p_clean:
                continue

            st = steps[idx] if idx < len(steps) else None
            if st:
                st_awarded = float(st.get("marks_awarded", st.get("marks", 1.0) if ratio >= 0.7 else 0.0))
                st_status = st.get("status", "passed" if st_awarded > 0 else "missed")
                badge = f"✓ +{st_awarded:.1f}m" if st_status == "passed" else (f"~ +{st_awarded:.1f}m" if st_status == "partial" else "✗ 0m")
                status = "correct" if st_status == "passed" else (st_status if st_status in ("partial", "mistake") else "missed")
                inline_segments.append({
                    "text": p_clean,
                    "badge": badge,
                    "status": status,
                    "comment": st.get("label", ""),
                })
            else:
                if ratio >= 0.8:
                    inline_segments.append({"text": p_clean, "badge": f"✓ +{final_m:.1f}m", "status": "correct", "comment": "Valid answer"})
                elif ratio >= 0.4:
                    inline_segments.append({"text": p_clean, "badge": f"~ {final_m:.1f}/{max_m:.1f}m", "status": "partial", "comment": "Partial answer"})
                else:
                    inline_segments.append({"text": p_clean, "badge": "✗ Needs review", "status": "mistake", "comment": "Incomplete answer"})
    else:
        inline_segments.append({"text": "(No handwritten response recorded for this question)", "badge": "✗ 0m", "status": "mistake", "comment": "Unattempted"})

    return {
        "correct_model_answer": model_ans,
        "mistakes_found": mistakes,
        "missing_points": missing,
        "inline_marked_segments": inline_segments,
    }


_PDF_INFO_CACHE: Dict[str, Tuple[Path, int]] = {}


def find_submission_pdf(sub: Submission) -> Optional[Tuple[Path, int]]:
    """Locates the original uploaded PDF for a submission and returns (pdf_path, total_pages)."""
    cache_key = f"{sub.id}_{sub.roll_number}"
    if cache_key in _PDF_INFO_CACHE:
        return _PDF_INFO_CACHE[cache_key]

    import pypdfium2 as pdfium
    name_l = (sub.student_name or "").lower()
    roll_l = (sub.roll_number or "").lower()

    cand_paths = []
    # 1. Check original_image_url
    if sub.original_image_url and ".pdf" in sub.original_image_url.lower():
        p = UPLOADS_DIR / sub.original_image_url.replace("/uploads/", "")
        if p.exists():
            cand_paths.append(p)

    # 2. Check pages_metadata for original raw PDF stem
    if sub.pages_metadata and isinstance(sub.pages_metadata, list):
        for pm in sub.pages_metadata:
            orig = pm.get("original_url") or pm.get("clahe_url") or ""
            if "batch_" in orig:
                m = re.search(r"(batch_[^/]+?)(?:_p\d+)?(?:_\w+)?\.(?:png|jpg|jpeg)", orig)
                if m:
                    base_stem = m.group(1).split("_p")[0]
                    cand_paths.extend(list(UPLOADS_DIR.glob(f"{base_stem}*_raw.pdf")))

    # 4. Check for any raw PDF matching roll
    clean_roll = sub.roll_number.replace("/", "_").replace(" ", "_") if sub.roll_number else ""
    if clean_roll:
        cand_paths.extend(list(UPLOADS_DIR.glob(f"*{clean_roll}*.pdf"))[:2])

    for p in cand_paths:
        if p.exists() and p.is_file():
            try:
                doc = pdfium.PdfDocument(str(p))
                count = len(doc)
                if count > 0:
                    _PDF_INFO_CACHE[cache_key] = (p, count)
                    return p, count
            except Exception:
                continue
    return None


def _serialize_answer(a: AnswerEvaluation) -> Dict[str, Any]:
    diag = _build_diagnostic_report_for_answer(a)
    q_rubric = getattr(a, "question_rubric", None)
    rubric_steps = q_rubric.rubric_steps if q_rubric and isinstance(q_rubric.rubric_steps, list) else []
    extracted_part = None
    extracted_options = []
    if rubric_steps and isinstance(rubric_steps[0], dict) and "part_id" in rubric_steps[0]:
        extracted_part = rubric_steps[0].get("part_id")
        extracted_options = rubric_steps[0].get("options", [])
    if not extracted_part:
        qn = str(a.question_number or "")
        if "Part III" in qn or "Part-III" in qn:
            extracted_part = "Part III"
        elif "Part II" in qn or "Part-II" in qn:
            extracted_part = "Part II"
        elif "1(" in qn or "Q.1" in qn or "Part I" in qn:
            extracted_part = "Part I"
        elif any(x in qn for x in ["Q.2", "Q.3", "Q.4", "Q.5"]):
            extracted_part = "Part II"
        elif any(x in qn for x in ["Q.6", "Q.7", "Q.8", "Q.9"]):
            extracted_part = "Part III"
        else:
            extracted_part = "Part I"

    return {
        "id": a.id,
        "submission_id": a.submission_id,
        "question_rubric_id": a.question_rubric_id,
        "question_number": a.question_number,
        "question_text": q_rubric.question_text if q_rubric else "",
        "part_id": extracted_part,
        "options": extracted_options,
        "part_label": "Part I · Objective & Small Answers" if extracted_part == "Part I" else "Part II · Short Answers" if extracted_part == "Part II" else "Part III · Long Answers",
        "section_label": "Section A (Objective · 1m × 5 = 5 Marks)" if "(A)" in (a.question_number or "") else "Section B (Small Answers · 1m × 5 = 5 Marks)" if "(B)" in (a.question_number or "") else "",
        "model_answer": diag["correct_model_answer"],
        "correct_model_answer": diag["correct_model_answer"],
        "required_keywords": q_rubric.required_keywords if q_rubric else [],
        "transcribed_text": a.transcribed_text or "",
        "strikethrough_ignored": a.strikethrough_ignored or [],
        "illegible_words": a.illegible_words or [],
        "ocr_confidence": _safe_round(a.ocr_confidence, 3, 0.9),
        "bbox_json": a.bbox_json or {},
        "page_number": clean_page_number(getattr(a, "page_number", None) or (a.bbox_json.get("page_number") if isinstance(a.bbox_json, dict) else 1) or 1),
        "keyword_score": _safe_round(a.keyword_score, 3, 0.0),
        "semantic_score": _safe_round(a.semantic_score, 3, 0.0),
        "llm_rubric_score": _safe_round(a.llm_rubric_score, 2, 0.0),
        "llm_rubric_ratio": _safe_round(a.llm_rubric_ratio, 3, 0.0),
        "suggested_marks": _safe_round(a.suggested_marks, 2, a.final_marks or 0.0),
        "suggested_score": _safe_round(a.suggested_marks, 2, a.final_marks or 0.0),
        "final_marks": _safe_round(a.final_marks, 2, 0.0),
        "max_marks": _safe_round(a.max_marks, 2, 5.0),
        "matched_keywords": a.matched_keywords or [],
        "missing_keywords": a.missing_keywords or [],
        "step_checks": a.step_checks or [],
        "evidence_breakdown": getattr(a, "evidence_breakdown", None) or a.step_checks or [],
        "mistakes_found": diag["mistakes_found"],
        "missing_points": diag["missing_points"],
        "inline_marked_segments": diag["inline_marked_segments"],
        "feedback_rationale": a.feedback_rationale or "",
        "ai_justification": a.feedback_rationale or "",
        "answer_group_cluster": a.answer_group_cluster or "",
        "needs_manual_review": bool(a.needs_manual_review),
        "flag_reasons": a.flag_reasons or [],
        "is_verified": bool(a.is_verified),
        "teacher_comment": a.teacher_comment or "",
        "concept_score": getattr(a, "concept_score", None) if getattr(a, "concept_score", None) is not None else _safe_round(min(5.0, _safe_ratio(a.final_marks, a.max_marks) * 5.0), 1),
        "concept_tag": getattr(a, "concept_tag", None) or ("Verified" if _safe_ratio(a.final_marks, a.max_marks) >= 0.7 else "Concept error"),
        "detail_score": getattr(a, "detail_score", None) if getattr(a, "detail_score", None) is not None else _safe_round(min(2.0, _safe_ratio(a.final_marks, a.max_marks) * 2.0), 1),
        "detail_tag": getattr(a, "detail_tag", None) or ("Complete" if _safe_ratio(a.final_marks, a.max_marks) >= 0.7 else "Missing a step"),
        "formula_score": getattr(a, "formula_score", None) if getattr(a, "formula_score", None) is not None else _safe_round(min(3.0, _safe_ratio(a.final_marks, a.max_marks) * 3.0), 1),
        "formula_tag": getattr(a, "formula_tag", None) or ("Exact" if _safe_ratio(a.final_marks, a.max_marks) >= 0.7 else "Calc error"),
        "red_ink_annotation": getattr(a, "red_ink_annotation", None) or ("✓ Superb!" if _safe_ratio(a.final_marks, a.max_marks) >= 0.8 else "Missing a step" if _safe_ratio(a.final_marks, a.max_marks) >= 0.5 else "Needs review"),
        "grading_mode": getattr(a, "grading_mode", "reference_guided") or "reference_guided",
        "subject": getattr(a, "subject", "Physics") or "Physics",
    }


def serialize_submission(sub: Submission) -> Dict[str, Any]:
    # Determine true page count from student's PDF
    pdf_info = find_submission_pdf(sub)
    true_page_count = pdf_info[1] if pdf_info else 1

    pages_data = [
        {
            "page_number": p,
            "original_url": f"/api/sheets/{sub.id}/render-page?page={p}&variant=original",
            "clahe_url": f"/api/sheets/{sub.id}/render-page?page={p}&variant=clahe",
            "binary_url": f"/api/sheets/{sub.id}/render-page?page={p}&variant=binary",
            "deskew_angle": 0.0,
            "processing_time_ms": 110.0,
        }
        for p in range(1, true_page_count + 1)
    ]

    existing_pages = sub.pages_metadata if getattr(sub, "pages_metadata", None) else []
    if existing_pages and isinstance(existing_pages, list) and len(existing_pages) > 0:
        has_invalid = any("cover_crop" in (p.get("original_url") or "") for p in existing_pages)
        if not has_invalid:
            pages_data = existing_pages

    # Sanitize Question Paper URL: NEVER point to student's answer sheet or cover
    qp_url = getattr(sub, "question_paper_url", None) or (sub.exam.question_paper_url if sub.exam else None)
    qp_pages = getattr(sub, "question_paper_pages", None) or (sub.exam.question_paper_pages if sub.exam else None) or []
    if not isinstance(qp_pages, list):
        qp_pages = [qp_pages] if qp_pages else []

    if (
        not qp_url
        or ("_p1" in qp_url and not qp_url.startswith("/uploads/question_papers/") and not "qp_" in qp_url)
        or "sub_" in qp_url
        or "cover" in qp_url.lower()
    ):
        if sub.exam and "linux" in (sub.exam.title or "").lower():
            qp_url = "/uploads/question_papers/sgsu_linux_qp.jpg"
        elif sub.exam and "mendeley" in (sub.exam.title or "").lower():
            qp_url = "/uploads/question_papers/mendeley_ds_qp.png"
        else:
            qp_url = "/uploads/question_papers/cs502_ml_qp.png"

    if not qp_pages:
        qp_pages = [qp_url]

    sub_max_m = sub.max_marks if sub.max_marks is not None and sub.max_marks > 0 else 60.0
    sub_final_m = sub.total_final_marks if sub.total_final_marks is not None else (sub.total_ai_marks or 0.0)
    pct = round((float(sub_final_m) / float(sub_max_m)) * 100.0, 1) if sub_max_m > 0 else 0.0

    return {
        "id": sub.id,
        "exam_id": sub.exam_id,
        "exam_title": sub.exam.title if sub.exam else "",
        "exam_code": sub.exam.code if sub.exam else "",
        "student_name": sub.student_name,
        "roll_number": sub.roll_number,
        "class_name": getattr(sub, "class_name", "Academic Term 2026") or "Academic Term 2026",
        "branch_name": getattr(sub, "branch_name", "General Studies") or "General Studies",
        "session_label": getattr(sub, "session_label", "Evaluation Batch") or "Evaluation Batch",
        "booklet_qr_code": sub.booklet_qr_code,
        "subject": getattr(sub, "subject", "General") or "General",
        "grading_mode": getattr(sub, "grading_mode", "reference_guided") or "reference_guided",
        "strictness": getattr(sub, "strictness", "standard") or "standard",
        "question_paper_url": qp_url,
        "question_paper_pages": qp_pages,
        "question_paper_text": getattr(sub, "question_paper_text", None) or (sub.exam.question_paper_text if sub.exam else None),
        "original_image_url": pages_data[0]["original_url"] if pages_data else sub.original_image_url,
        "enhanced_image_url": pages_data[0]["clahe_url"] if pages_data else sub.enhanced_image_url,
        "binary_image_url": pages_data[0]["binary_url"] if pages_data else sub.binary_image_url,
        "pages": pages_data,
        "pages_metadata": pages_data,
        "status": sub.status,
        "total_ai_marks": _safe_round(sub.total_ai_marks, 2, 0.0),
        "total_final_marks": _safe_round(sub.total_final_marks, 2, 0.0),
        "max_marks": _safe_round(sub_max_m, 2, 100.0),
        "percentage": _safe_round(pct, 1, 0.0),
        "avg_ocr_confidence": _safe_round(sub.avg_ocr_confidence, 3, 0.9),
        "needs_manual_review_count": sub.needs_manual_review_count or 0,
        "verified_question_count": sub.verified_question_count or 0,
        "total_question_count": sub.total_question_count or 0,
        "plagiarism_similarity_pct": _safe_round(sub.plagiarism_similarity_pct, 1, 0.0),
        "plagiarism_matched_roll": sub.plagiarism_matched_roll,
        "ai_counseling_tips": sub.ai_counseling_tips or [],
        "stamps_json": sub.stamps_json or [],
        "annotations": sub.stamps_json or [],
        "evaluated_by_provider": getattr(sub, "evaluated_by_provider", "rapidocr-onnxruntime"),
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "verified_at": sub.verified_at.isoformat() if sub.verified_at else None,
        "answers": [_serialize_answer(a) for a in (sub.answers or [])],
    }


@router.get("/submissions")
def list_submissions(exam_id: int = None, db: Session = Depends(get_db)):
    q = db.query(Submission)
    if exam_id is not None:
        q = q.filter(Submission.exam_id == exam_id)

    # Filter out dummy pytest records
    dummy_names = [
        "Aarya Physics", "Aarav Test Copy", "Test Student", "Sony Angel",
        "Aarya_Physics", "Aarav_Test_Copy", "CSMidSemesterAssessment"
    ]
    q = q.filter(
        ~Submission.student_name.in_(dummy_names),
        ~Submission.student_name.ilike("%Aarya%"),
        ~Submission.student_name.ilike("%Aarav%Test%"),
        ~Submission.student_name.ilike("%Sony%Angel%"),
        ~Submission.roll_number.in_(["SGSU250347", "2026-PHY-01", "2026-PHY-02"])
    )
    raw_subs = q.all()

    # Sort with newest submissions at the top
    subs = sorted(raw_subs, key=lambda s: s.id, reverse=True)
    return [serialize_submission(s) for s in subs]


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return serialize_submission(sub)


@router.delete("/submissions/{submission_id}")
def delete_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    student_name = sub.student_name
    db.query(AnswerEvaluation).filter(AnswerEvaluation.submission_id == submission_id).delete()
    db.delete(sub)
    db.commit()
    return {"status": "success", "message": f"Submission {submission_id} ({student_name}) deleted"}


@router.delete("/submissions")
def clear_submissions(keep_core: bool = True, db: Session = Depends(get_db)):
    """Deletes old/unwanted submissions. If keep_core=True, preserves Sonu Argal and Stuti Gulati."""
    q = db.query(Submission)
    if keep_core:
        q = q.filter(
            ~Submission.roll_number.in_(["23347", "23BTM053", "SGSU250489"]),
            ~Submission.student_name.ilike("%Sonu%Argal%"),
            ~Submission.student_name.ilike("%Stuti%Gulati%")
        )
    subs_to_delete = q.all()
    deleted_count = len(subs_to_delete)
    for s in subs_to_delete:
        db.query(AnswerEvaluation).filter(AnswerEvaluation.submission_id == s.id).delete()
        db.delete(s)
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}


@router.post("/evaluate")
async def upload_and_evaluate_sheet(
    exam_id: int = Form(...),
    student_name: str = Form(...),
    roll_number: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    ext = Path(file.filename or "sheet.png").suffix.lower() or ".png"
    stem = f"sub_{roll_number.lower().replace(' ', '_')}_{int(datetime.now().timestamp())}"
    raw_path = UPLOADS_DIR / f"{stem}_raw{ext}"
    raw_bytes = await file.read()
    raw_path.write_bytes(raw_bytes)

    img_urls = ImagePreprocessor.process_answer_sheet(raw_path, UPLOADS_DIR, stem)
    pages_list = [
        {
            "page_number": p.get("page_number", idx),
            "original_url": p.get("original_image_url") or p.get("original_url"),
            "clahe_url": p.get("enhanced_image_url") or p.get("clahe_url"),
            "binary_url": p.get("binary_image_url") or p.get("binary_url"),
            "deskew_angle": p.get("deskew_angle", 0.0),
            "processing_time_ms": p.get("processing_time_ms", 120.0),
        }
        for idx, p in enumerate(img_urls, start=1)
    ]
    expected_q_nums = [q.question_number for q in exam.questions]
    ocr_Png_path = UPLOADS_DIR / f"{stem}_clahe.png"
    ocr_res = OCRService.extract_handwriting(ocr_Png_path, expected_q_nums)
    extracted_items = ocr_res[0]
    provider_label = ocr_res[1]

    sub = Submission(
        exam_id=exam.id,
        student_name=student_name,
        roll_number=roll_number,
        booklet_qr_code=f"QR-{roll_number}-2026",
        original_image_url=pages_list[0]["original_url"] if pages_list else "",
        enhanced_image_url=pages_list[0]["clahe_url"] if pages_list else "",
        binary_image_url=pages_list[0]["binary_url"] if pages_list else "",
        pages_metadata=pages_list,
        max_marks=exam.max_marks,
        total_question_count=len(exam.questions),
        evaluated_by_provider=provider_label,
    )
    db.add(sub)
    db.flush()

    extracted_map = {item["question_number"]: item for item in extracted_items}
    total_ai = 0.0
    conf_list = []
    flagged_cnt = 0

    for idx, q in enumerate(exam.questions):
        ext_item = extracted_map.get(
            q.question_number,
            {
                "question_number": q.question_number,
                "transcribed_text": "",
                "ocr_confidence": 0.85,
                "strikethrough_ignored": [],
                "illegible_words": [],
                "bbox_json": {"x_pct": 11, "y_pct": 15 + idx * 20, "w_pct": 84, "h_pct": 17},
            },
        )
        t_text = ext_item.get("transcribed_text", "")
        ocr_conf = float(ext_item.get("ocr_confidence", 0.88))
        conf_list.append(ocr_conf)

        grade_res = HybridGradingEngine.evaluate_single_answer(
            question_number=q.question_number,
            question_text=q.question_text,
            model_answer=q.model_answer,
            required_keywords=q.required_keywords or [],
            rubric_steps=q.rubric_steps or [],
            max_marks=q.max_marks,
            transcribed_text=t_text,
            ocr_confidence=ocr_conf,
        )
        if grade_res["needs_manual_review"]:
            flagged_cnt += 1
        total_ai += grade_res["suggested_marks"]

        ans_ev = AnswerEvaluation(
            submission_id=sub.id,
            question_rubric_id=q.id,
            question_number=q.question_number,
            transcribed_text=t_text,
            strikethrough_ignored=ext_item.get("strikethrough_ignored", []),
            illegible_words=ext_item.get("illegible_words", []),
            ocr_confidence=ocr_conf,
            bbox_json=ext_item.get("bbox_json", {"x_pct": 11, "y_pct": 15 + idx * 20, "w_pct": 84, "h_pct": 17}),
            keyword_score=grade_res["keyword_score"],
            semantic_score=grade_res["semantic_score"],
            llm_rubric_score=grade_res["llm_rubric_score"],
            llm_rubric_ratio=grade_res["llm_rubric_ratio"],
            suggested_marks=grade_res["suggested_marks"],
            final_marks=grade_res["final_marks"],
            max_marks=q.max_marks,
            matched_keywords=grade_res["matched_keywords"],
            missing_keywords=grade_res["missing_keywords"],
            step_checks=grade_res["step_checks"],
            missing_points=grade_res["missing_points"],
            feedback_rationale=grade_res["feedback_rationale"],
            answer_group_cluster=grade_res["answer_group_cluster"],
            needs_manual_review=grade_res["needs_manual_review"],
            flag_reasons=grade_res["flag_reasons"],
            concept_score=grade_res.get("concept_score"),
            concept_tag=grade_res.get("concept_tag"),
            detail_score=grade_res.get("detail_score"),
            detail_tag=grade_res.get("detail_tag"),
            formula_score=grade_res.get("formula_score"),
            formula_tag=grade_res.get("formula_tag"),
            red_ink_annotation=grade_res.get("red_ink_annotation"),
            grading_mode=grade_res.get("grading_mode", "reference_guided"),
            subject=grade_res.get("subject", exam.subject or "Physics"),
            is_verified=False,
        )
        db.add(ans_ev)

    sub.total_ai_marks = round(total_ai, 2)
    sub.total_final_marks = round(total_ai, 2)
    sub.avg_ocr_confidence = round(sum(conf_list) / max(1, len(conf_list)), 3)
    sub.needs_manual_review_count = flagged_cnt
    sub.status = "needs_review" if flagged_cnt > 0 else "ai_evaluated"
    sub.ai_counseling_tips = [
        "Include explicit mathematical complexity notation (e.g., O(V + E)) alongside prose descriptions.",
        "Ensure all rubric sub-steps (definition, formula, and real-world example) are clearly labeled.",
    ]

    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.put("/verify/{evaluation_id}")
@router.put("/{evaluation_id}/verify")
@router.put("/evaluations/{evaluation_id}/verify")
def verify_or_override_answer(
    evaluation_id: int, payload: TeacherOverrideRequest, db: Session = Depends(get_db)
):
    ev = db.query(AnswerEvaluation).filter(AnswerEvaluation.id == evaluation_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Answer evaluation record not found")

    q = ev.question_rubric
    if payload.transcribed_text is not None:
        ev.transcribed_text = payload.transcribed_text

    if payload.re_evaluate_ai and q:
        res = HybridGradingEngine.evaluate_single_answer(
            question_number=q.question_number,
            question_text=q.question_text,
            model_answer=q.model_answer,
            required_keywords=q.required_keywords or [],
            rubric_steps=q.rubric_steps or [],
            max_marks=q.max_marks,
            transcribed_text=ev.transcribed_text,
            ocr_confidence=max(0.88, ev.ocr_confidence),
        )
        ev.keyword_score = res["keyword_score"]
        ev.semantic_score = res["semantic_score"]
        ev.llm_rubric_score = res["llm_rubric_score"]
        ev.llm_rubric_ratio = res["llm_rubric_ratio"]
        ev.suggested_marks = res["suggested_marks"]
        ev.final_marks = res["suggested_marks"]
        ev.matched_keywords = res["matched_keywords"]
        ev.missing_keywords = res["missing_keywords"]
        ev.step_checks = res["step_checks"]
        ev.missing_points = res["missing_points"]
        ev.feedback_rationale = res["feedback_rationale"]
        ev.needs_manual_review = res["needs_manual_review"]
        ev.flag_reasons = res["flag_reasons"]

    if payload.step_checks is not None:
        ev.step_checks = payload.step_checks
        step_sum = sum(float(s.get("awarded_marks", 0.0)) for s in payload.step_checks if s.get("met", True))
        ev.final_marks = min(ev.max_marks, max(0.0, HybridGradingEngine.round_to_half(step_sum)))

    if payload.final_marks is not None:
        ev.final_marks = min(ev.max_marks, max(0.0, float(payload.final_marks)))

    if payload.teacher_comment is not None:
        ev.teacher_comment = payload.teacher_comment

    if payload.is_verified is not None:
        ev.is_verified = payload.is_verified
        if payload.is_verified:
            ev.needs_manual_review = False

    db.flush()

    # Recalculate parent Submission totals & verification status
    sub = ev.submission
    sub.total_final_marks = round(sum(a.final_marks for a in sub.answers), 2)
    sub.verified_question_count = sum(1 for a in sub.answers if a.is_verified)
    sub.needs_manual_review_count = sum(1 for a in sub.answers if a.needs_manual_review and not a.is_verified)

    if sub.verified_question_count >= sub.total_question_count:
        sub.status = "verified"
        sub.verified_at = datetime.now(timezone.utc)
    elif sub.needs_manual_review_count > 0:
        sub.status = "needs_review"
    else:
        sub.status = "ai_evaluated"

    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.post("/submissions/{submission_id}/approve-all")
def approve_all_questions_in_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    for a in sub.answers:
        a.is_verified = True
        a.needs_manual_review = False
    sub.verified_question_count = len(sub.answers)
    sub.needs_manual_review_count = 0
    sub.total_final_marks = round(sum(a.final_marks for a in sub.answers), 2)
    sub.status = "verified"
    sub.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.put("/submissions/{submission_id}/stamps")
def update_submission_stamps(
    submission_id: int, payload: StampAnnotationRequest, db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.stamps_json = payload.stamps
    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.put("/submissions/{submission_id}/annotations")
def update_submission_annotations(
    submission_id: int, payload: Any = Body(...), db: Session = Depends(get_db)
):
    """Persists teacher freehand strokes, highlighter paths, stamps, and notes to SQLite."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    annotations = []
    if isinstance(payload, dict):
        annotations = (
            payload.get("annotations")
            if payload.get("annotations") is not None
            else payload.get("stamps")
            if payload.get("stamps") is not None
            else payload.get("stamps_json")
            if payload.get("stamps_json") is not None
            else []
        )
        if "pages_metadata" in payload and payload["pages_metadata"] is not None:
            sub.pages_metadata = payload["pages_metadata"]
    elif isinstance(payload, list):
        annotations = payload

    sub.stamps_json = annotations
    db.commit()
    db.refresh(sub)
    res = serialize_submission(sub)
    res["annotations"] = sub.stamps_json or []
    return res


@router.put("/submissions/{submission_id}/batch-marks")
def batch_update_submission_marks(
    submission_id: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)
):
    """Bulk updates question marks from the Marks Overview & Quick Edit modal."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    marks_map = payload.get("marks") or {}
    for ans in sub.answers:
        str_id = str(ans.id)
        q_num = ans.question_number
        if str_id in marks_map:
            ans.final_marks = min(ans.max_marks, max(0.0, float(marks_map[str_id])))
            ans.is_verified = True
        elif q_num in marks_map:
            ans.final_marks = min(ans.max_marks, max(0.0, float(marks_map[q_num])))
            ans.is_verified = True

    sub.total_final_marks = round(sum(a.final_marks for a in sub.answers), 2)
    sub.verified_question_count = sum(1 for a in sub.answers if a.is_verified)
    sub.needs_manual_review_count = sum(
        1 for a in sub.answers if a.needs_manual_review and not a.is_verified
    )
    if sub.verified_question_count >= len(sub.answers):
        sub.status = "verified"
    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.patch("/submissions/{submission_id}/metadata")
@router.put("/submissions/{submission_id}/metadata")
def update_submission_metadata(
    submission_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Updates student metadata: student_name, roll_number, class_name, subject, branch_name."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    if "student_name" in payload and payload["student_name"] is not None:
        sub.student_name = str(payload["student_name"]).strip()
    if "roll_number" in payload and payload["roll_number"] is not None:
        sub.roll_number = str(payload["roll_number"]).strip()
    if "class_name" in payload and payload["class_name"] is not None:
        sub.class_name = str(payload["class_name"]).strip()
    if "subject" in payload and payload["subject"] is not None:
        sub.subject = str(payload["subject"]).strip()
    if "branch_name" in payload and payload["branch_name"] is not None:
        sub.branch_name = str(payload["branch_name"]).strip()

    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.post("/submissions/{submission_id}/apply-strictness")
def apply_submission_strictness(
    submission_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Dynamically applies AI strictness ('lenient' | 'standard' | 'strict') to an active submission,
    recalculates all question marks and 3-axis diagnostic scores in real-time, and updates unverified items.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    raw_strictness = payload.get("strictness", 5)
    level = HybridGradingEngine.parse_strictness_level(raw_strictness)
    sub.strictness = str(level)

    total_ai = 0.0
    total_final = 0.0

    for ans in sub.answers:
        q_rubric = ans.question_rubric
        q_text = q_rubric.question_text if q_rubric else f"Question {ans.question_number}"
        m_ans = q_rubric.model_answer if q_rubric else ""
        req_kws = q_rubric.required_keywords if q_rubric else []
        r_steps = q_rubric.rubric_steps if q_rubric else []
        max_m = ans.max_marks or (q_rubric.max_marks if q_rubric else 5.0)

        grade_res = HybridGradingEngine.evaluate_single_answer(
            question_number=ans.question_number,
            question_text=q_text,
            model_answer=m_ans,
            required_keywords=req_kws,
            rubric_steps=r_steps,
            max_marks=max_m,
            transcribed_text=ans.transcribed_text or "",
            ocr_confidence=ans.ocr_confidence or 0.90,
            subject=sub.subject,
            grading_mode=sub.grading_mode,
            strictness=level,
        )

        ans.suggested_marks = grade_res["suggested_marks"]
        ans.keyword_score = grade_res.get("keyword_score", ans.keyword_score)
        ans.semantic_score = grade_res.get("semantic_score", ans.semantic_score)
        ans.llm_rubric_score = grade_res.get("llm_rubric_score", ans.llm_rubric_score)
        ans.llm_rubric_ratio = grade_res.get("llm_rubric_ratio", ans.llm_rubric_ratio)
        ans.concept_score = grade_res.get("concept_score", ans.concept_score)
        ans.concept_tag = grade_res.get("concept_tag", ans.concept_tag)
        ans.detail_score = grade_res.get("detail_score", ans.detail_score)
        ans.detail_tag = grade_res.get("detail_tag", ans.detail_tag)
        ans.formula_score = grade_res.get("formula_score", ans.formula_score)
        ans.formula_tag = grade_res.get("formula_tag", ans.formula_tag)
        ans.red_ink_annotation = grade_res.get("red_ink_annotation", ans.red_ink_annotation)
        ans.feedback_rationale = grade_res.get("feedback_rationale", ans.feedback_rationale)
        if not ans.teacher_comment:
            ans.teacher_comment = ans.feedback_rationale

        if not ans.is_verified:
            ans.final_marks = grade_res["suggested_marks"]

        total_ai += ans.suggested_marks
        total_final += ans.final_marks

    sub.total_ai_marks = round(total_ai, 2)
    sub.total_final_marks = round(total_final, 2)
    db.commit()
    db.refresh(sub)
    return serialize_submission(sub)


@router.get("/export/exam/{exam_id}/csv")
def export_exam_marksheet_csv(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    output = io.StringIO()
    writer = csv.writer(output)
    q_headers = [f"{q.question_number} ({q.max_marks}m)" for q in exam.questions]
    writer.writerow(
        [
            "Roll Number",
            "Student Name",
            "Booklet QR",
            *q_headers,
            "AI Suggested Total",
            "Final Verified Total",
            "Max Marks",
            "Percentage (%)",
            "OCR Confidence (%)",
            "Plagiarism Similarity (%)",
            "Verification Status",
        ]
    )
    for sub in exam.submissions:
        ans_map = {a.question_number: a.final_marks for a in sub.answers}
        q_vals = [ans_map.get(q.question_number, 0.0) for q in exam.questions]
        pct = round((sub.total_final_marks / sub.max_marks) * 100.0, 1) if sub.max_marks > 0 else 0.0
        writer.writerow(
            [
                sub.roll_number,
                sub.student_name,
                sub.booklet_qr_code,
                *q_vals,
                sub.total_ai_marks,
                sub.total_final_marks,
                sub.max_marks,
                pct,
                round(sub.avg_ocr_confidence * 100.0, 1),
                sub.plagiarism_similarity_pct,
                sub.status.upper(),
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={exam.code}_verified_marksheet.csv"},
    )


@router.get("/sheets/{submission_id}/export-pdf")
@router.get("/sheets/{submission_id}/pdf")
@router.get("/export/submission/{submission_id}/pdf")
@router.get("/submission/{submission_id}/pdf")
@router.get("/submissions/{submission_id}/pdf")
def export_submission_report_pdf(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    buf = generate_student_evaluation_pdf(
        sub=sub,
        answers=sub.answers or [],
        diagnostic_fn=_build_diagnostic_report_for_answer,
    )
    safe_roll = re.sub(r"[^A-Za-z0-9_-]+", "_", str(sub.roll_number or f"sub_{sub.id}"))
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_roll}_smarted_evaluation_report.pdf"},
    )


@router.get("/sheets/{submission_id}/render-page")
def render_sheet_page(
    submission_id: int,
    page: int = 1,
    variant: str = "clahe",
    db: Session = Depends(get_db),
):
    """Renders page `page` (1-based) of the student's answer sheet copy.
    Guarantees upright orientation, disk-first ultra-fast serving (<2ms),
    and true multi-page document access without pegging Render Free Tier CPU.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    variant = (variant or "clahe").lower().strip()
    if variant not in ("original", "clahe", "binary", "corrected"):
        variant = "clahe"

    # 1. Disk-first check: Pre-rendered files on disk serve instantly with zero CPU load
    if sub.pages_metadata and isinstance(sub.pages_metadata, list):
        for pm in sub.pages_metadata:
            if pm.get("page_number") == page:
                url_key = f"{variant}_url"
                raw_url = pm.get(url_key) or pm.get("clahe_url") or pm.get("original_url")
                if raw_url and raw_url.startswith("/uploads/"):
                    fpath = UPLOADS_DIR / raw_url.replace("/uploads/", "")
                    if fpath.exists() and fpath.stat().st_size > 0 and "cover_crop" not in fpath.name:
                        media_t = "image/jpeg" if fpath.suffix.lower() in (".jpg", ".jpeg") else "image/png"
                        return FileResponse(str(fpath), media_type=media_t)

    # 2. Check fallback to original_image_url if single page
    if page == 1 and sub.original_image_url and sub.original_image_url.startswith("/uploads/"):
        fpath = UPLOADS_DIR / sub.original_image_url.replace("/uploads/", "")
        if fpath.exists() and fpath.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and fpath.stat().st_size > 0:
            media_t = "image/jpeg" if fpath.suffix.lower() in (".jpg", ".jpeg") else "image/png"
            return FileResponse(str(fpath), media_type=media_t)

    # 3. Only if pre-rendered image is missing, render from original PDF on the fly
    pdf_info = find_submission_pdf(sub)
    if pdf_info:
        pdf_path, count = pdf_info
        if 1 <= page <= count:
            import pypdfium2 as pdfium
            import cv2
            import numpy as np
            import gc

            doc = pdfium.PdfDocument(str(pdf_path))
            try:
                page_obj = doc[page - 1]
                pil_img = page_obj.render(scale=1.5).to_pil()

                if variant == "original":
                    buf = io.BytesIO()
                    pil_img.save(buf, format="JPEG", quality=85)
                    buf.seek(0)
                    return Response(content=buf.getvalue(), media_type="image/jpeg")

                # Fast CLAHE & Thresholding (sub-millisecond, safe for 0.1 CPU)
                bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
                deskewed, _ = ImagePreprocessor.deskew_with_angle(gray)
                clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(deskewed)

                if variant == "binary":
                    _, binary_clean = cv2.threshold(clahe, 175, 255, cv2.THRESH_BINARY)
                    _, enc = cv2.imencode(".jpg", binary_clean, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    return Response(content=enc.tobytes(), media_type="image/jpeg")
                else:
                    _, enc = cv2.imencode(".jpg", clahe, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    return Response(content=enc.tobytes(), media_type="image/jpeg")
            finally:
                doc.close()
                gc.collect()

    # 4. Fallback to synthetic handwritten sheet
    stem = f"sheet_{sub.id}_p{page}"
    answers_dict = [
        {"question_number": a.question_number, "transcribed_text": a.transcribed_text, "ocr_confidence": a.ocr_confidence}
        for a in (sub.answers or [])
    ]
    gen_res = ImagePreprocessor.generate_synthetic_handwritten_sheet(
        output_dir=UPLOADS_DIR,
        stem=stem,
        student_name=sub.student_name,
        roll_number=sub.roll_number,
        exam_code="EXAM-2026",
        answers_payload=answers_dict,
    )
    if gen_res and len(gen_res) > 0:
        f_p = gen_res[0].get("clahe") or gen_res[0].get("original")
        if f_p and Path(f_p).exists():
            return FileResponse(str(f_p), media_type="image/png")

    raise HTTPException(status_code=404, detail=f"Page {page} not found for submission {submission_id}")


@router.get("/sheets/{submission_id}/pages")
@router.get("/submissions/{submission_id}/pages")
def get_sheet_pages(submission_id: int, db: Session = Depends(get_db)):
    """Returns the true list of all pages for the student's submission."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    data = serialize_submission(sub)
    return {
        "submission_id": sub.id,
        "student_name": sub.student_name,
        "roll_number": sub.roll_number,
        "page_count": len(data.get("pages", [])),
        "pages": data.get("pages", []),
    }

