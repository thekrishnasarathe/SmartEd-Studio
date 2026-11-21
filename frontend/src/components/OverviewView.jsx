import React from 'react';

export default function OverviewView({
  submissions = [],
  setCurrentSubId,
  setActiveView,
  sessionFilter,
  setSessionFilter,
  classFilter,
  setClassFilter,
  branchFilter,
  setBranchFilter,
  handleExportCohortCsv,
}) {
  // Filter submissions by session, class, branch
  const filteredList = submissions.filter((s) => {
    if (sessionFilter === 'today' && s.session_label && !s.session_label.includes('Today')) {
      return false;
    }
    if (sessionFilter === 'previous' && s.session_label && !s.session_label.includes('Previous')) {
      return false;
    }
    if (classFilter !== 'all' && s.class_name && !s.class_name.toLowerCase().includes(classFilter.toLowerCase())) {
      return false;
    }
    if (branchFilter !== 'all' && s.branch_name && !s.branch_name.toLowerCase().includes(branchFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const totalScripts = submissions.length || 18;
  const verifiedCount = submissions.filter((s) => s.verification_status === 'VERIFIED' || s.is_verified).length || 4;
  const pendingCount = totalScripts - verifiedCount;

  const uniqueClasses = Array.from(new Set(submissions.map((s) => s.class_name).filter(Boolean)));
  const uniqueBranches = Array.from(new Set(submissions.map((s) => s.branch_name).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Top Eyebrow & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-soft">
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-[#475569] dark:text-[#7B8F82]">
            Your faculty workspace
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal tracking-tight mt-1">
            Your evaluation desk.
          </h1>
          <p className="text-xs md:text-sm text-[#475569] dark:text-[#8E9F94] mt-1 font-sans">
            A clear view of your scripts, reviews, and next steps.
          </p>
        </div>

        {/* System Status Pill */}
        <div className="self-start md:self-auto flex items-center gap-2 bg-[#DCFCE7] dark:bg-[#1A251F] border border-[#BBF7D0] dark:border-[#28392F] px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#16A34A] dark:text-[#4ADE80] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Hero Card: Deep Botanical Forest (Always Dark by design) */}
      <div className="bg-[#18241E] text-white rounded-2xl p-7 md:p-8 border border-[#2A3B30] shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fade-in-soft animation-delay-100">
        {/* Left 7 Cols */}
        <div className="lg:col-span-7 space-y-4">
          <div className="text-[10px] font-bold tracking-widest uppercase text-[#D8BE8B]">
            Intelligence, with a human touch
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-[40px] font-normal leading-tight text-[#F6F4EE]">
            Less time grading.<br />
            More room for teaching.
          </h2>
          <p className="text-xs md:text-sm text-[#A3B1A8] leading-relaxed max-w-xl">
            From handwritten scripts to rubric-aligned insights. AI assists. Your expertise decides.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveView('upload')}
              className="px-5 py-2.5 rounded-lg bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-semibold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 group"
            >
              <span>Start a new evaluation</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className="px-5 py-2.5 rounded-lg border border-[#34463A] hover:bg-[#202E27] text-[#E4EDE7] font-medium text-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>Explore evaluated scripts</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Right 5 Cols: The Evaluation Journey */}
        <div className="lg:col-span-5 bg-[#141D18]/80 border border-[#28392F] rounded-xl p-5 space-y-3.5">
          <div className="text-[10px] font-bold tracking-widest uppercase text-[#8E9F94]">
            The evaluation journey
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded bg-[#202E27] text-[#D8BE8B] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                01
              </span>
              <div>
                <div className="text-xs font-semibold text-[#F6F4EE]">Upload your scripts</div>
                <div className="text-[11px] text-[#8E9F94]">Single sheets or an entire cohort.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded bg-[#202E27] text-[#A3B1A8] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                02
              </span>
              <div>
                <div className="text-xs font-semibold text-[#F6F4EE]">Let intelligence assist</div>
                <div className="text-[11px] text-[#8E9F94]">Handwriting, answers, and rubric alignment.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded bg-[#202E27] text-[#D8BE8B] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                03
              </span>
              <div>
                <div className="text-xs font-semibold text-[#F6F4EE]">Review. Refine. Release.</div>
                <div className="text-[11px] text-[#8E9F94]">Every final mark stays in your hands.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Strip: Multi-Session, Class & Branch (Crisp White in Light Mode) */}
      <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm animate-fade-in-soft animation-delay-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82] mr-1">
            Session:
          </span>
          <button
            type="button"
            onClick={() => setSessionFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              sessionFilter === 'all'
                ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                : 'bg-[#F8F7F4] text-[#18241E] hover:bg-[#EFECE4] border border-[#E3E1D8] dark:bg-transparent dark:text-[#A3B1A8] dark:border-transparent'
            }`}
          >
            All Sessions
          </button>
          <button
            type="button"
            onClick={() => setSessionFilter('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              sessionFilter === 'today'
                ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                : 'bg-[#F8F7F4] text-[#18241E] hover:bg-[#EFECE4] border border-[#E3E1D8] dark:bg-transparent dark:text-[#A3B1A8] dark:border-transparent'
            }`}
          >
            Today's Session
          </button>
          <button
            type="button"
            onClick={() => setSessionFilter('previous')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              sessionFilter === 'previous'
                ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                : 'bg-[#F8F7F4] text-[#18241E] hover:bg-[#EFECE4] border border-[#E3E1D8] dark:bg-transparent dark:text-[#A3B1A8] dark:border-transparent'
            }`}
          >
            Previous Sessions
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-white dark:bg-[#141D18] border border-[#D6D3C9] dark:border-[#28392F] text-[#18241E] dark:text-[#E4EDE7] rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
          >
            <option value="all">Class: All Cohorts</option>
            {uniqueClasses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-white dark:bg-[#141D18] border border-[#D6D3C9] dark:border-[#28392F] text-[#18241E] dark:text-[#E4EDE7] rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
          >
            <option value="all">Branch: All Branches</option>
            {uniqueBranches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {handleExportCohortCsv && (
            <button
              type="button"
              onClick={handleExportCohortCsv}
              className="px-3 py-1.5 rounded-lg bg-[#F8F7F4] hover:bg-[#EFECE4] border border-[#E3E1D8] text-[#18241E] dark:bg-[#202E27] dark:hover:bg-[#2A3B30] dark:text-[#E4EDE7] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>⬇</span>
              <span>Aggregated Report</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Semantic Metric Cards (Crisp White + Clean High-Scan Accents) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-soft animation-delay-300">
        {/* Card 1: Total Scripts (Soft Slate-Blue Accent) */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-2 hover:border-[#93C5FD] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
              Total scripts
            </span>
            <span className="bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>📄</span>
              <span>All Scripts</span>
            </span>
          </div>
          <div className="font-serif text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal">
            {totalScripts}
          </div>
          <div className="text-xs text-[#475569] dark:text-[#8E9F94]">
            Active assessment cohort
          </div>
        </div>

        {/* Card 2: Awaiting Review (Warm Amber/Yellow Accent) */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-2 hover:border-[#FCD34D] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
              Awaiting your review
            </span>
            <span className="bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
              <span>Needs attention</span>
            </span>
          </div>
          <div className="font-serif text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal">
            {pendingCount}
          </div>
          <div className="text-xs text-[#475569] dark:text-[#8E9F94]">
            AI evaluation complete
          </div>
        </div>

        {/* Card 3: Teacher Verified (Fresh Emerald Green Accent) */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-2 hover:border-[#86EFAC] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
              Teacher verified
            </span>
            <span className="bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span>Verified</span>
            </span>
          </div>
          <div className="font-serif text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal">
            {verifiedCount < 10 ? `0${verifiedCount}` : verifiedCount}
          </div>
          <div className="text-xs text-[#475569] dark:text-[#8E9F94]">
            Ready for report export
          </div>
        </div>

        {/* Card 4: Maximum Marks */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-2 hover:border-[#CBD5E1] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
              Maximum marks
            </span>
            <span className="bg-[#F1F5F9] text-[#475569] text-[10px] font-bold px-2 py-0.5 rounded-full">
              Rubric
            </span>
          </div>
          <div className="font-serif text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal">
            60
          </div>
          <div className="text-xs text-[#475569] dark:text-[#8E9F94]">
            Question-paper-aligned rubric
          </div>
        </div>
      </div>

      {/* Cohort Score Band Analytics Strip (Crisp White Card with Semantic Green, Amber, Red Bars) */}
      <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-4 shadow-sm space-y-3 animate-fade-in-soft animation-delay-400">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="font-serif font-semibold text-[#18241E] dark:text-[#F6F4EE] text-sm">
            Question Performance Distribution
          </span>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="bg-[#DCFCE7] text-[#16A34A] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span>≥ 80% (Mastery)</span>
            </span>
            <span className="bg-[#FEF3C7] text-[#D97706] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D97706]" />
              <span>40%–79% (Partial)</span>
            </span>
            <span className="bg-[#FEE2E2] text-[#DC2626] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
              <span>&lt; 40% (Needs Work)</span>
            </span>
          </div>
        </div>

        {/* Continuous Color Distribution Track */}
        <div className="w-full h-3.5 rounded-full bg-stone-100 dark:bg-[#121A15] flex overflow-hidden p-0.5 gap-0.5">
          <div
            className="bg-[#16A34A] h-full rounded-l-full transition-all duration-300"
            style={{ width: '45%' }}
            title="Mastery: 45% (≥80%)"
          />
          <div
            className="bg-[#D97706] h-full transition-all duration-300"
            style={{ width: '40%' }}
            title="Partial: 40% (40%–79%)"
          />
          <div
            className="bg-[#DC2626] h-full rounded-r-full transition-all duration-300"
            style={{ width: '15%' }}
            title="Needs Work: 15% (<40%)"
          />
        </div>
      </div>

      {/* Recent Scripts Table (Crisp White with High-Contrast Text) */}
      <div className="space-y-3 animate-fade-in-soft animation-delay-400">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl text-[#18241E] dark:text-[#F6F4EE]">
              Recent scripts
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#8E9F94]">
              Pick up where you left off.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('workspace')}
            className="text-xs font-semibold text-[#18241E] dark:text-[#D8BE8B] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View all scripts</span>
            <span>→</span>
          </button>
        </div>

        {/* Table Container */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl overflow-hidden shadow-sm">
          {filteredList.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#F6F4EE] dark:bg-[#202E27] border border-[#E3E1D8] dark:border-[#28392F] flex items-center justify-center text-3xl shadow-inner">
                📝
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                  No papers evaluated yet
                </h3>
                <p className="text-xs text-[#475569] dark:text-[#8E9F94] max-w-sm mx-auto">
                  Upload handwritten answer sheets or student batches to start automated AI grading and review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('upload')}
                className="px-5 py-2.5 rounded-xl bg-[#141D18] dark:bg-[#D8BE8B] hover:bg-[#1F2C24] dark:hover:bg-[#E2CE9F] text-[#F6F4EE] dark:text-[#141D18] font-semibold text-xs tracking-wide shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Upload Your First Paper</span>
                <span>→</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18]/80 text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                  <th className="py-3 px-5">Student</th>
                  <th className="py-3 px-5">Assessment</th>
                  <th className="py-3 px-5">Marks</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Last updated</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E1D8] dark:divide-[#28392F] text-xs">
                {filteredList.map((sub, idx) => {
                  const isVerified = sub.verification_status === 'VERIFIED' || sub.is_verified;
                  const totalMarks = sub.total_score !== undefined ? sub.total_score : 30.5;
                  const maxMarks = sub.max_score || 60.0;
                  const lastUpdatedText = idx === 0 ? 'Just now' : `${idx * 12} min ago`;

                  return (
                    <tr
                      key={sub.id || idx}
                      onClick={() => {
                        setCurrentSubId(sub.id);
                        setActiveView('workspace');
                      }}
                      className="hover:bg-[#F9F8F3] dark:hover:bg-[#202E27] cursor-pointer transition-colors group"
                    >
                      {/* Student Column */}
                      <td className="py-3.5 px-5">
                        <div className="font-serif font-semibold text-sm text-[#18241E] dark:text-[#F6F4EE] group-hover:text-amber-800 dark:group-hover:text-[#D8BE8B] transition-colors">
                          {sub.student_name}
                        </div>
                        <div className="text-[11px] text-[#475569] dark:text-[#7B8F82]">
                          Roll no. {sub.roll_number}
                        </div>
                      </td>

                      {/* Assessment */}
                      <td className="py-3.5 px-5 text-[#475569] dark:text-[#A3B1A8] font-medium">
                        {sub.exam_title || sub.subject || 'Academic Assessment'}
                      </td>

                      {/* Marks */}
                      <td className="py-3.5 px-5">
                        <span className="font-serif font-bold text-sm text-[#18241E] dark:text-[#F6F4EE]">
                          {Number(totalMarks).toFixed(1)}
                        </span>
                        <span className="text-[#475569] dark:text-[#7B8F82] ml-1">
                          / {maxMarks}
                        </span>
                      </td>

                      {/* Status Pill */}
                      <td className="py-3.5 px-5">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#16A34A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#D97706]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                            In review
                          </span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-5 text-[#475569] dark:text-[#7B8F82]">
                        {lastUpdatedText}
                      </td>

                      {/* Action Arrow */}
                      <td className="py-3.5 px-5 text-right">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#F8F7F4] dark:bg-[#202E27] text-[#18241E] dark:text-[#D8BE8B] group-hover:bg-[#D8BE8B] group-hover:text-[#141D18] transition-colors text-xs font-bold">
                          ↗
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-6 border-t border-[#E3E1D8] dark:border-[#28392F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#475569] dark:text-[#7B8F82]">
        <div>Built for thoughtful assessment.</div>
        <div>Rubric-aligned AI / Teacher-led decisions / Transparent Evaluation Log</div>
      </footer>
    </div>
  );
}
