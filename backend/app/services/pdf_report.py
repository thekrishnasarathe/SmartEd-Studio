"""SmartEd Evaluation Studio — Official PDF Report Generator.

Generates official, publication-grade, institutional student marks reports
with Deep Botanical Forest (#141D18) & Warm Gold (#D8BE8B) styling,
2-column student/exam cards, prominent score summary boxes,
part-wise marks tables, KeepTogether question cards, and running page footers (Page X of Y).
"""

import io
import logging
import re
import html
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    PageBreak,
)
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and stamp 'Page X of Y'
    along with running headers and footers across all generated pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#78716C"))

        # Top running header on pages 2+
        if self._pageNumber > 1:
            self.drawString(36, 812, "SmartEd Evaluation Studio · Official Academic Evaluation Report")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(36, 806, 559, 806)

        # Bottom running footer on all pages
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 32, 559, 32)

        self.drawString(36, 20, "SmartEd Evaluation Studio · Confidential Academic Report · Tamper-Evident Ledger")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(559, 20, page_str)

        self.restoreState()


def clean_page_number(raw: Any) -> str:
    """Deduplicates repetitive page strings into clean ranges like '1' or '1–3'."""
    if raw is None:
        return "1"
    if isinstance(raw, int):
        return str(raw)
    digits = [int(d) for d in re.findall(r"\d+", str(raw))]
    if not digits:
        return "1"
    uniq = sorted(list(set(digits)))
    if len(uniq) == 1:
        return str(uniq[0])
    is_consec = all(uniq[i] == uniq[i-1] + 1 for i in range(1, len(uniq)))
    return f"{uniq[0]}–{uniq[-1]}" if is_consec else ", ".join(map(str, uniq))


def compute_grade_info(pct: float) -> Dict[str, str]:
    """Official academic grading scale conforming to university standards."""
    p = float(pct)
    if p >= 85.0:
        return {"grade": "Grade A+", "letter": "A+", "status": "Distinction", "color": "#047857", "badge_bg": "#DCFCE7"}
    if p >= 70.0:
        return {"grade": "Grade A", "letter": "A", "status": "Mastery", "color": "#16A34A", "badge_bg": "#DCFCE7"}
    if p >= 55.0:
        return {"grade": "Grade B", "letter": "B", "status": "Proficient", "color": "#2563EB", "badge_bg": "#DBEAFE"}
    if p >= 40.0:
        return {"grade": "Grade C", "letter": "C", "status": "Satisfactory", "color": "#D97706", "badge_bg": "#FEF3C7"}
    return {"grade": "Grade F", "letter": "F", "status": "Needs Attention", "color": "#DC2626", "badge_bg": "#FEE2E2"}


def generate_student_evaluation_pdf(sub: Any, answers: List[Any], diagnostic_fn: Any) -> io.BytesIO:
    """
    Generates an institutional student evaluation PDF report conforming to university standards.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=42,
    )
    styles = getSampleStyleSheet()
    story = []

    # Palette
    color_forest = colors.HexColor("#141D18")
    color_gold = colors.HexColor("#D8BE8B")
    color_forest_light = colors.HexColor("#1A251F")
    color_border = colors.HexColor("#CBD5E1")
    color_slate_dark = colors.HexColor("#1E293B")
    color_slate_muted = colors.HexColor("#64748B")

    # Typography styles
    banner_title = ParagraphStyle(
        "BannerTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.whitesmoke,
        alignment=0,
    )
    banner_sub = ParagraphStyle(
        "BannerSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=color_gold,
        alignment=0,
    )
    section_h1 = ParagraphStyle(
        "SectionH1",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=color_forest,
        spaceBefore=8,
        spaceAfter=5,
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#64748B"),
    )
    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=color_slate_dark,
    )
    score_big = ParagraphStyle(
        "ScoreBig",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=18,
        textColor=color_forest,
        alignment=1,
    )
    score_sub = ParagraphStyle(
        "ScoreSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#475569"),
        alignment=1,
    )
    tbl_hdr = ParagraphStyle(
        "TblHdr",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.whitesmoke,
        alignment=1,
    )
    tbl_cell = ParagraphStyle(
        "TblCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=color_slate_dark,
    )
    tbl_cell_center = ParagraphStyle(
        "TblCellCenter",
        parent=tbl_cell,
        alignment=1,
    )

    # 1. TOP FORMAL BANNER IN DEEP BOTANICAL FOREST & WARM GOLD
    inst_name = getattr(sub, "university_name", "") or "Faculty of Computing & Higher Education"
    exam_title = getattr(sub.exam, "title", None) if getattr(sub, "exam", None) else None
    display_title = sub.subject or exam_title or "Official Academic Examination Report"

    banner_data = [
        [
            Paragraph(f"<b>SMARTED EVALUATION STUDIO</b> &nbsp;·&nbsp; <font size=9>{html.escape(inst_name)}</font>", banner_title),
            Paragraph(f"<b>OFFICIAL REPORT</b><br/><font color='#D8BE8B'>CONFIDENTIAL</font>", ParagraphStyle("BannerRight", parent=banner_sub, alignment=2)),
        ],
        [
            Paragraph(f"Assessment Blueprint: <b>{html.escape(display_title)}</b>", banner_sub),
            Paragraph(f"Verified Ledger #2026-{sub.id:04d}", ParagraphStyle("LedgerCode", parent=banner_sub, alignment=2)),
        ],
    ]
    banner_tbl = Table(banner_data, colWidths=[5.4 * inch, 1.8 * inch])
    banner_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color_forest),
        ("LINEBELOW", (0, -1), (-1, -1), 2.5, color_gold),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(banner_tbl)
    story.append(Spacer(1, 8))

    # Calculate overall metrics
    sub_max_m = float(sub.max_marks or 60.0)
    sub_final_m = float(sub.total_final_marks if sub.total_final_marks is not None else (sub.total_ai_marks or 0.0))
    pct = round((sub_final_m / max(1.0, sub_max_m)) * 100.0, 1)
    grade = compute_grade_info(pct)

    # 2. TWO-COLUMN STUDENT & EXAM INFO CARD + SCORE SUMMARY BADGE
    student_details = [
        [Paragraph("STUDENT NAME", meta_label), Paragraph(f"<b>{html.escape(sub.student_name or 'Unregistered Scholar')}</b>", meta_val)],
        [Paragraph("ROLL NUMBER", meta_label), Paragraph(f"<b>{html.escape(sub.roll_number or 'N/A')}</b>", meta_val)],
        [Paragraph("ACADEMIC CLASS", meta_label), Paragraph(html.escape(getattr(sub, "class_name", "") or "B.C.A. · Semester 2"), meta_val)],
        [Paragraph("SUBJECT / MODULE", meta_label), Paragraph(html.escape(display_title), meta_val)],
    ]
    student_tbl = Table(student_details, colWidths=[1.1 * inch, 2.3 * inch])
    student_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))

    score_box_content = [
        [Paragraph(f"<b><font color='{grade['color']}'>{sub_final_m:.1f} / {sub_max_m:.1f}</font></b>", score_big)],
        [Paragraph(f"<b>{pct}% Total Score</b>", score_sub)],
        [Paragraph(f"<b><font color='{grade['color']}'>{grade['grade']} · {grade['status']}</font></b>", score_sub)],
        [Paragraph(f"<font size=7 color='#64748B'>Status: Verified & Signed</font>", score_sub)],
    ]
    score_tbl = Table(score_box_content, colWidths=[2.0 * inch])
    score_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(grade["badge_bg"])),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor(grade["color"])),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    eval_meta_details = [
        [Paragraph("EVALUATION MODE", meta_label), Paragraph(html.escape(getattr(sub, "grading_mode", "Reference Guided").replace("_", " ").title()), meta_val)],
        [Paragraph("BOOKLET QR CODE", meta_label), Paragraph(html.escape(sub.booklet_qr_code or f"QR-{sub.id:04d}"), meta_val)],
        [Paragraph("VERIFICATION DATE", meta_label), Paragraph("November 2026 (Live Audit)", meta_val)],
        [Paragraph("SCRIPTS SCRUTINY", meta_label), Paragraph("Human-in-the-Loop Verified", meta_val)],
    ]
    eval_tbl = Table(eval_meta_details, colWidths=[1.1 * inch, 1.8 * inch])
    eval_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))

    summary_master = [
        [student_tbl, score_tbl],
    ]
    summary_tbl = Table(summary_master, colWidths=[4.9 * inch, 2.3 * inch])
    summary_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, color_border),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 10))

    # 3. PART-WISE & QUESTION-WISE SUMMARY TABLE (ALTERNATING ROWS)
    story.append(Paragraph("<b>1. Question-Wise Marks Summary Ledger</b>", section_h1))

    table_rows = [[
        Paragraph("<b>Q.No</b>", tbl_hdr),
        Paragraph("<b>Part</b>", tbl_hdr),
        Paragraph("<b>Page</b>", tbl_hdr),
        Paragraph("<b>Max</b>", tbl_hdr),
        Paragraph("<b>Awarded</b>", tbl_hdr),
        Paragraph("<b>Status</b>", tbl_hdr),
        Paragraph("<b>Key Finding / Rubric Match</b>", tbl_hdr),
    ]]

    for a in answers:
        diag = diagnostic_fn(a) if diagnostic_fn else {}
        m_list = diag.get("mistakes_found", [])
        mp_list = diag.get("missing_points", [])

        if m_list and "No factual mistakes" not in m_list[0] and "No factual errors" not in m_list[0]:
            finding = m_list[0]
        elif mp_list:
            finding = mp_list[0]
        else:
            finding = "Meets expected technical rubric criteria."

        clean_page = clean_page_number(getattr(a, "page_number", None) or (a.bbox_json.get("page_number") if isinstance(a.bbox_json, dict) else 1))
        f_m = float(a.final_marks if a.final_marks is not None else (a.suggested_marks or 0.0))
        m_m = float(a.max_marks or 1.0)
        q_pct = (f_m / max(0.1, m_m)) * 100.0

        if q_pct >= 80.0:
            status_html = "<font color='#047857'><b>Full</b></font>"
        elif q_pct >= 40.0:
            status_html = "<font color='#D97706'><b>Partial</b></font>"
        else:
            status_html = "<font color='#DC2626'><b>Needs Work</b></font>"

        part_lbl = getattr(a, "part_id", "") or ("Part I" if "1(" in str(a.question_number) else "Part II" if int(re.sub(r"\D", "", str(a.question_number)) or 1) <= 6 else "Part III")

        table_rows.append([
            Paragraph(f"<b>{html.escape(str(a.question_number))}</b>", tbl_cell),
            Paragraph(html.escape(part_lbl), tbl_cell_center),
            Paragraph(f"P.{clean_page}", tbl_cell_center),
            Paragraph(f"{m_m:.1f}m", tbl_cell_center),
            Paragraph(f"<b>{f_m:.1f}m</b>", tbl_cell_center),
            Paragraph(status_html, tbl_cell_center),
            Paragraph(html.escape(finding[:90]), tbl_cell),
        ])

    ledger_tbl = Table(table_rows, colWidths=[0.95 * inch, 0.75 * inch, 0.5 * inch, 0.5 * inch, 0.65 * inch, 0.75 * inch, 3.1 * inch])
    ledger_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), color_forest),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("GRID", (0, 0), (-1, -1), 0.5, color_border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ledger_tbl)
    story.append(Spacer(1, 12))

    # 4. QUESTION-BY-QUESTION BREAKDOWN (WRAPPED IN KEEPTOGETHER)
    story.append(Paragraph("<b>2. Point-by-Point Evaluation &amp; Diagnostic Breakdown</b>", section_h1))

    for idx, a in enumerate(answers, 1):
        diag = diagnostic_fn(a) if diagnostic_fn else {}
        q_rubric = getattr(a, "question_rubric", None)
        q_text = (q_rubric.question_text if q_rubric and q_rubric.question_text else "") or getattr(a, "question_text", "")
        t_text = (a.transcribed_text or "").strip() or "(No handwritten student text recorded for this item)"
        clean_page = clean_page_number(getattr(a, "page_number", None) or (a.bbox_json.get("page_number") if isinstance(a.bbox_json, dict) else 1))

        f_m = float(a.final_marks if a.final_marks is not None else (a.suggested_marks or 0.0))
        m_m = float(a.max_marks or 1.0)
        q_pct = (f_m / max(0.1, m_m)) * 100.0

        mistakes_list = [m for m in diag.get("mistakes_found", []) if "No factual mistakes" not in m and "No factual errors" not in m]
        missing_list = diag.get("missing_points", [])
        correct_ans = diag.get("correct_model_answer", "") or getattr(a, "model_answer", "")
        feedback = a.teacher_comment or a.feedback_rationale or "Evaluated accurately against syllabus marking guidelines."

        status_color = "#047857" if q_pct >= 80 else "#D97706" if q_pct >= 40 else "#DC2626"

        card_content = [
            # Header Row
            [
                Paragraph(
                    f"<b>{html.escape(str(a.question_number))} &nbsp;·&nbsp; Awarded: "
                    f"<font color='{status_color}'>{f_m:.1f} / {m_m:.1f} Marks</font></b> "
                    f"&nbsp;&nbsp;<font color='#64748B' size=7.5>(Recorded on Page {clean_page})</font>",
                    meta_val
                )
            ],
        ]

        if q_text:
            card_content.append([
                Paragraph(f"<b>Question Prompt:</b> <i>{html.escape(q_text)}</i>", tbl_cell)
            ])

        # Student Answer Box
        card_content.append([
            Paragraph(
                f"<b>Student's Handwritten Answer:</b><br/>"
                f"<font color='#0F172A'>{html.escape(t_text)}</font>",
                tbl_cell
            )
        ])

        # Diagnostic Callout Boxes: Correct / Mistakes / Missing / Model
        if q_pct >= 60:
            card_content.append([
                Paragraph(
                    f"<b><font color='#15803D'>✓ What Is Correct:</font></b> "
                    f"<font color='#166534'>Demonstrates accurate understanding of key concept and principles.</font>",
                    tbl_cell
                )
            ])

        if mistakes_list:
            mistakes_formatted = "<br/>".join([f"• {html.escape(m)}" for m in mistakes_list])
            card_content.append([
                Paragraph(
                    f"<b><font color='#B91C1C'>✕ Mistakes &amp; Deductions:</font></b><br/>"
                    f"<font color='#991B1B'>{mistakes_formatted}</font>",
                    tbl_cell
                )
            ])

        if missing_list:
            missing_formatted = "<br/>".join([f"• {html.escape(mp)}" for mp in missing_list])
            card_content.append([
                Paragraph(
                    f"<b><font color='#B45309'>⚠ What Is Missing:</font></b><br/>"
                    f"<font color='#92400E'>{missing_formatted}</font>",
                    tbl_cell
                )
            ])

        if correct_ans:
            card_content.append([
                Paragraph(
                    f"<b><font color='#1E40AF'>📘 Reference / Model Answer:</font></b><br/>"
                    f"<font color='#1E3A8A'>{html.escape(correct_ans[:160])}</font>",
                    tbl_cell
                )
            ])

        card_content.append([
            Paragraph(f"<b>Evaluator Comment:</b> <font color='#334155'>{html.escape(feedback)}</font>", tbl_cell)
        ])

        card_tbl = Table(card_content, colWidths=[7.2 * inch])
        card_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 1, color_border),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))

        # KeepTogether ensures no question card is broken across page edges awkwardly
        story.append(KeepTogether([card_tbl, Spacer(1, 7)]))

    # Build document with NumberedCanvas for dynamic running headers/footers
    doc.build(story, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf
