import React from 'react';
import { Cpu, Key, Command, Layers, CheckCircle2, FileSpreadsheet, Sparkles } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  activeProvider,
  onOpenCredentials,
  onOpenExamSetup,
  onOpenCommandPalette,
}) {
  const tabs = [
    { id: 'workspace', label: '1. Split-Screen HITL Verifier' },
    { id: 'groups', label: '2. AI Answer Groups (Gradescope Mode)' },
    { id: 'rubric', label: '3. Dynamic Retroactive Rubric Studio' },
    { id: 'analytics', label: '4. Cohort Analytics & Plagiarism Hub' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#07090E]/90 backdrop-blur-xl px-5 py-3">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">AstraGrade</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                v3.0 HITL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI-Assisted Handwritten Answer Sheet Evaluation &amp; Teacher Verification
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-[#0E131F] p-1 rounded-lg border border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0E131F] border border-slate-800 text-xs text-slate-300 hover:border-slate-700"
          >
            <Command className="w-3.5 h-3.5 text-slate-400" />
            <span>Quick Jump</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl+K</kbd>
          </button>

          <button
            onClick={onOpenExamSetup}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200"
          >
            + Upload Sheet / Exam
          </button>

          <button
            onClick={onOpenCredentials}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300"
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys ({activeProvider})</span>
          </button>
        </div>
      </div>
    </header>
  );
}
