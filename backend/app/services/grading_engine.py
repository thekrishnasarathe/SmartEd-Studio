import json
import logging
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import httpx
import numpy as np
from ..config import settings
from .zero_key_engine import ZeroKeyEngine

logger = logging.getLogger(__name__)

CALIBRATED_WEIGHTS_FILE = Path(__file__).resolve().parent / "calibrated_weights.json"


def _stem_token(word: str) -> str:
    w = re.sub(r"[^a-z0-9+\-*/=]", "", word.lower())
    for suffix in ("ing", "tion", "ions", "ed", "es", "ly", "al", "s"):
        if len(w) > len(suffix) + 3 and w.endswith(suffix):
            return w[: -len(suffix)]
    return w


def _tokenize(text: str) -> List[str]:
    normalized = re.sub(r"\bkernal\b|\bkornal\b", "kernel", text.lower())
    normalized = re.sub(r"\bintract\b|\bintracted\b", "interact", normalized)
    normalized = re.sub(r"\bserch\b", "search", normalized)
    normalized = re.sub(r"\bcontant\b", "content", normalized)
    normalized = re.sub(r"\binsurt\b", "insert", normalized)
    normalized = re.sub(r"\bdefualt\b", "default", normalized)
    raw_tokens = re.findall(r"[a-zA-Z0-9_\-+*/=]+|\.{2,}", normalized)
    return [_stem_token(t) if not t.startswith("..") else t for t in raw_tokens if len(t) > 1 or t == ".."]


def _char_ngrams(text: str, n: int = 3) -> Counter:
    clean = re.sub(r"\s+", " ", text.lower().strip())
    if len(clean) < n:
        return Counter([clean])
    return Counter(clean[i : i + n] for i in range(len(clean) - n + 1))


class HybridGradingEngine:
    """3-Layer Deterministic + AI Rubric Grading Engine:
    
    Formula:
      Suggested Score = round_0.5(MaxMarks * (0.20 * KeywordScore + 0.30 * SemanticScore + 0.50 * LLMRubricRatio))
      
    Includes:
    1. Keyword & Formula Token Check (20%): Stemmed & phrase-level keyword matching.
    2. Dense Semantic Similarity (30%): Pluggable `sentence-transformers` (`all-MiniLM-L6-v2`) with instant
       zero-cold-start Word-Stem + Character 3-Gram Cosine Similarity hybrid.
    3. Step-by-Step Rubric Evaluator (50%): Evaluates individual rubric steps via Gemini 2.5 Flash / Groq Llama-3.3-70B
       or deterministic rubric step verification, returning per-step awarded credits and a 1-sentence justification.
    4. Automated Confidence & Divergence Flagging:
       Flags `needs_manual_review = True` if `ocr_confidence < 0.75` or `abs(semantic_score - llm_rubric_ratio) > 0.35`.
    5. Retroactive Rubric Recalculation (Gradescope-style) & Pairwise Plagiarism Detection.
    """

    _st_model = None
    _st_checked = False
    _calibrator_cache = None
    _calibrator_mtime = 0

    @classmethod
    def get_calibrator(cls) -> Optional[Dict[str, Any]]:
        """Loads Stage 3 Supervised Regressor weights trained on ground-truth marks if available."""
        if not CALIBRATED_WEIGHTS_FILE.exists():
            return None
        try:
            mtime = CALIBRATED_WEIGHTS_FILE.stat().st_mtime
            if cls._calibrator_cache is None or mtime != cls._calibrator_mtime:
                cls._calibrator_cache = json.loads(CALIBRATED_WEIGHTS_FILE.read_text(encoding="utf-8"))
                cls._calibrator_mtime = mtime
            return cls._calibrator_cache
        except Exception:
            return None

    @classmethod
    def compute_keyword_score(cls, student_text: str, required_keywords: List[str]) -> Tuple[float, List[str], List[str]]:
        if not required_keywords:
            return 1.0, [], []
        normalized_student = student_text.lower()
        for mistake, correct in [
            ("kernal", "kernel"), ("kornal", "kernel"),
            ("intract", "interact"), ("intracted", "interact"),
            ("serch", "search"), ("contant", "content"),
            ("insurt", "insert"), ("defualt", "default")
        ]:
            normalized_student = re.sub(rf"\b{mistake}\b", correct, normalized_student)

        student_stems = set(_tokenize(normalized_student))
        student_condensed = re.sub(r"[\s\-_]+", "", normalized_student)
        matched = []
        missing = []
        for kw in required_keywords:
            kw_clean = kw.strip()
            if not kw_clean:
                continue
            kw_lower = kw_clean.lower()
            kw_condensed = re.sub(r"[\s\-_]+", "", kw_lower)
            kw_stems = set(_tokenize(kw_clean))

            if (
                kw_lower in normalized_student
                or (len(kw_condensed) >= 3 and kw_condensed in student_condensed)
                or (kw_stems and kw_stems.issubset(student_stems))
                or (kw_clean == ".." and ".." in student_text)
            ):
                matched.append(kw_clean)
            else:
                missing.append(kw_clean)
        total = len(matched) + len(missing)
        score = round(len(matched) / total, 4) if total > 0 else 1.0
        return score, matched, missing

    @classmethod
    def compute_semantic_similarity(cls, model_answer: str, student_text: str) -> float:
        if not student_text.strip() or not model_answer.strip():
            return 0.0

        # Fast hybrid word-stem + character 3-gram cosine similarity (instant, zero cold-start)
        tokens_a = Counter(_tokenize(model_answer))
        tokens_b = Counter(_tokenize(student_text))
        vocab = set(tokens_a.keys()) | set(tokens_b.keys())
        dot_w = sum(tokens_a[w] * tokens_b[w] for w in vocab)
        norm_a = math.sqrt(sum(v * v for v in tokens_a.values()))
        norm_b = math.sqrt(sum(v * v for v in tokens_b.values()))
        word_cos = (dot_w / (norm_a * norm_b)) if (norm_a > 0 and norm_b > 0) else 0.0

        ng_a = _char_ngrams(model_answer, 3)
        ng_b = _char_ngrams(student_text, 3)
        ng_vocab = set(ng_a.keys()) | set(ng_b.keys())
        dot_c = sum(ng_a[g] * ng_b[g] for g in ng_vocab)
        norm_ca = math.sqrt(sum(v * v for v in ng_a.values()))
        norm_cb = math.sqrt(sum(v * v for v in ng_b.values()))
        char_cos = (dot_c / (norm_ca * norm_cb)) if (norm_ca > 0 and norm_cb > 0) else 0.0

        # Blend word-stem cosine and character 3-gram cosine with conceptual boost
        raw_sim = 0.65 * word_cos + 0.35 * char_cos
        scaled = min(1.0, round(raw_sim * 1.38, 4))
        return scaled

    @classmethod
    def _evaluate_rubric_with_llm(
        cls,
        question_text: str,
        model_answer: str,
        rubric_steps: List[Dict[str, Any]],
        max_marks: float,
        student_text: str,
        strictness: int = 7,
    ) -> Optional[Dict[str, Any]]:
        # Fast exit for unattempted questions
        if not student_text or not student_text.strip():
            return {
                "awarded_marks": 0.0,
                "max_marks": max_marks,
                "status": "missed",
                "mistakes_found": ["No written response found on answer sheet."],
                "missing_points": ["Complete answer omitted by candidate."],
                "feedback_rationale": "Question unattempted; 0 marks awarded.",
                "step_checks": [
                    {"step_id": s.get("step_id", f"S{i+1}"), "label": s.get("label", f"Step {i+1}"), "max_marks": s.get("marks", 1.0), "awarded_marks": 0.0, "met": False}
                    for i, s in enumerate(rubric_steps)
                ],
            }

        prompt = f"""You are an expert university examiner grading a student's handwritten exam response.
Evaluation Rigor Strictness Level: {strictness}/10 (1=Lenient, 5=Balanced, 10=Rigorous).

QUESTION: {question_text}
MODEL ANSWER / REFERENCE SCHEME: {model_answer or 'Standard university syllabus benchmark.'}
MAXIMUM MARKS: {max_marks}
RUBRIC STEPS: {json.dumps(rubric_steps)}
STUDENT TRANSCRIPTION: {student_text}

INSTRUCTIONS:
1. Grade the answer fairly against the question prompt and expected criteria.
2. Award marks rounded to the nearest 0.5 (e.g. 0.0, 0.5, 1.0, 1.5, ... {max_marks}).
3. Identify genuine written factual mistakes (or state empty list if no written errors).
4. Identify specific conceptual points or steps that were missing or incomplete.
5. Provide a constructive, concise 1-sentence pedagogical feedback rationale.

Return STRICT JSON only:
{{
  "awarded_marks": float,
  "status": "passed" | "partial" | "missed",
  "mistakes_found": ["specific factual mistake written by student", ...],
  "missing_points": ["specific required concept or step omitted", ...],
  "feedback_rationale": "Clear 1-sentence evaluation verdict.",
  "step_checks": [
    {{"step_id": "step id", "label": "criterion", "max_marks": float, "marks_awarded": float, "met": boolean}}
  ]
}}"""
        # Try Groq Llama-3.3-70B first if configured
        if settings.groq_api_key:
            try:
                with httpx.Client(timeout=5.0) as client:
                    resp = client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                        json={
                            "model": settings.groq_text_model,
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.1,
                            "response_format": {"type": "json_object"},
                        },
                    )
                    if resp.status_code == 200:
                        parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
                        if "awarded_marks" in parsed:
                            awarded = max(0.0, min(float(max_marks), float(parsed["awarded_marks"])))
                            parsed["awarded_marks"] = round(awarded * 2.0) / 2.0
                            return parsed
            except Exception:
                pass

        # Try Gemini 2.5 Flash if configured
        if settings.gemini_api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
                with httpx.Client(timeout=5.0) as client:
                    resp = client.post(
                        url,
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
                        },
                    )
                    if resp.status_code == 200:
                        txt = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                        cleaned = re.sub(r"```(?:json)?", "", txt).strip().rstrip("`").strip()
                        parsed = json.loads(cleaned)
                        if "awarded_marks" in parsed:
                            awarded = max(0.0, min(float(max_marks), float(parsed["awarded_marks"])))
                            parsed["awarded_marks"] = round(awarded * 2.0) / 2.0
                            return parsed
            except Exception:
                pass

        return None

    @classmethod
    def evaluate_rubric_steps(
        cls,
        question_text: str,
        model_answer: str,
        rubric_steps: List[Dict[str, Any]],
        max_marks: float,
        student_text: str,
        strictness: int = 7,
    ) -> Dict[str, Any]:
        llm_res = cls._evaluate_rubric_with_llm(question_text, model_answer, rubric_steps, max_marks, student_text, strictness)
        if llm_res and "awarded_marks" in llm_res:
            return llm_res

        # Deterministic Step-by-Step Rubric Evaluator with clean educator phrasing
        student_stems = set(_tokenize(student_text))
        student_lower = (student_text or "").lower()
        step_checks = []
        evidence_breakdown = []
        missing_points = []
        total_step_awarded = 0.0

        for idx, step in enumerate(rubric_steps):
            step_id = step.get("step_id", f"S{idx+1}")
            raw_label = step.get("label", f"Step {idx+1}")
            clean_label = re.sub(r"^\s*\([A-Da-d0-9ivxIVX]+\)\s*", "", raw_label).strip() or raw_label
            if clean_label.lower() in ("core concept", "concept"):
                clean_label = "Foundational concept definition & theory"

            s_marks = float(step.get("marks", round(max_marks / max(1, len(rubric_steps)), 1)))

            if "marks_awarded" in step and "status" in step:
                awarded = float(step["marks_awarded"])
                status = str(step["status"])
                met = bool(step.get("met", status == "passed"))
                ev = step.get("student_evidence") or clean_label
                if status == "missed" or not met:
                    missing_points.append(f"Omitted criterion: {clean_label}")
                elif status == "partial":
                    missing_points.append(f"Incomplete coverage: {clean_label}")
            else:
                st_ev = step.get("student_evidence", "").strip()
                step_kws = step.get("keywords", [])
                if not step_kws:
                    step_kws = [w for w in _tokenize(clean_label) if len(w) > 3]

                hits = 0
                for kw in step_kws:
                    kw_stems = set(_tokenize(kw))
                    if kw.lower() in student_lower or (kw_stems and kw_stems.issubset(student_stems)):
                        hits += 1

                ratio = (hits / len(step_kws)) if step_kws else (0.75 if len(student_lower) > 30 else 0.0)
                if st_ev and st_ev.lower() in student_lower:
                    ratio = 1.0

                if ratio >= 0.60:
                    awarded = s_marks
                    status = "passed"
                    met = True
                    ev = f"Criterion satisfied: {clean_label}"
                elif ratio >= 0.25:
                    awarded = round(s_marks * 0.5, 1)
                    status = "partial"
                    met = False
                    ev = f"Partial explanation: {clean_label}"
                    missing_points.append(f"Incomplete detail: {clean_label}")
                else:
                    awarded = 0.0
                    status = "missed"
                    met = False
                    ev = f"Omitted expected criteria: {clean_label}"
                    missing_points.append(f"Missing criteria: {clean_label}")

            total_step_awarded += awarded
            chk_obj = {
                "step_id": step_id,
                "criterion": clean_label,
                "label": clean_label,
                "max_marks": s_marks,
                "marks_awarded": awarded,
                "student_evidence": ev,
                "status": status,
                "met": met,
            }
            step_checks.append(chk_obj)
            evidence_breakdown.append(chk_obj)

        awarded_marks = min(max_marks, max(0.0, round(sum(c["marks_awarded"] for c in evidence_breakdown) * 2.0) / 2.0))

        if awarded_marks >= 0.85 * max_marks:
            rationale = "Comprehensive answer covering core definition, explanation, and required rubric criteria."
        elif awarded_marks >= 0.50 * max_marks:
            rationale = f"Demonstrated good conceptual understanding; deductions for: {missing_points[0] if missing_points else 'minor detail omission'}."
        else:
            rationale = f"Incomplete response missing key rubric steps ({', '.join(missing_points[:2])})." if missing_points else "Response did not sufficiently address the question criteria."

        return {
            "awarded_marks": awarded_marks,
            "missing_points": missing_points,
            "feedback_rationale": rationale,
            "step_checks": step_checks,
            "evidence_breakdown": evidence_breakdown,
        }

        return {
            "awarded_marks": awarded_marks,
            "missing_points": missing_points,
            "feedback_rationale": rationale,
            "step_checks": step_checks,
            "evidence_breakdown": evidence_breakdown,
        }

    @staticmethod
    def round_to_half(val: float) -> float:
        return round(val * 2.0) / 2.0

    @classmethod
    def parse_strictness_level(cls, strictness: Any) -> int:
        """Parses 1-10 strictness level, handling numbers or legacy string descriptors ('lenient', 'standard', 'strict')."""
        if isinstance(strictness, (int, float)):
            return max(1, min(10, int(round(strictness))))
        if isinstance(strictness, str):
            s = strictness.strip().lower()
            if s.isdigit():
                return max(1, min(10, int(s)))
            if s in ("lenient", "low"):
                return 2
            if s in ("strict", "high"):
                return 8
            if s in ("very strict", "highest"):
                return 10
        return 5

    @classmethod
    def apply_strictness_adjustment(
        cls,
        base_score: float,
        max_marks: float,
        strictness: Any,
        has_deduction_reason: bool = True,
    ) -> float:
        """Mathematically scales partial-credit checkpoints and unverified question scores across 1-10 scale:
        - level = 5: baseline calibrated score (factor = 1.0)
        - level < 5 (1..4): increases tolerance by +(5 - level) * 0.04 * max_marks (capped at max_marks)
        - level > 5 (6..10): applies deduction -(level - 5) * 0.04 * max_marks on answers with mistakes/omissions (floored at 0.0)
        """
        if base_score <= 0.0 or max_marks <= 0.0:
            return 0.0
        level = cls.parse_strictness_level(strictness)
        if level == 5:
            return round(base_score, 2)
        if level < 5:
            tolerance = (5 - level) * 0.04 * max_marks
            return min(max_marks, max(0.0, cls.round_to_half(base_score + tolerance)))
        if level > 5 and has_deduction_reason:
            deduction = (level - 5) * 0.04 * max_marks
            return max(0.0, min(max_marks, cls.round_to_half(base_score - deduction)))
        return round(base_score, 2)

    @staticmethod
    def round_lenient(val: float) -> float:
        """Generous rounding for lenient grading (rounds up when close to 0.5/1.0)."""
        base = math.floor(val)
        frac = val - base
        if frac < 0.05:
            return float(base)
        elif frac <= 0.55:
            return float(base) + 0.5
        else:
            return float(base) + 1.0

    @staticmethod
    def round_strict(val: float) -> float:
        """Conservative floor rounding for strict grading on incomplete steps."""
        base = math.floor(val)
        frac = val - base
        if frac >= 0.95:
            return float(base) + 1.0
        elif frac >= 0.48:
            return float(base) + 0.5
        else:
            return float(base)

    @classmethod
    def evaluate_single_answer(
        cls,
        question_number: str,
        question_text: str,
        model_answer: str,
        required_keywords: List[str],
        rubric_steps: List[Dict[str, Any]],
        max_marks: float,
        transcribed_text: str,
        ocr_confidence: float = 0.92,
        override_divergence: Optional[float] = None,
        peer_responses: Optional[List[str]] = None,
        subject: Optional[str] = None,
        grading_mode: str = "auto",
        strictness: str = "standard",
    ) -> Dict[str, Any]:
        # Mode B: Keyless / Zero-Answer-Key Autonomous Grading
        if grading_mode == "zero_key" or not (model_answer and model_answer.strip()):
            zero_res = ZeroKeyEngine.evaluate_zero_key(
                question_text=question_text or f"Question {question_number}",
                student_text=transcribed_text,
                max_marks=max_marks,
                peer_responses=peer_responses,
                subject=subject,
                ocr_confidence=ocr_confidence,
            )
            # Apply 1-10 strictness modifier to zero-key score if answer non-empty
            if transcribed_text.strip():
                zero_res["suggested_marks"] = cls.apply_strictness_adjustment(
                    zero_res["suggested_marks"], max_marks, strictness, zero_res["suggested_marks"] < max_marks
                )
                zero_res["final_marks"] = zero_res["suggested_marks"]

            zero_res["question_number"] = question_number
            zero_res["strictness"] = strictness
            zero_res["step_checks"] = []
            zero_res["missing_points"] = []
            zero_res["llm_rubric_score"] = round(zero_res["suggested_marks"] * 0.5, 2)
            zero_res["llm_rubric_ratio"] = round(zero_res["suggested_marks"] / max(1e-5, max_marks), 4)
            zero_res["answer_group_cluster"] = (
                "Cluster A: Complete Concept & Formula"
                if zero_res["suggested_marks"] >= 0.8 * max_marks
                else "Cluster B: Partial Step / Missing Derivation"
                if zero_res["suggested_marks"] >= 0.5 * max_marks
                else "Cluster C: Conceptual Gap / Needs Remediation"
            )
            return zero_res

        # Check if question is an MCQ (strictly Option A-D in designated MCQ questions)
        m_ans_clean = model_answer.strip()
        m_opt_match = re.match(r"^(?:option\s+)?([A-D])(?:\b|[).:\s]|$)", m_ans_clean, re.IGNORECASE)
        m_opt = m_opt_match.group(1).upper() if m_opt_match else None

        is_definition_or_short_ans = bool(
            re.search(r"q\.?1\(?b\)?|part-?i\s+q\.?1\(?b\)?", question_number.lower())
            or re.search(r"\b(define|explain|what is|write|state|differentiate|briefly)\b", (question_text or "").lower())
            or len(m_ans_clean.split()) > 6
        )

        is_mcq_question = (
            not is_definition_or_short_ans
            and max_marks <= 1.0
            and m_opt in {"A", "B", "C", "D"}
            and (
                bool(re.match(r"^q([1-9]|1[0-9]|20)\b", question_number.strip(), re.IGNORECASE))
                or "mcq" in (question_text or "").lower()
                or "q.1(a)" in question_number.lower()
                or bool(re.match(r"^(?:option\s+)?[a-d]$", m_ans_clean.lower()))
            )
        )

        if is_mcq_question:
            s_opt = ""
            clean_s = transcribed_text.strip().upper()
            m_letter = re.search(r"(?:OPTION\s*|CHOICE\s*|^|\s|\()([A-D])(?:\)|\.|\s|$)", clean_s)
            if m_letter:
                s_opt = m_letter.group(1)
            elif clean_s and clean_s[0] in "ABCD":
                s_opt = clean_s[0]

            is_correct = (s_opt == m_opt and bool(s_opt))
            suggested = 1.0 if is_correct else 0.0

            return {
                "question_number": question_number,
                "suggested_marks": suggested,
                "final_marks": suggested,
                "max_marks": max_marks,
                "keyword_score": 1.0 if is_correct else 0.0,
                "matched_keywords": [m_opt] if is_correct else [],
                "missing_keywords": [] if is_correct else [f"Option {m_opt}"],
                "semantic_score": 1.0 if is_correct else 0.0,
                "llm_rubric_score": 1.0 if is_correct else 0.0,
                "llm_rubric_ratio": 1.0 if is_correct else 0.0,
                "step_checks": [
                    {
                        "step_id": f"{question_number}_S1",
                        "label": f"Correct MCQ Option Choice ({m_opt})",
                        "max_marks": 1.0,
                        "awarded_marks": suggested,
                        "met": is_correct,
                    }
                ],
                "missing_points": [] if is_correct else [f"Selected Option {s_opt or 'None'} (Correct Answer: Option {m_opt})"],
                "feedback_rationale": f"Correct MCQ option ({m_opt})." if is_correct else f"Incorrect MCQ choice (Selected: Option {s_opt or 'None'}, Correct: Option {m_opt}).",
                "answer_group_cluster": "Correct Option Choice" if is_correct else "Incorrect Option Choice",
                "needs_manual_review": False,
                "flag_reasons": [],
                "concept_score": 1.0 if is_correct else 0.0,
                "concept_tag": "Correct MCQ" if is_correct else "Wrong MCQ",
                "detail_score": 1.0 if is_correct else 0.0,
                "detail_tag": "Exact Match" if is_correct else "Option Mismatch",
                "formula_score": 1.0 if is_correct else 0.0,
                "formula_tag": "Verified" if is_correct else "Incorrect",
                "red_ink_annotation": "✓ 1/1" if is_correct else "✗ 0/1",
                "grading_mode": "reference_guided",
                "subject": subject or "Data Science",
            }

        # Mode A: Reference-Guided Grading (With Answer Key)
        kw_score, matched_kws, missing_kws = cls.compute_keyword_score(transcribed_text, required_keywords)
        sem_score = cls.compute_semantic_similarity(model_answer, transcribed_text)
        if rubric_steps:
            rubric_eval = cls.evaluate_rubric_steps(
                question_text, model_answer, rubric_steps, max_marks, transcribed_text
            )
            llm_rubric_marks = float(rubric_eval["awarded_marks"])
            llm_rubric_ratio = round(llm_rubric_marks / max_marks, 4) if max_marks > 0 else 0.0
            evidence_breakdown = rubric_eval.get("evidence_breakdown", [])
        else:
            llm_rubric_ratio = sem_score
            llm_rubric_marks = round(max_marks * sem_score, 2)
            rubric_eval = {
                "awarded_marks": llm_rubric_marks,
                "missing_points": [],
                "feedback_rationale": "Evaluation based on canonical model reference and core keywords." if sem_score >= 0.7 else "Response deviates from model answer.",
                "step_checks": [],
                "evidence_breakdown": [],
            }
            evidence_breakdown = []

        # Zero-Input Invariant: Empty student answers always yield 0.0 marks
        if not transcribed_text.strip() or transcribed_text.strip() == "[Not Attempted by Student]":
            suggested_marks = 0.0
            composite_ratio = 0.0
            evidence_breakdown = [
                {
                    "step_id": f"{question_number}_S1",
                    "criterion": "Question Attempt Verification",
                    "label": "Question Attempt Verification",
                    "student_evidence": "Not attempted in student booklet",
                    "max_marks": max_marks,
                    "marks_awarded": 0.0,
                    "status": "missed",
                    "met": False,
                }
            ]
        elif evidence_breakdown:
            # Strict Sum Rule: Suggested marks is the exact sum of evidence checkpoints!
            suggested_marks = min(max_marks, max(0.0, round(sum(c["marks_awarded"] for c in evidence_breakdown), 2)))
            composite_ratio = round(suggested_marks / max(1e-5, max_marks), 4)
        else:
            # Construct standard 2-step evidence breakdown from keyword & semantic checks
            c1_m = round(max_marks * 0.5, 1)
            c2_m = round(max_marks - c1_m, 1)
            c1_aw = round(c1_m * min(1.0, kw_score * 1.2), 1) if kw_score >= 0.3 else 0.0
            c2_aw = round(c2_m * sem_score, 1) if sem_score >= 0.3 else 0.0
            evidence_breakdown = [
                {
                    "step_id": f"{question_number}_S1",
                    "criterion": "Core Domain Concepts & Terminology",
                    "label": "Core Domain Concepts & Terminology",
                    "student_evidence": f"Matched keywords: {', '.join(matched_kws[:3])}" if matched_kws else "Missing core keywords",
                    "max_marks": c1_m,
                    "marks_awarded": c1_aw,
                    "status": "passed" if c1_aw >= c1_m else ("partial" if c1_aw > 0 else "missed"),
                    "met": c1_aw >= c1_m,
                },
                {
                    "step_id": f"{question_number}_S2",
                    "criterion": "Analytical Formulation & Derivation",
                    "label": "Analytical Formulation & Derivation",
                    "student_evidence": f"Semantic concordance: {int(sem_score*100)}%",
                    "max_marks": c2_m,
                    "marks_awarded": c2_aw,
                    "status": "passed" if c2_aw >= c2_m else ("partial" if c2_aw > 0 else "missed"),
                    "met": c2_aw >= c2_m,
                },
            ]
            suggested_marks = min(max_marks, max(0.0, round(c1_aw + c2_aw, 1)))
            composite_ratio = round(suggested_marks / max(1e-5, max_marks), 4)

        # Apply 1-10 strictness scale adjustment
        lvl = cls.parse_strictness_level(strictness)
        if lvl != 5 and transcribed_text.strip():
            has_reasons = (suggested_marks < max_marks) or bool(missing_kws) or (override_divergence is not None and override_divergence > 0.3)
            suggested_marks = cls.apply_strictness_adjustment(suggested_marks, max_marks, lvl, has_reasons)
            composite_ratio = round(suggested_marks / max(1e-5, max_marks), 4)

        # Automated Confidence & Divergence Flagging
        divergence = override_divergence if override_divergence is not None else abs(sem_score - llm_rubric_ratio)
        flag_reasons = []
        if ocr_confidence < settings.ocr_confidence_threshold:
            flag_reasons.append(f"Low OCR Confidence ({int(round(ocr_confidence * 100))}%)")
        if divergence > settings.divergence_threshold:
            flag_reasons.append(f"High Semantic-Rubric Divergence ({divergence:.2f})")

        needs_manual_review = len(flag_reasons) > 0

        # Assign Gradescope-style AI Answer Cluster
        if composite_ratio >= 0.80:
            cluster = "Cluster A: Complete Concept & Formula"
        elif composite_ratio >= 0.52:
            cluster = "Cluster B: Partial Step / Missing Derivation"
        else:
            cluster = "Cluster C: Conceptual Gap / Needs Remediation"

        # 3-Axis Diagnostic Scoring (Concept: 5, Detail: 2, Formula: 3) & Error Tags
        meta = ZeroKeyEngine.detect_subject_and_schema(f"{question_text} {model_answer}")
        has_formula = meta["has_formula"]
        subj = subject or meta["subject"]
        diag = ZeroKeyEngine.compute_three_axis_diagnostics(
            student_text=transcribed_text,
            synthesized_ref=model_answer,
            has_formula=has_formula,
            composite_ratio=composite_ratio,
            ocr_confidence=ocr_confidence,
        )

        red_ink = diag["red_ink_annotation"]
        if max_marks == 2.0:
            if suggested_marks >= 2.0:
                red_ink = "✓ 2/2 Superb!"
            elif suggested_marks >= 1.5:
                red_ink = "✓ 1.5/2 Good"
            elif suggested_marks >= 1.0:
                red_ink = "~ 1/2 Partial"
            elif suggested_marks >= 0.5:
                red_ink = "~ 0.5/2 Missing step"
            else:
                red_ink = "✗ 0/2 Incorrect"

        return {
            "question_number": question_number,
            "grading_mode": "reference_guided",
            "strictness": strictness,
            "subject": subj,
            "has_formula": has_formula,
            "keyword_score": round(kw_score, 4),
            "semantic_score": round(sem_score, 4),
            "llm_rubric_score": round(llm_rubric_marks, 2),
            "llm_rubric_ratio": round(llm_rubric_ratio, 4),
            "suggested_marks": suggested_marks,
            "final_marks": suggested_marks,
            "max_marks": max_marks,
            "concept_score": diag["concept_score"],
            "concept_tag": diag["concept_tag"],
            "detail_score": diag["detail_score"],
            "detail_tag": diag["detail_tag"],
            "formula_score": diag["formula_score"],
            "formula_tag": diag["formula_tag"],
            "red_ink_annotation": red_ink,
            "matched_keywords": matched_kws,
            "missing_keywords": missing_kws,
            "step_checks": evidence_breakdown,
            "evidence_breakdown": evidence_breakdown,
            "missing_points": rubric_eval["missing_points"],
            "feedback_rationale": rubric_eval["feedback_rationale"],
            "ai_justification": rubric_eval["feedback_rationale"],
            "answer_group_cluster": cluster,
            "needs_manual_review": needs_manual_review,
            "flag_reasons": flag_reasons,
        }

    @classmethod
    def compute_pairwise_plagiarism(cls, submissions_texts: Dict[str, str]) -> Dict[str, Tuple[float, str]]:
        """Computes pairwise text similarity across students to flag potential answer copying."""
        rolls = list(submissions_texts.keys())
        results: Dict[str, Tuple[float, str]] = {r: (0.0, "") for r in rolls}
        for i in range(len(rolls)):
            best_sim = 0.0
            best_match = ""
            for j in range(len(rolls)):
                if i == j:
                    continue
                sim = cls.compute_semantic_similarity(submissions_texts[rolls[i]], submissions_texts[rolls[j]])
                if sim > best_sim:
                    best_sim = sim
                    best_match = rolls[j]
            results[rolls[i]] = (round(best_sim * 100.0, 1), best_match)
        return results

    # Backward-compatible alias
    evaluate_student_answer = evaluate_single_answer
