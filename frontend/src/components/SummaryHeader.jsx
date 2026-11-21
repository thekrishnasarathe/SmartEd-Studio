import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Download, FileText } from 'lucide-react';

export default function SummaryHeader({
  submission,
  submissions,
  onSelectSubmission,
  onApproveAll,
  onExportCSV,
  onExportPDF,
}) {
  if (!submission) return null;
  const pct = submission.max_marks > 0 ? ((submission.total_final_marks / submission.max_marks) * 100).toFixed(1) : '0.0';

  return (
    <div className="border-b border-slate-800/80 bg-[#0B0F19] px-5 py-3">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={submission.id}
            onChange={(e) => onSelectSubmission(Number(e.target.value))}
            className="bg-[#0E131F] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
          >
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.roll_number} — {s.student_name} ({s.total_final_marks}/{s.max_marks}m • {s.status.toUpperCase()})
              </option>
            ))}
          </select>

          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
            QR: {submission.booklet_qr_code}
          </span>

          <span
            className={`text-xs font-mono px-2.5 py-1 rounded border ${
              submission.avg_ocr_confidence >= 0.85
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            Handwriting Clarity: {(submission.avg_ocr_confidence * 100).toFixed(0)}%
          </span>

          {submission.needs_manual_review_count > 0 ? (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              {submission.needs_manual_review_count} Question Flagged for Teacher Review
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Questions Verified ({submission.verified_question_count}/{submission.total_question_count})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Final Verified Score</div>
            <div className="font-mono text-lg font-bold text-white">
              {submission.total_final_marks.toFixed(1)}{' '}
              <span className="text-slate-400 text-xs">/ {submission.max_marks} ({pct}%)</span>
            </div>
          </div>

          <button
            onClick={() => onApproveAll(submission.id)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
          >
            Approve Entire Script
          </button>

          <button
            onClick={onExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={onExportPDF}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs text-blue-300"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Scorecard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
