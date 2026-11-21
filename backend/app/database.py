from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = Path(__file__).resolve().parent.parent / "smart_evaluator.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 15}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_database_schema(db_engine=None):
    """Automatically alters SQLite tables if new Stage 3 diagnostic or mode columns are missing."""
    from sqlalchemy import text
    eng = db_engine or engine
    with eng.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(answer_evaluations)"))
            existing_ans_cols = {row[1] for row in res.fetchall()}
            needed_ans_cols = [
                ("concept_score", "FLOAT"),
                ("concept_tag", "VARCHAR(50)"),
                ("detail_score", "FLOAT"),
                ("detail_tag", "VARCHAR(50)"),
                ("formula_score", "FLOAT"),
                ("formula_tag", "VARCHAR(50)"),
                ("red_ink_annotation", "VARCHAR(100)"),
                ("grading_mode", "VARCHAR(50)"),
                ("subject", "VARCHAR(100)"),
                ("page_number", "INTEGER DEFAULT 1"),
                ("evidence_breakdown", "TEXT"),
            ]
            for col_name, col_type in needed_ans_cols:
                if col_name not in existing_ans_cols:
                    conn.execute(text(f"ALTER TABLE answer_evaluations ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception:
            pass

        try:
            res = conn.execute(text("PRAGMA table_info(submissions)"))
            existing_sub_cols = {row[1] for row in res.fetchall()}
            needed_sub_cols = [
                ("subject", "VARCHAR(100)"),
                ("grading_mode", "VARCHAR(50)"),
                ("strictness", "VARCHAR(32) DEFAULT 'standard'"),
                ("question_paper_url", "VARCHAR(512)"),
                ("question_paper_pages", "TEXT"),
                ("session_label", "VARCHAR(64)"),
                ("branch_name", "VARCHAR(64)"),
            ]
            for col_name, col_type in needed_sub_cols:
                if col_name not in existing_sub_cols:
                    conn.execute(text(f"ALTER TABLE submissions ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception:
            pass

        try:
            res = conn.execute(text("PRAGMA table_info(exams)"))
            existing_exam_cols = {row[1] for row in res.fetchall()}
            needed_exam_cols = [
                ("question_paper_url", "VARCHAR(512)"),
                ("question_paper_pages", "TEXT"),
                ("session_label", "VARCHAR(64)"),
                ("branch_name", "VARCHAR(64)"),
                ("question_paper_text", "TEXT"),
            ]
            for col_name, col_type in needed_exam_cols:
                if col_name not in existing_exam_cols:
                    conn.execute(text(f"ALTER TABLE exams ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception:
            pass


# Execute migration automatically upon engine creation
try:
    migrate_database_schema()
except Exception:
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
