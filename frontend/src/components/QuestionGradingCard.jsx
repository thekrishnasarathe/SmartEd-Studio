import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Plus, Minus } from 'lucide-react';

export default function QuestionGradingCard({
  answer,
  isSelected,
  onSelect,
  onUpdateAnswer,
}) {
  const [transcript, setTranscript] = useState(answer.transcribed_text);
  const [comment, setComment] = useState(answer.teacher_comment || '');

  const handleStepToggle = (idx) => {
    const updatedSteps = (answer.step_checks || []).map((s, i) => {
      if (i !== idx) return s;
      const nextMet = !s.met;
      return {
        ...s,
        met: nextMet,
        awarded_marks: nextMet ? s.max_marks : 0,
      };
    });
    const newMarks = updatedSteps.reduce((acc, s) => acc + (s.met ? Number(s.awarded_marks) : 0), 0);
    onUpdateAnswer(answer.id, {
      step_checks: updatedSteps,
      final_marks: Math.round(newMarks * 2) / 2,
    });
  };

  return (
    <div
      onClick={() => onSelect(answer.question_number)}
      className={`rounded-xl p-4 border transition-all cursor-pointer ${
        answer.is_verified
          ? 'bg-[#0E161B] border-emerald-500/50'
          : answer.needs_manual_review
          ? 'bg-[#171118] border-rose-500/60'
          : isSelected
          ? 'bg-[#111827] border-blue-500/70'
          : 'bg-[#0E131F] border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {answer.question_number} (Max {answer.max_marks}m)
          </span>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              answer.ocr_confidence < 0.75
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}
          >
            Clarity {(answer.ocr_confidence * 100).toFixed(0)}%
          </span>
          {answer.needs_manual_review && !answer.is_verified && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <AlertTriangle className="w-3 h-3" />
              Needs Teacher Attention
            </span>
          )}
        </div>

        <div className="font-mono text-sm font-bold text-white">
          AI Suggested: <span className="text-blue-400">{answer.suggested_marks}</span> / {answer.max_marks}
        </div>
      </div>

      <p className="text-xs text-slate-300 font-medium mb-2">{answer.question_text}</p>

      {/* Editable OCR Transcript */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Extracted Handwritten Transcript (Editable)</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateAnswer(answer.id, { transcribed_text: transcript, re_evaluate_ai: true });
            }}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Re-evaluate 3-Layer AI</span>
          </button>
        </div>
        <textarea
          rows={2}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          className="w-full rounded-lg bg-[#07090E] border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 3-Layer Formula Breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center bg-[#07090E] p-2 rounded-lg border border-slate-800/80">
        <div>
          <div className="text-[10px] text-slate-400">Keyword (20%)</div>
          <div className="font-mono text-xs font-bold text-emerald-400">
            {(answer.keyword_score * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Semantic (30%)</div>
          <div className="font-mono text-xs font-bold text-blue-400">
            {(answer.semantic_score * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Step Rubric (50%)</div>
          <div className="font-mono text-xs font-bold text-purple-400">
            {answer.llm_rubric_score}/{answer.max_marks}m
          </div>
        </div>
      </div>

      {/* Step-by-Step Rubric Checkboxes */}
      <div className="space-y-1.5 mb-3">
        {(answer.step_checks || []).map((step, idx) => (
          <label
            key={step.step_id || idx}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#07090E]/80 border border-slate-800 text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(step.met)}
                onChange={() => handleStepToggle(idx)}
                className="rounded border-slate-600 text-blue-600"
              />
              <span className={step.met ? 'text-slate-200' : 'text-slate-500 line-through'}>
                {step.label}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {step.awarded_marks}/{step.max_marks}m
            </span>
          </label>
        ))}
      </div>

      {/* Teacher Verification Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() =>
              onUpdateAnswer(answer.id, {
                final_marks: Math.max(0, +(answer.final_marks - 0.5).toFixed(1)),
              })
            }
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
          >
            -0.5
          </button>
          <input
            type="number"
            step="0.5"
            min="0"
            max={answer.max_marks}
            value={answer.final_marks}
            onChange={(e) =>
              onUpdateAnswer(answer.id, { final_marks: Number(e.target.value) })
            }
            className="w-16 text-center font-mono text-xs font-bold rounded bg-[#07090E] border border-slate-700 py-1 text-white"
          />
          <button
            onClick={() =>
              onUpdateAnswer(answer.id, {
                final_marks: Math.min(answer.max_marks, +(answer.final_marks + 0.5).toFixed(1)),
              })
            }
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
          >
            +0.5
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdateAnswer(answer.id, {
              is_verified: !answer.is_verified,
              teacher_comment: comment,
            });
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            answer.is_verified
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{answer.is_verified ? 'Verified & Locked' : 'Approve & Verify'}</span>
        </button>
      </div>
    </div>
  );
}
