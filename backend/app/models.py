from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    subject = Column(String(128), nullable=False)
    department = Column(String(128), default="CSE (AI & DS)")
    semester = Column(String(64), default="Semester V")
    max_marks = Column(Float, default=20.0)
    question_paper_url = Column(String(512), nullable=True)
    question_paper_pages = Column(JSON, default=list)
    question_paper_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    questions = relationship(
        "QuestionRubric", back_populates="exam", cascade="all, delete-orphan", order_by="QuestionRubric.question_order"
    )
    submissions = relationship(
        "Submission", back_populates="exam", cascade="all, delete-orphan"
    )


class QuestionRubric(Base):
    __tablename__ = "question_rubrics"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    question_number = Column(String(32), nullable=False)  # e.g., "Q1", "Q2"
    question_order = Column(Integer, default=1)
    question_text = Column(Text, nullable=False)
    model_answer = Column(Text, nullable=False)
    max_marks = Column(Float, nullable=False, default=5.0)
    required_keywords = Column(JSON, default=list)        # list of strings
    rubric_steps = Column(JSON, default=list)             # list of {id, label, marks, keywords}
    bloom_taxonomy = Column(String(64), default="Analyze & Apply")

    exam = relationship("Exam", back_populates="questions")
    evaluations = relationship("AnswerEvaluation", back_populates="question_rubric")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String(128), nullable=False)
    roll_number = Column(String(64), nullable=False, index=True)
    class_name = Column(String(64), default="Class 12-A")
    booklet_qr_code = Column(String(64), default="")
    original_image_url = Column(String(512), nullable=False)
    enhanced_image_url = Column(String(512), default="")
    binary_image_url = Column(String(512), default="")
    pages_metadata = Column(JSON, default=list)
    status = Column(String(32), default="ai_evaluated")   # pending | ai_evaluated | needs_review | verified
    total_ai_marks = Column(Float, default=0.0)
    total_final_marks = Column(Float, default=0.0)
    max_marks = Column(Float, default=20.0)
    avg_ocr_confidence = Column(Float, default=0.90)
    needs_manual_review_count = Column(Integer, default=0)
    verified_question_count = Column(Integer, default=0)
    total_question_count = Column(Integer, default=4)
    plagiarism_similarity_pct = Column(Float, default=0.0)
    plagiarism_matched_roll = Column(String(64), default="")
    ai_counseling_tips = Column(JSON, default=list)
    stamps_json = Column(JSON, default=list)              # On-sheet red-pen stamps [{id, x_pct, y_pct, label, color}]
    evaluated_by_provider = Column(String(64), default="local_hybrid")
    subject = Column(String(64), default="Physics")
    grading_mode = Column(String(32), default="reference_guided")
    strictness = Column(String(32), default="standard")
    session_label = Column(String(64), default="Today's Session")
    branch_name = Column(String(64), default="Cloud & Cyber Security (C.C.)")
    question_paper_url = Column(String(512), nullable=True)
    question_paper_pages = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow)
    verified_at = Column(DateTime, nullable=True)

    exam = relationship("Exam", back_populates="submissions")
    answers = relationship(
        "AnswerEvaluation", back_populates="submission", cascade="all, delete-orphan", order_by="AnswerEvaluation.id"
    )


class AnswerEvaluation(Base):
    __tablename__ = "answer_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    question_rubric_id = Column(Integer, ForeignKey("question_rubrics.id", ondelete="CASCADE"), nullable=False)
    question_number = Column(String(32), nullable=False)
    transcribed_text = Column(Text, default="")
    strikethrough_ignored = Column(JSON, default=list)    # Crossed-out words ignored by OCR
    illegible_words = Column(JSON, default=list)
    ocr_confidence = Column(Float, default=0.90)
    bbox_json = Column(JSON, default=dict)                # {x_pct, y_pct, w_pct, h_pct} on sheet

    # 3-Layer Scoring Breakdown
    keyword_score = Column(Float, default=0.0)            # 0.0 to 1.0
    semantic_score = Column(Float, default=0.0)           # 0.0 to 1.0
    llm_rubric_score = Column(Float, default=0.0)         # 0.0 to max_marks
    llm_rubric_ratio = Column(Float, default=0.0)         # 0.0 to 1.0
    suggested_marks = Column(Float, default=0.0)          # Rounded to 0.5
    final_marks = Column(Float, default=0.0)              # Teacher approved/overridden marks
    max_marks = Column(Float, default=5.0)

    matched_keywords = Column(JSON, default=list)
    missing_keywords = Column(JSON, default=list)
    step_checks = Column(JSON, default=list)              # [{step_id, label, max_marks, awarded_marks, met}]
    evidence_breakdown = Column(JSON, default=list)       # [{step_id, criterion, student_evidence, max_marks, marks_awarded, status}]
    missing_points = Column(JSON, default=list)
    feedback_rationale = Column(Text, default="")
    answer_group_cluster = Column(String(64), default="Cluster A: Full Concept Mastery")

    # 3-Axis Diagnostic Dimensions & Zero-Key Tags
    concept_score = Column(Float, default=5.0)
    concept_tag = Column(String(64), default="Verified")
    detail_score = Column(Float, default=2.0)
    detail_tag = Column(String(64), default="Complete")
    formula_score = Column(Float, default=3.0)
    formula_tag = Column(String(64), default="Exact")
    red_ink_annotation = Column(String(64), default="✓ Superb!")
    grading_mode = Column(String(32), default="reference_guided")
    subject = Column(String(64), default="Physics")
    page_number = Column(Integer, default=1)

    # HITL Flags
    needs_manual_review = Column(Boolean, default=False)
    flag_reasons = Column(JSON, default=list)             # e.g. ["Low OCR Confidence (68%)", "High Semantic-Rubric Divergence (0.41)"]
    is_verified = Column(Boolean, default=False)
    teacher_comment = Column(Text, default="")

    submission = relationship("Submission", back_populates="answers")
    question_rubric = relationship("QuestionRubric", back_populates="evaluations")
