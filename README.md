# SmartEd Evaluation Studio
### Enterprise Academic Evaluation & Handwritten Script Assessment Intelligence

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini 3.1](https://img.shields.io/badge/Vision%20LLM-Gemini%203.1%20Flash--Lite-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![ReportLab](https://img.shields.io/badge/PDF%20Engine-ReportLab%204.x-E11D48)](https://www.reportlab.com/)
[![Theme](https://img.shields.io/badge/Theme-Editorial%20Ivory%20%26%20Botanical%20Forest-141D18)](#-design-system)

---

## 🏛 Executive Overview

**SmartEd Evaluation Studio** is a publication-grade, Human-in-the-Loop (HITL) academic evaluation platform engineered for autonomous colleges, state universities, and higher education institutions. It transforms physical examination answer sheets into an effortless, transparent, point-by-point digital evaluation workflow using **Multimodal Vision LLMs (Gemini 3.1 Flash-Lite / Groq Vision)**, **pypdfium2 high-resolution rendering**, **Question-Paper-Aware Rubric Alignment**, and **ReportLab running ledger PDF generation**, while keeping 100% authority in the educator's hands.

---

## ✨ Key Capabilities & Features

### 1. 📤 Universal Upload & 3D Exam Dossier Ingestion
- **2-Call Batched Multimodal Vision Pipeline**: Processes full 9-page student answer booklets in ~10–15s with zero hardcoded stubs.
- **Realistic 3D Book Page-Turning Visualizer**: Live 3D parchment book overlay with notebook-ruled lines, center spine shadow gradients, flipping leaves, and live stage indicators (`Reading Cover Details` → `Scanning Handwritten Pages` → `Matching Exact Question Marks` → `Preparing Final Report`).
- **Exact Printed Marks Extraction**: Reads exact section multipliers (`1 Marks × 5 = 5m`, `6 Marks × 5 = 30m`, `10 Marks × 2 = 20m`) directly from question paper headers and preserves question-wise marks without generic division.
- **Universal Formats**: Ingests single PDF/JPEG sheets, multi-page booklet PDFs, batch folders, or ZIP archives.

### 2. ⚖️ Continuous Split-View Evaluation Workspace
- **Multi-Page Continuous Vertical Scroll**: Stacks all pages (e.g. Pages 1 to 9) seamlessly with zoom, 90° rotation, and instant page jump controls.
- **Split-View Auto-Sync vs Independent Scroll**:
  - `⇄ Auto-Sync ON`: Clicking or scrolling to any question in the evaluation report smoothly animates the answer sheet to the exact page where the answer appears.
  - `🔓 Independent Scroll`: Panes scroll freely for unconstrained manual auditing.
- **Digital Ink & Marginalia Annotation**: Annotate student scripts in real-time with red pen (`#ef4444`), translucent highlighter, `✓`/`✕` stamps, and persistent margin sticky notes.
- **4-Accordion Diagnostic Breakdown**:
  - 🟢 **What Is Correct**: Formulated concepts and derivations met.
  - 🔴 **Mistakes & Deductions**: Factual errors, incorrect paths, and mark deductions.
  - 🟠 **What Is Missing**: Omitted mandatory criteria and keywords.
  - 📘 **Model Answer**: Official expected formulation and derivation steps.
- **Adjustable Strictness (1–10)**: Real-time slider tuning evaluation tolerance from Lenient (1–3) to Standard (4–7) to Forensic Rigor (8–10).

### 3. 📑 Publication-Grade Official PDF Reports
- **ReportLab 4.x Two-Pass Ledger**: Generates publication-grade, tamper-evident evaluation reports.
- **Deep Botanical Forest (`#141D18`) & Warm Gold (`#D8BE8B`) Header**: Formal institutional banner with dynamic University Name and Department branding.
- **2-Column Student/Exam Summary Card & Score Badge**: Prominent score box, percentage, and color-coded academic grade pill (`Grade A+ Distinction`, `Mastery`, `Passing`, `Needs Attention`).
- **Part-Wise & Question-Wise Summary Table**: Alternating row shading, deduplicated page badges, awarded marks, and diagnostic status.
- **KeepTogether Question Cards**: Clean callout boxes for Student Answer, What Is Correct, Deductions, Missing Points, and Model Solution.
- **Running Ledger Footers**: Two-pass canvas stamping `SmartEd Evaluation Studio · Page X of Y`.

### 4. 📊 Interactive SVG Class Analytics
- **SVG Donut Chart**: Performance benchmark distribution (`🟢 Mastery ≥80%`, `🟠 Partial 40–79%`, `🔴 Needs Work <40%`) with center Class Average % and interactive legend.
- **Vertical Grade Bar Chart**: Animated grade distribution columns (`A+`, `A`, `B`, `C`, `F`) with student counts on top.
- **Horizontal Question Accuracy Bars**: Question-by-question class accuracy (`Q1..QN`) color-coded Green / Amber / Red so teachers instantly spot tough concepts.
- **Multi-Session & Branch Filters**: Filter by `All Sessions`, `Today's Session`, `Previous Sessions`, class, and branch with instant CSV export.

### 5. 🏛 Institutional Admin Console
- **Institution & Report Branding**: Configure University Name, Faculty Division, and Academic Term—automatically applied to all workspaces and exported PDFs.
- **Faculty & Evaluator Roster**: Authorize, manage, or revoke evaluator accounts and permissions.
- **Default Grading Policy**: Set institutional default strictness, passing cutoff (default 40%), and distinction cutoff (default 85%).
- **System Status & Data Operations**: Live backend API connection monitor, database summary CSV export, and cache refresh tools.

### 6. 🌐 Starting Page with Sticky Overlap-Fade & Google OCR Recheck
- **Sticky Stacking Overlap-Fade Scroll**: Editorial sections (`Hero`, `How It Works`, `Capabilities`, `Coming Soon: Google OCR`, `About Us`) stacked with smooth `scale(0.96)` and opacity fade transitions at 60fps.
- **Champagne Gold Coming Soon Section**: Previewing upcoming Google Cloud Vision & Cloud Document OCR dual-pass verification for borderline grade recalculations and rechecking certificates.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18, Vite 5.4 |
| **Styling & Theme** | Tailwind CSS, Cormorant Garamond, Newsreader Serif, Inter |
| **Backend Framework** | FastAPI (Python 3.11 / 3.12), Uvicorn |
| **PDF Rendering** | pypdfium2 (vector JPEG rendering) |
| **PDF Report Engine** | ReportLab 4.x (Two-Pass NumberedCanvas) |
| **Computer Vision** | OpenCV CLAHE contrast enhancement, PIL / Pillow |
| **Multimodal Vision AI** | Gemini 3.1 Flash-Lite, Gemini 3 Flash Preview, Groq Llama-Vision |
| **Database** | SQLite, SQLAlchemy 2.0 ORM |

---

## 🚀 Local Quick Start

### 1. Prerequisites
- Python 3.10+ (Python 3.11 recommended)
- Node.js 18+ & npm

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit backend/.env and add your GEMINI_API_KEY
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Start Full Stack
```bash
# In backend terminal (with venv activated):
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

# In frontend terminal:
npm --prefix frontend run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables

Create `backend/.env` with the following keys:

```env
# Google Gemini Multimodal Vision API (Required for Vision Transcription & Grading)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite

# Groq Vision API (Optional fallback)
GROQ_API_KEY=your_groq_api_key_here
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview

# Application Configuration
DATABASE_URL=sqlite:///./smart_evaluator.db
ENVIRONMENT=development
UPLOAD_DIR=./uploads
```

---

## 🚢 Production Deployment

### Backend (Render / Railway / Fly.io)
1. Deploy `smarted-backend` on **Render** using the included `render.yaml`:
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
2. Set Environment Variables in Render Dashboard:
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `GEMINI_MODEL`: `gemini-3.1-flash-lite`

### Frontend (Vercel / Netlify)
1. Deploy the `frontend/` directory to **Vercel** using the included `frontend/vercel.json`:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. Set Environment Variables in Vercel Dashboard:
   - `VITE_API_BASE_URL`: `https://your-backend-app.onrender.com`

---

## 📄 License & Attribution

Designed and engineered for university educators with **Editorial Ivory & Deep Botanical Forest** aesthetics.
Copyright © 2026 SmartEd Evaluation Studio. Confidential Academic Assessment Platform.
