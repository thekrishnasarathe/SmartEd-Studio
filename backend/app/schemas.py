from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RubricStepSchema(BaseModel):
    step_id: str
    label: str
    marks: float
    keywords: List[str] = Field(default_factory=list)


class QuestionRubricCreate(BaseModel):
    question_number: str
    question_order: int = 1
    question_text: str
    model_answer: str
    max_marks: float = 5.0
    required_keywords: List[str] = Field(default_factory=list)
    rubric_steps: List[RubricStepSchema] = Field(default_factory=list)
    bloom_taxonomy: str = "Analyze & Apply"


class QuestionRubricOut(QuestionRubricCreate):
    id: int
    exam_id: int

    class Config:
        from_attributes = True


class ExamCreate(BaseModel):
    code: str
    title: str
    subject: str
    department: str = "CSE (AI & DS)"
    semester: str = "Semester V"
    max_marks: float = 20.0
    questions: List[QuestionRubricCreate] = Field(default_factory=list)


class RetroactiveRubricUpdate(BaseModel):
    question_number: str
    max_marks: Optional[float] = None
    required_keywords: Optional[List[str]] = None
    rubric_steps: Optional[List[Dict[str, Any]]] = None
    model_answer: Optional[str] = None


class TeacherOverrideRequest(BaseModel):
    final_marks: Optional[float] = None
    transcribed_text: Optional[str] = None
    teacher_comment: Optional[str] = None
    is_verified: Optional[bool] = None
    step_checks: Optional[List[Dict[str, Any]]] = None
    re_evaluate_ai: bool = False


class StampAnnotationRequest(BaseModel):
    stamps: List[Dict[str, Any]]


class CredentialsUpdateRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    groq_api_key: Optional[str] = None
    groq_vision_model: Optional[str] = None
    groq_text_model: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    openrouter_model: Optional[str] = None
    ollama_base_url: Optional[str] = None
    active_ocr_provider: Optional[str] = None
    active_grading_provider: Optional[str] = None
    weight_keyword: Optional[float] = None
    weight_semantic: Optional[float] = None
    weight_rubric: Optional[float] = None
    ocr_confidence_threshold: Optional[float] = None
    divergence_threshold: Optional[float] = None
