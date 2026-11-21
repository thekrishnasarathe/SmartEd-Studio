import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Eye, Stamp } from 'lucide-react';

export default function SheetViewer({
  submission,
  activeQuestion,
  onSelectQuestion,
  onAddStamp,
}) {
  const [zoom, setZoom] = useState(1.0);
  const [filterMode, setFilterMode] = useState('original'); // original | clahe | binary
  const [activeStampTool, setActiveStampTool] = useState(null);

  if (!submission) return null;

  const imgUrl =
    filterMode === 'clahe'
      ? submission.enhanced_image_url || submission.original_image_url
      : filterMode === 'binary'
      ? submission.binary_image_url || submission.original_image_url
      : submission.original_image_url;

  const handleCanvasClick = (e) => {
    if (!activeStampTool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x_pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y_pct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onAddStamp({
      id: `st_${Date.now()}`,
      x_pct,
      y_pct,
      label: activeStampTool.label,
      color: activeStampTool.color,
    });
    setActiveStampTool(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#090D16] border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#0E131F] border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          {['original', 'clahe', 'binary'].map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide ${
                filterMode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'original' ? 'Original Scan' : m === 'clahe' ? 'Enhanced Contrast' : 'Clean Ink'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs text-slate-300 px-1.5">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.15).toFixed(2)))}
            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto p-4 flex justify-center">
        <div
          onClick={handleCanvasClick}
          style={{ width: `${Math.round(zoom * 100)}%` }}
          className="relative select-none rounded-lg overflow-hidden shadow-2xl border border-slate-700"
        >
          <img
            src={imgUrl}
            alt="Scanned Student Answer Sheet"
            className="w-full h-auto block"
          />

          {(submission.answers || []).map((ans) => {
            const b = ans.bbox_json || { x_pct: 11, y_pct: 15, w_pct: 84, h_pct: 18 };
            const isSelected = activeQuestion === ans.question_number;
            return (
              <div
                key={ans.question_number}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectQuestion(ans.question_number);
                }}
                style={{
                  left: `${b.x_pct}%`,
                  top: `${b.y_pct}%`,
                  width: `${b.w_pct}%`,
                  height: `${b.h_pct}%`,
                }}
                className={`absolute rounded-md cursor-pointer transition-all ${
                  isSelected
                    ? 'border-2 border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : ans.needs_manual_review && !ans.is_verified
                    ? 'border border-dashed border-rose-500/80 bg-rose-500/5'
                    : 'border border-transparent hover:border-slate-500/50'
                }`}
              >
                <span className="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900/90 text-blue-300 border border-blue-500/40">
                  {ans.question_number} • {ans.final_marks}/{ans.max_marks}m
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
