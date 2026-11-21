import React, { useState, useMemo } from 'react';

export default function CohortInsightsView({
  submissions = [],
  setCurrentSubId,
  setActiveView,
  handleExportCohortCsv,
}) {
  const [selectedSession, setSelectedSession] = useState('all'); // 'all' | 'today' | 'previous'
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique classes and branches
  const classOptions = useMemo(() => {
    const set = new Set();
    submissions.forEach((s) => {
      if (s.class_name) set.add(s.class_name);
    });
    return Array.from(set);
  }, [submissions]);

  const branchOptions = useMemo(() => {
    const set = new Set();
    submissions.forEach((s) => {
      if (s.branch_name) set.add(s.branch_name);
    });
    return Array.from(set);
  }, [submissions]);

  // Compute student stats
  const processedStudents = useMemo(() => {
    return submissions.map((s) => {
      const answers = s.answers || [];
      const totalAwarded = answers.reduce(
        (acc, a) => acc + (Number(a.final_marks ?? a.suggested_marks) || 0),
        0
      );
      const totalMax = answers.reduce(
        (acc, a) => acc + (Number(a.max_marks) || 0),
        0
      ) || Number(s.max_marks) || 60;

      const pct = totalMax > 0 ? (totalAwarded / totalMax) * 100 : 0;

      let grade = 'Needs Improvement';
      let gradeColor = 'text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50';
      if (pct >= 80) {
        grade = 'Grade A (Mastery)';
        gradeColor = 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
      } else if (pct >= 65) {
        grade = 'Grade B (Proficient)';
        gradeColor = 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
      } else if (pct >= 40) {
        grade = 'Grade C (Passing)';
        gradeColor = 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
      }

      const verifiedCount = answers.filter((a) => a.is_verified).length;
      const isFullyVerified = answers.length > 0 && verifiedCount === answers.length;

      // Handwriting clarity
      const avgClarity = answers.length > 0
        ? Math.round((answers.reduce((acc, a) => acc + (Number(a.ocr_confidence) || 0.88), 0) / answers.length) * 100)
        : Math.round((Number(s.avg_ocr_confidence) || 0.88) * 100);

      return {
        ...s,
        totalAwarded: Math.round(totalAwarded * 10) / 10,
        totalMax: Math.round(totalMax * 10) / 10,
        pct: Math.round(pct * 10) / 10,
        grade,
        gradeColor,
        isFullyVerified,
        verifiedCount,
        totalAnswers: answers.length,
        avgClarity,
      };
    });
  }, [submissions]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return processedStudents.filter((s) => {
      // Session filter
      if (selectedSession === 'today') {
        const sLabel = (s.session_label || '').toLowerCase();
        if (!sLabel.includes('today')) return false;
      } else if (selectedSession === 'previous') {
        const sLabel = (s.session_label || '').toLowerCase();
        if (sLabel.includes('today')) return false;
      }

      // Class filter
      if (selectedClass !== 'all' && s.class_name !== selectedClass) {
        return false;
      }

      // Branch filter
      if (selectedBranch !== 'all' && s.branch_name !== selectedBranch) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (s.student_name || '').toLowerCase().includes(q);
        const matchesRoll = (s.roll_number || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRoll) return false;
      }

      return true;
    });
  }, [processedStudents, selectedSession, selectedClass, selectedBranch, searchQuery]);

  // Sorted by score descending for leaderboard
  const rankedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => b.totalAwarded - a.totalAwarded);
  }, [filteredStudents]);

  // Class aggregates
  const stats = useMemo(() => {
    const totalCount = filteredStudents.length;
    if (totalCount === 0) {
      return {
        avgPct: 0,
        avgAwarded: 0,
        avgMax: 60,
        passRate: 0,
        highestScore: 0,
        highestStudent: 'None',
        evaluatedCount: 0,
        masteryCount: 0,
        partialCount: 0,
        needsWorkCount: 0,
        gradeACount: 0,
        gradeBCount: 0,
        gradeCCount: 0,
        gradeDCount: 0,
      };
    }

    const sumAwarded = filteredStudents.reduce((acc, s) => acc + s.totalAwarded, 0);
    const sumMax = filteredStudents.reduce((acc, s) => acc + s.totalMax, 0);
    const sumPct = filteredStudents.reduce((acc, s) => acc + s.pct, 0);

    const avgAwarded = Math.round((sumAwarded / totalCount) * 10) / 10;
    const avgMax = Math.round((sumMax / totalCount) * 10) / 10;
    const avgPct = Math.round((sumPct / totalCount) * 10) / 10;

    const passCount = filteredStudents.filter((s) => s.pct >= 40).length;
    const passRate = Math.round((passCount / totalCount) * 100);

    const highestStudent = [...filteredStudents].sort((a, b) => b.totalAwarded - a.totalAwarded)[0];

    const evaluatedCount = filteredStudents.filter((s) => s.isFullyVerified || s.status === 'verified').length;

    // Bands: Green >= 80%, Amber 40-79%, Red < 40%
    const masteryCount = filteredStudents.filter((s) => s.pct >= 80).length;
    const partialCount = filteredStudents.filter((s) => s.pct >= 40 && s.pct < 80).length;
    const needsWorkCount = filteredStudents.filter((s) => s.pct < 40).length;

    // Grades
    const gradeACount = filteredStudents.filter((s) => s.pct >= 80).length;
    const gradeBCount = filteredStudents.filter((s) => s.pct >= 65 && s.pct < 80).length;
    const gradeCCount = filteredStudents.filter((s) => s.pct >= 40 && s.pct < 65).length;
    const gradeDCount = filteredStudents.filter((s) => s.pct < 40).length;

    return {
      avgPct,
      avgAwarded,
      avgMax,
      passRate,
      highestScore: highestStudent ? highestStudent.totalAwarded : 0,
      highestMax: highestStudent ? highestStudent.totalMax : 60,
      highestStudent: highestStudent ? highestStudent.student_name : 'None',
      evaluatedCount,
      masteryCount,
      partialCount,
      needsWorkCount,
      gradeACount,
      gradeBCount,
      gradeCCount,
      gradeDCount,
    };
  }, [filteredStudents]);

  // Question-by-question class accuracy
  const questionAccuracy = useMemo(() => {
    if (filteredStudents.length === 0) return [];
    const qMap = {};

    filteredStudents.forEach((s) => {
      (s.answers || []).forEach((a) => {
        const qNum = a.question_number || 'Question';
        if (!qMap[qNum]) {
          qMap[qNum] = {
            question_number: qNum,
            question_text: a.question_text || '',
            max_marks: Number(a.max_marks) || 5,
            totalAwarded: 0,
            count: 0,
          };
        }
        qMap[qNum].totalAwarded += Number(a.final_marks ?? a.suggested_marks) || 0;
        qMap[qNum].count += 1;
      });
    });

    return Object.values(qMap).map((q) => {
      const avgScore = q.count > 0 ? q.totalAwarded / q.count : 0;
      const pct = q.max_marks > 0 ? (avgScore / q.max_marks) * 100 : 0;
      return {
        ...q,
        avgScore: Math.round(avgScore * 10) / 10,
        accuracyPct: Math.round(pct),
      };
    });
  }, [filteredStudents]);

  // CSV Export
  const downloadCsv = () => {
    if (handleExportCohortCsv) {
      handleExportCohortCsv();
      return;
    }

    const headers = [
      'Rank',
      'Student Name',
      'Roll Number',
      'Class',
      'Branch',
      'Session',
      'Awarded Marks',
      'Max Marks',
      'Percentage',
      'Grade',
      'Handwriting Clarity',
      'Status',
    ];

    const rows = rankedStudents.map((s, idx) => [
      idx + 1,
      `"${s.student_name}"`,
      `"${s.roll_number}"`,
      `"${s.class_name || ''}"`,
      `"${s.branch_name || ''}"`,
      `"${s.session_label || ''}"`,
      s.totalAwarded,
      s.totalMax,
      `${s.pct}%`,
      `"${s.grade}"`,
      `${s.avgClarity}%`,
      s.isFullyVerified ? 'Verified' : 'In Progress',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartEd_Class_Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1400px] mx-auto pb-16">
      {/* ========================================================= */}
      {/* HEADER & TOP CONTROLS                                     */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E3E1D8] dark:border-[#233129] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#7B8F82] bg-[#EBF0EC] dark:bg-[#1A251F] px-2.5 py-0.5 rounded-full border border-[#D5E1D8] dark:border-[#28392F]">
              Performance Intelligence
            </span>
            <span className="text-xs text-stone-400 dark:text-[#7B8F82]">· Faculty Evaluation Studio</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-normal text-[#18241E] dark:text-[#F6F4EE] mt-1.5">
            Class Analytics
          </h1>
          <p className="text-xs text-stone-600 dark:text-[#8E9F94] mt-1">
            Real-time cohort score distributions, question-by-question mastery breakdown, and student achievement leaderboard.
          </p>
        </div>

        {/* Action Button: Export CSV */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={downloadCsv}
            className="px-4 py-2.5 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <span>📥</span>
            <span>Download Class Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MULTI-SESSION & FILTER STRIP                             */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#18241E] p-4 rounded-xl border border-[#E3E1D8] dark:border-[#28392F] shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Session Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F6F4EE] dark:bg-[#141D18] rounded-xl border border-[#E3E1D8] dark:border-[#28392F]">
          <button
            type="button"
            onClick={() => setSelectedSession('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedSession === 'all'
                ? 'bg-[#18241E] dark:bg-[#D8BE8B] text-[#F6F4EE] dark:text-[#141D18] shadow-sm'
                : 'text-stone-600 dark:text-[#8E9F94] hover:text-[#18241E] dark:hover:text-white'
            }`}
          >
            All Sessions ({processedStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedSession('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedSession === 'today'
                ? 'bg-[#18241E] dark:bg-[#D8BE8B] text-[#F6F4EE] dark:text-[#141D18] shadow-sm'
                : 'text-stone-600 dark:text-[#8E9F94] hover:text-[#18241E] dark:hover:text-white'
            }`}
          >
            Today's Session
          </button>
          <button
            type="button"
            onClick={() => setSelectedSession('previous')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedSession === 'previous'
                ? 'bg-[#18241E] dark:bg-[#D8BE8B] text-[#F6F4EE] dark:text-[#141D18] shadow-sm'
                : 'text-stone-600 dark:text-[#8E9F94] hover:text-[#18241E] dark:hover:text-white'
            }`}
          >
            Previous Sessions
          </button>
        </div>

        {/* Dropdowns & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Dropdown */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs bg-[#F6F4EE] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] text-[#18241E] dark:text-[#F6F4EE] rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-[#D8BE8B]"
          >
            <option value="all">All Classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Branch Dropdown */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-xs bg-[#F6F4EE] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] text-[#18241E] dark:text-[#F6F4EE] rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-[#D8BE8B]"
          >
            <option value="all">All Branches</option>
            {branchOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Student Search */}
          <input
            type="text"
            placeholder="Search student or roll..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs bg-[#F6F4EE] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] text-[#18241E] dark:text-[#F6F4EE] rounded-lg px-3 py-2 focus:outline-none focus:border-[#D8BE8B] w-48"
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4 SUMMARY METRIC CARDS                                    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Class Average */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
            <span>Class Average</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono">Mean</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
              {stats.avgPct}%
            </span>
            <span className="text-xs text-stone-500 dark:text-[#8E9F94] font-mono">
              ({stats.avgAwarded} / {stats.avgMax}m)
            </span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-[#8E9F94]">
            Mean performance across {filteredStudents.length} evaluated student papers.
          </p>
        </div>

        {/* Metric 2: Pass Rate */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
            <span>Pass Rate</span>
            <span className="text-xs">🎯 Target: 80%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-[#16A34A] dark:text-[#4ADE80]">
              {stats.passRate}%
            </span>
            <span className="text-xs text-stone-500 dark:text-[#8E9F94]">
              (≥40% cutoff)
            </span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-[#8E9F94]">
            {filteredStudents.filter((s) => s.pct >= 40).length} of {filteredStudents.length} students achieved passing standard.
          </p>
        </div>

        {/* Metric 3: Highest Score */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
            <span>Highest Score</span>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">
              Top Scorer
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-[#D8BE8B]">
              {stats.highestScore}
            </span>
            <span className="text-xs text-stone-500 dark:text-[#8E9F94] font-mono">
              / {stats.highestMax}m
            </span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-[#8E9F94] truncate">
            {stats.highestStudent}
          </p>
        </div>

        {/* Metric 4: Papers Checked */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
            <span>Papers Checked</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.evaluatedCount} / {filteredStudents.length}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
              {filteredStudents.length > 0 ? Math.round((stats.evaluatedCount / filteredStudents.length) * 100) : 0}%
            </span>
            <span className="text-xs text-stone-500 dark:text-[#8E9F94]">
              completed
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-stone-200 dark:bg-[#111814] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#D8BE8B] h-full rounded-full transition-all duration-300"
              style={{
                width: `${filteredStudents.length > 0 ? (stats.evaluatedCount / filteredStudents.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PERFORMANCE VISUAL CHARTS (DONUT + VERTICAL GRADE BARS)    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (6 cols): Interactive SVG Donut Chart (Mastery / Partial / Needs Work) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#18241E] p-6 rounded-2xl border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
                Performance Benchmark Breakdown
              </h3>
              <p className="text-xs text-stone-500 dark:text-[#8E9F94]">
                Proportional mastery distribution across evaluated cohort.
              </p>
            </div>
            <span className="text-xs font-mono text-stone-500 dark:text-[#8E9F94] bg-stone-100 dark:bg-[#141D18] px-2.5 py-1 rounded-full border border-stone-200 dark:border-[#28392F]">
              {filteredStudents.length} Scripts
            </span>
          </div>

          {/* SVG Donut Chart with Center Average */}
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
            <div className="relative w-44 h-44 flex items-center justify-center">
              {(() => {
                const total = Math.max(1, filteredStudents.length);
                const mPct = (stats.masteryCount / total) * 100;
                const pPct = (stats.partialCount / total) * 100;
                const nPct = (stats.needsWorkCount / total) * 100;

                const r = 62;
                const c = 2 * Math.PI * r; // ~389.55

                const mLen = (mPct / 100) * c;
                const pLen = (pPct / 100) * c;
                const nLen = (nPct / 100) * c;

                const mOffset = 0;
                const pOffset = -mLen;
                const nOffset = -(mLen + pLen);

                return (
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                    {/* Background track */}
                    <circle
                      cx="80"
                      cy="80"
                      r={r}
                      fill="transparent"
                      stroke="currentColor"
                      className="text-stone-100 dark:text-[#111814]"
                      strokeWidth="20"
                    />
                    {/* Mastery arc (Green) */}
                    {mLen > 0 && (
                      <circle
                        cx="80"
                        cy="80"
                        r={r}
                        fill="transparent"
                        stroke="#16A34A"
                        strokeWidth="20"
                        strokeDasharray={`${mLen} ${c - mLen}`}
                        strokeDashoffset={mOffset}
                        className="transition-all duration-700 ease-out hover:opacity-85"
                      />
                    )}
                    {/* Partial arc (Amber) */}
                    {pLen > 0 && (
                      <circle
                        cx="80"
                        cy="80"
                        r={r}
                        fill="transparent"
                        stroke="#F59E0B"
                        strokeWidth="20"
                        strokeDasharray={`${pLen} ${c - pLen}`}
                        strokeDashoffset={pOffset}
                        className="transition-all duration-700 ease-out hover:opacity-85"
                      />
                    )}
                    {/* Needs Work arc (Red) */}
                    {nLen > 0 && (
                      <circle
                        cx="80"
                        cy="80"
                        r={r}
                        fill="transparent"
                        stroke="#EF4444"
                        strokeWidth="20"
                        strokeDasharray={`${nLen} ${c - nLen}`}
                        strokeDashoffset={nOffset}
                        className="transition-all duration-700 ease-out hover:opacity-85"
                      />
                    )}
                  </svg>
                );
              })()}

              {/* Center Mean Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="font-serif text-2xl font-bold text-[#18241E] dark:text-[#F6F4EE] leading-none">
                  {stats.avgPct}%
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 dark:text-[#7B8F82] mt-1">
                  Class Mean
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2.5 text-xs w-full sm:w-auto">
              <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-emerald-50 dark:bg-[#16271D] border border-emerald-200 dark:border-emerald-800/40">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#16A34A] shrink-0" />
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Mastery (≥80%)
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  {stats.masteryCount} <span className="font-sans font-normal text-[11px]">({filteredStudents.length > 0 ? Math.round((stats.masteryCount / filteredStudents.length) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-amber-50 dark:bg-[#282216] border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F59E0B] shrink-0" />
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    Partial (40–79%)
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                  {stats.partialCount} <span className="font-sans font-normal text-[11px]">({filteredStudents.length > 0 ? Math.round((stats.partialCount / filteredStudents.length) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-red-50 dark:bg-[#2A1618] border border-red-200 dark:border-red-900/40">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#EF4444] shrink-0" />
                  <span className="font-semibold text-red-900 dark:text-red-200">
                    Needs Work (&lt;40%)
                  </span>
                </div>
                <span className="font-mono font-bold text-red-800 dark:text-red-300">
                  {stats.needsWorkCount} <span className="font-sans font-normal text-[11px]">({filteredStudents.length > 0 ? Math.round((stats.needsWorkCount / filteredStudents.length) * 100) : 0}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right (6 cols): Animated Vertical Bar Chart (Grade Distribution A+ .. F) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#18241E] p-6 rounded-2xl border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
                Grade Distribution
              </h3>
              <p className="text-xs text-stone-500 dark:text-[#8E9F94]">
                Letter grade classifications across current cohort.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-[#16271D] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
              Pass Rate: {stats.passRate}%
            </span>
          </div>

          {/* Vertical Bar Chart Graphic */}
          {(() => {
            const grades = [
              { label: 'A+', cutoff: '≥85%', count: filteredStudents.filter((s) => s.pct >= 85).length, color: '#059669', bg: 'bg-[#059669]' },
              { label: 'A', cutoff: '70–84%', count: filteredStudents.filter((s) => s.pct >= 70 && s.pct < 85).length, color: '#16A34A', bg: 'bg-[#16A34A]' },
              { label: 'B', cutoff: '55–69%', count: filteredStudents.filter((s) => s.pct >= 55 && s.pct < 70).length, color: '#2563EB', bg: 'bg-[#2563EB]' },
              { label: 'C', cutoff: '40–54%', count: filteredStudents.filter((s) => s.pct >= 40 && s.pct < 55).length, color: '#D97706', bg: 'bg-[#D97706]' },
              { label: 'F', cutoff: '<40%', count: filteredStudents.filter((s) => s.pct < 40).length, color: '#DC2626', bg: 'bg-[#DC2626]' },
            ];

            const maxCount = Math.max(1, ...grades.map((g) => g.count));

            return (
              <div className="pt-2">
                <div className="h-44 flex items-end justify-between gap-3 px-3 pb-2 border-b border-stone-200 dark:border-[#28392F]">
                  {grades.map((g) => {
                    const barHeightPct = Math.max(8, Math.round((g.count / maxCount) * 100));
                    return (
                      <div key={g.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        {/* Student Count Badge on top */}
                        <span className="font-mono text-xs font-bold text-stone-700 dark:text-stone-300 group-hover:scale-110 transition-transform">
                          {g.count}
                        </span>

                        {/* Animated Bar */}
                        <div className="w-full max-w-[44px] bg-stone-100 dark:bg-[#111814] rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: '100%' }}>
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${g.bg} shadow-md group-hover:brightness-110`}
                            style={{ height: `${barHeightPct}%` }}
                          />
                        </div>

                        {/* Grade Label */}
                        <div className="text-center pt-1">
                          <div className="font-serif font-bold text-xs text-[#18241E] dark:text-[#F6F4EE]">
                            {g.label}
                          </div>
                          <div className="text-[10px] text-stone-500 dark:text-[#7B8F82] font-mono leading-none mt-0.5">
                            {g.cutoff}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ========================================================= */}
      {/* QUESTION-BY-QUESTION CLASS ACCURACY (HORIZONTAL BARS)     */}
      {/* ========================================================= */}
      {questionAccuracy.length > 0 && (
        <div className="bg-white dark:bg-[#18241E] p-6 rounded-2xl border border-[#E3E1D8] dark:border-[#28392F] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
                Question-by-Question Class Accuracy
              </h3>
              <p className="text-xs text-stone-500 dark:text-[#8E9F94]">
                Identifies tough concepts and class-wide misconceptions for targeted classroom review.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> ≥75% High Accuracy
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> 40%–74% Partial
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> &lt;40% Review Needed
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {questionAccuracy.map((q) => {
              let barColor = 'bg-[#16A34A]';
              let badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-[#16271D] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
              if (q.accuracyPct < 40) {
                barColor = 'bg-[#EF4444]';
                badgeColor = 'bg-red-50 text-red-700 dark:bg-[#2A1618] dark:text-red-300 border-red-200 dark:border-red-900/40';
              } else if (q.accuracyPct < 75) {
                barColor = 'bg-[#F59E0B]';
                badgeColor = 'bg-amber-50 text-amber-700 dark:bg-[#282216] dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
              }

              return (
                <div key={q.question_number} className="p-3 rounded-xl bg-[#FAF8F4] dark:bg-[#141D18] border border-stone-200 dark:border-[#243329] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 max-w-[70%] truncate">
                      <span className="font-serif font-bold text-[#18241E] dark:text-[#F6F4EE]">
                        {q.question_number}
                      </span>
                      <span className="text-stone-500 dark:text-[#8E9F94] truncate text-[11px]" title={q.question_text}>
                        {q.question_text ? `${q.question_text.slice(0, 50)}...` : 'Syllabus Criterion'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-stone-600 dark:text-[#8E9F94] text-[11px]">
                        {q.avgScore}/{q.max_marks}m
                      </span>
                      <span className={`font-mono font-bold text-[10.5px] px-1.5 py-0.5 rounded border ${badgeColor}`}>
                        {q.accuracyPct}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar with Animation */}
                  <div className="w-full bg-stone-200 dark:bg-[#0E1410] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(q.accuracyPct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STUDENT LEADERBOARD TABLE                                 */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#18241E] rounded-2xl border border-[#E3E1D8] dark:border-[#28392F] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E3E1D8] dark:border-[#28392F] flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
              Student Evaluation Leaderboard
            </h3>
            <p className="text-xs text-stone-500 dark:text-[#8E9F94]">
              Showing {rankedStudents.length} student scripts sorted by total marks awarded.
            </p>
          </div>
          <span className="text-xs text-stone-500 dark:text-[#8E9F94] font-mono">
            {stats.evaluatedCount} of {rankedStudents.length} Fully Signed
          </span>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F6F4EE] dark:bg-[#141D18] text-stone-500 dark:text-[#7B8F82] font-semibold border-b border-[#E3E1D8] dark:border-[#28392F]">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Student &amp; Roll Number</th>
                <th className="py-3 px-4">Class &amp; Branch</th>
                <th className="py-3 px-4">Handwriting Clarity</th>
                <th className="py-3 px-4">Score Awarded</th>
                <th className="py-3 px-4">Grade</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E1D8] dark:divide-[#28392F] text-[#18241E] dark:text-[#F6F4EE]">
              {rankedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-500 dark:text-[#8E9F94]">
                    No student papers matched your active filters.
                  </td>
                </tr>
              ) : (
                rankedStudents.map((s, idx) => (
                  <tr
                    key={s.id}
                    className="hover:bg-stone-50 dark:hover:bg-[#1F2C24] transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-400 dark:text-[#7B8F82]">
                      #{idx + 1}
                    </td>

                    {/* Student Name & Roll */}
                    <td className="py-3.5 px-4">
                      <div className="font-serif font-bold text-sm text-[#18241E] dark:text-[#F6F4EE]">
                        {s.student_name}
                      </div>
                      <div className="text-[11px] font-mono text-stone-500 dark:text-[#8E9F94]">
                        Roll: {s.roll_number}
                      </div>
                    </td>

                    {/* Class & Branch */}
                    <td className="py-3.5 px-4 text-stone-600 dark:text-[#8E9F94]">
                      <div>{s.class_name || 'Academic Batch'}</div>
                      <div className="text-[10px] text-stone-400 dark:text-[#62776A]">
                        {s.branch_name || 'Cloud & Cyber Security'}
                      </div>
                    </td>

                    {/* Handwriting Clarity */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded text-[11px]">
                        <span>✓</span>
                        <span>{s.avgClarity}%</span>
                      </span>
                    </td>

                    {/* Score Awarded */}
                    <td className="py-3.5 px-4">
                      <div className="font-serif font-bold text-sm text-[#18241E] dark:text-[#F6F4EE]">
                        {s.totalAwarded}{' '}
                        <span className="text-xs font-sans font-normal text-stone-400">
                          / {s.totalMax}m
                        </span>
                      </div>
                      <div className="text-[11px] font-mono font-semibold text-stone-500 dark:text-[#8E9F94]">
                        {s.pct}%
                      </div>
                    </td>

                    {/* Grade Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${s.gradeColor}`}
                      >
                        {s.grade}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {s.isFullyVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <span>✓</span>
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          <span>⏳</span>
                          <span>{s.verifiedCount}/{s.totalAnswers} checked</span>
                        </span>
                      )}
                    </td>

                    {/* Action: Review Paper */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (setCurrentSubId) setCurrentSubId(s.id);
                          if (setActiveView) setActiveView('workspace');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#18241E] dark:bg-[#D8BE8B] hover:bg-[#2A3D31] dark:hover:bg-[#ebd5a7] text-white dark:text-[#141D18] font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Review Paper</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
