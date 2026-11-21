import React from 'react';

export default function Dashboard({ submissions, onSelectSubmission }) {
  return (
    <div className="max-w-[1600px] mx-auto p-5">
      <h2 className="text-base font-bold text-white mb-3">Evaluated Student Scripts Cohort</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {submissions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelectSubmission(s.id)}
            className="p-4 rounded-xl bg-[#0E131F] border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-blue-400 font-bold">{s.roll_number}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s.status.toUpperCase()}
              </span>
            </div>
            <div className="font-bold text-sm text-white mb-1">{s.student_name}</div>
            <div className="font-mono text-lg font-bold text-emerald-400">
              {s.total_final_marks} / {s.max_marks}m
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
