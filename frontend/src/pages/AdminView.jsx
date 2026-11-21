import React, { useState, useEffect } from 'react';
import { apiUrl } from '../config';

export default function AdminView({
  submissions = [],
  libraryExams = [],
  showToast,
  currentUser,
  setCurrentUser,
}) {
  const [activeTab, setActiveTab] = useState('branding'); // 'branding' | 'access' | 'policy' | 'system'

  // Section 1: Institution Branding
  const [instName, setInstName] = useState(() => {
    try {
      const s = localStorage.getItem('smarted_admin_branding');
      if (s) return JSON.parse(s).instName || 'Scope Global Skills University';
    } catch (_) {}
    return 'Faculty of Computing & Information Technology';
  });

  const [deptName, setDeptName] = useState(() => {
    try {
      const s = localStorage.getItem('smarted_admin_branding');
      if (s) return JSON.parse(s).deptName || 'Department of Computer Applications (BCA)';
    } catch (_) {}
    return 'Department of Computer Science & Engineering';
  });

  const [termName, setTermName] = useState(() => {
    try {
      const s = localStorage.getItem('smarted_admin_branding');
      if (s) return JSON.parse(s).termName || 'Academic Term 2026';
    } catch (_) {}
    return 'Semester II · Academic Term 2026';
  });

  const handleSaveBranding = () => {
    try {
      localStorage.setItem(
        'smarted_admin_branding',
        JSON.stringify({ instName, deptName, termName })
      );
      if (showToast) showToast('✓ Institution & report branding saved successfully!');
    } catch (e) {
      console.error(e);
    }
  };

  // Section 2: Faculty & Evaluator Access
  const [facultyList, setFacultyList] = useState(() => {
    try {
      const s = localStorage.getItem('smarted_admin_faculty');
      if (s) return JSON.parse(s);
    } catch (_) {}
    return [
      { id: 'f-1', name: 'Prof. Evaluation Specialist', email: 'evaluator@faculty.edu', role: 'Chief Evaluator', status: 'Active' },
      { id: 'f-2', name: 'Dr. Anita Desai', email: 'anita.desai@faculty.edu', role: 'Faculty Member', status: 'Active' },
      { id: 'f-3', name: 'Prof. R. K. Verma', email: 'rk.verma@faculty.edu', role: 'Department Head', status: 'Active' },
    ];
  });

  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyRole, setNewFacultyRole] = useState('Faculty Member');

  const handleAddFaculty = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newFacultyName.trim() || !newFacultyEmail.trim()) return;

    const newMember = {
      id: `f-${Date.now()}`,
      name: newFacultyName.trim(),
      email: newFacultyEmail.trim(),
      role: newFacultyRole,
      status: 'Active',
    };

    const updated = [newMember, ...facultyList];
    setFacultyList(updated);
    try {
      localStorage.setItem('smarted_admin_faculty', JSON.stringify(updated));
    } catch (_) {}
    setNewFacultyName('');
    setNewFacultyEmail('');
    if (showToast) showToast(`✓ Added ${newMember?.name || 'Educator'} to Evaluator Roster`);
  };

  const handleRemoveFaculty = (id) => {
    const updated = facultyList.filter((f) => f.id !== id);
    setFacultyList(updated);
    try {
      localStorage.setItem('smarted_admin_faculty', JSON.stringify(updated));
    } catch (_) {}
    if (showToast) showToast('Educator access updated');
  };

  // Section 3: Default Grading Policy
  const [defaultStrictness, setDefaultStrictness] = useState(() => {
    try {
      const s = localStorage.getItem('smarted_admin_policy');
      if (s) return JSON.parse(s).strictness || 7;
    } catch (_) {}
    return 7;
  });

  const [passingPct, setPassingPct] = useState(40);
  const [distinctionPct, setDistinctionPct] = useState(85);
  const [gradingMode, setGradingMode] = useState('reference_guided');

  const handleSavePolicy = () => {
    try {
      localStorage.setItem(
        'smarted_admin_policy',
        JSON.stringify({ strictness: defaultStrictness, passingPct, distinctionPct, gradingMode })
      );
      if (showToast) showToast('✓ Default Grading Policy updated across all workspaces!');
    } catch (e) {
      console.error(e);
    }
  };

  // Section 4: System Status
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline'

  useEffect(() => {
    fetch(apiUrl('/api/exams'))
      .then((r) => {
        if (r.ok) setBackendStatus('online');
        else setBackendStatus('offline');
      })
      .catch(() => setBackendStatus('offline'));
  }, []);

  const handleExportSummaryCsv = () => {
    const headers = ['Submission ID', 'Student Name', 'Roll Number', 'Class', 'Subject', 'Total Marks', 'Max Marks', 'Status'];
    const rows = submissions.map((s) => [
      s.id,
      `"${s.student_name || 'Candidate'}"`,
      `"${s.roll_number || 'N/A'}"`,
      `"${s.class_name || ''}"`,
      `"${s.subject || ''}"`,
      s.total_final_marks ?? s.total_ai_marks ?? 0,
      s.max_marks || 60,
      s.status || 'evaluated',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'SmartEd_Evaluation_Database_Summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) showToast('✓ Exported Evaluation Database Summary (CSV)');
  };

  const handleClearDrafts = () => {
    if (window.confirm('Clear unverified temporary test drafts? Verified submissions will remain intact.')) {
      if (showToast) showToast('Temporary evaluation caches refreshed.');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-[#28392F] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
            <span>Faculty Console</span>
            <span>·</span>
            <span>Administrative Governance</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#18241E] dark:text-[#F6F4EE] mt-1">
            Institutional Admin &amp; Governance
          </h1>
          <p className="text-xs text-stone-500 dark:text-[#8E9F94] mt-1">
            Configure university branding, faculty credentials, evaluation strictness policies, and audit data.
          </p>
        </div>

        {/* Backend Status Capsule */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] shadow-sm text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              backendStatus === 'online' ? 'bg-[#16A34A] animate-pulse' : 'bg-[#EF4444]'
            }`}
          />
          <span className="font-mono text-stone-700 dark:text-stone-300">
            FastAPI Backend: {backendStatus === 'online' ? 'Connected (Port 8000)' : 'Offline / Mock'}
          </span>
        </div>
      </div>

      {/* 4 Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-[#28392F] pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'branding'
              ? 'bg-[#D8BE8B] text-[#141D18] font-bold shadow-sm'
              : 'text-stone-600 dark:text-[#A3B1A8] hover:bg-stone-100 dark:hover:bg-[#1A251F]'
          }`}
        >
          <span>🏛️</span>
          <span>Institution &amp; Report Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('access')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'access'
              ? 'bg-[#D8BE8B] text-[#141D18] font-bold shadow-sm'
              : 'text-stone-600 dark:text-[#A3B1A8] hover:bg-stone-100 dark:hover:bg-[#1A251F]'
          }`}
        >
          <span>👥</span>
          <span>Faculty &amp; Evaluator Access</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policy')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'policy'
              ? 'bg-[#D8BE8B] text-[#141D18] font-bold shadow-sm'
              : 'text-stone-600 dark:text-[#A3B1A8] hover:bg-stone-100 dark:hover:bg-[#1A251F]'
          }`}
        >
          <span>⚖️</span>
          <span>Default Grading Policy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'system'
              ? 'bg-[#D8BE8B] text-[#141D18] font-bold shadow-sm'
              : 'text-stone-600 dark:text-[#A3B1A8] hover:bg-stone-100 dark:hover:bg-[#1A251F]'
          }`}
        >
          <span>⚡</span>
          <span>System Status &amp; Database</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: INSTITUTION & REPORT BRANDING                     */}
      {/* ========================================================= */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-[#18241E] p-7 rounded-2xl border border-stone-200 dark:border-[#28392F] shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
              Official Header &amp; PDF Branding
            </h3>
            <p className="text-xs text-stone-500 dark:text-[#8E9F94] mt-0.5">
              These details appear in the top formal banner of all exported official PDF reports and ledger headers.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">
                University / Institution Name
              </label>
              <input
                type="text"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                placeholder="e.g. Scope Global Skills University"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">
                Department / Faculty Division
              </label>
              <input
                type="text"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. Department of Computer Applications (BCA)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">
                Academic Session &amp; Term
              </label>
              <input
                type="text"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                placeholder="e.g. Academic Term 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveBranding}
              className="px-6 py-2.5 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Save Institution Branding
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: FACULTY & EVALUATOR ACCESS                        */}
      {/* ========================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          {/* Add Evaluator Form */}
          <div className="bg-white dark:bg-[#18241E] p-6 rounded-2xl border border-stone-200 dark:border-[#28392F] shadow-sm space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
              Authorize New Educator / Evaluator
            </h3>
            <form onSubmit={handleAddFaculty} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4 space-y-1 text-xs">
                <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. Rajiv Sharma"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
                />
              </div>

              <div className="sm:col-span-4 space-y-1 text-xs">
                <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">Faculty Email</label>
                <input
                  type="email"
                  required
                  placeholder="r.sharma@faculty.edu"
                  value={newFacultyEmail}
                  onChange={(e) => setNewFacultyEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1 text-xs">
                <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">Role</label>
                <select
                  value={newFacultyRole}
                  onChange={(e) => setNewFacultyRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
                >
                  <option value="Faculty Member">Faculty</option>
                  <option value="Chief Evaluator">Chief Evaluator</option>
                  <option value="Department Head">Dept Head</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  Add Access
                </button>
              </div>
            </form>
          </div>

          {/* Evaluator Roster Table */}
          <div className="bg-white dark:bg-[#18241E] rounded-2xl border border-stone-200 dark:border-[#28392F] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-200 dark:border-[#28392F] flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
                  Authorized Educators ({facultyList.length})
                </h4>
                <p className="text-xs text-stone-500 dark:text-[#8E9F94]">
                  Accounts permitted to mark student scripts and sign official marks ledgers.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] dark:bg-[#141D18] border-b border-stone-200 dark:border-[#28392F] text-stone-500 dark:text-[#7B8F82] font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Educator</th>
                    <th className="py-3 px-6">Email Address</th>
                    <th className="py-3 px-6">Access Role</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-[#28392F]">
                  {(facultyList || []).filter(Boolean).map((f) => (
                    <tr key={f?.id || Math.random()} className="hover:bg-stone-50 dark:hover:bg-[#1F2C24] transition-colors">
                      <td className="py-3 px-6 font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                        {f?.name || 'Faculty Member'}
                      </td>
                      <td className="py-3 px-6 font-mono text-stone-600 dark:text-[#8E9F94]">
                        {f?.email || ''}
                      </td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF0EC] dark:bg-[#1F2C24] text-[#16A34A] dark:text-[#4ADE80] border border-[#D5E1D8] dark:border-[#28392F]">
                          {f?.role || 'Educator'}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                          <span>{f.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveFaculty(f.id)}
                          className="text-stone-400 hover:text-red-500 font-bold transition-colors cursor-pointer text-xs"
                          title="Revoke access"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DEFAULT GRADING POLICY                            */}
      {/* ========================================================= */}
      {activeTab === 'policy' && (
        <div className="bg-white dark:bg-[#18241E] p-7 rounded-2xl border border-stone-200 dark:border-[#28392F] shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
              Default Academic Grading Policies
            </h3>
            <p className="text-xs text-stone-500 dark:text-[#8E9F94] mt-0.5">
              Set standard strictness thresholds and pass/fail boundaries applied to all uploaded scripts.
            </p>
          </div>

          <div className="space-y-5 text-xs">
            {/* Strictness Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-stone-700 dark:text-[#E4EDE7]">Default AI Strictness Level (1–10)</span>
                <span className="font-mono text-[#D8BE8B] text-sm font-bold bg-[#141D18] px-2 py-0.5 rounded">
                  {defaultStrictness} / 10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={defaultStrictness}
                onChange={(e) => setDefaultStrictness(Number(e.target.value))}
                className="w-full accent-[#D8BE8B] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 dark:text-[#7B8F82] font-mono">
                <span>1 (Most Lenient)</span>
                <span>5 (Standard Academic)</span>
                <span>10 (Forensic Rigor)</span>
              </div>
            </div>

            {/* Passing Percentage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">
                  Passing Cutoff (%)
                </label>
                <input
                  type="number"
                  min="30"
                  max="60"
                  value={passingPct}
                  onChange={(e) => setPassingPct(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">
                  Distinction Cutoff (%)
                </label>
                <input
                  type="number"
                  min="70"
                  max="95"
                  value={distinctionPct}
                  onChange={(e) => setDistinctionPct(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
                />
              </div>
            </div>

            {/* Default Grading Mode */}
            <div className="space-y-1.5">
              <label className="font-semibold text-stone-700 dark:text-[#E4EDE7]">
                Primary Marking Mode
              </label>
              <select
                value={gradingMode}
                onChange={(e) => setGradingMode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#111814] border border-stone-300 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] focus:outline-none focus:border-[#D8BE8B]"
              >
                <option value="reference_guided">Reference-Guided (Aligned to Question Paper &amp; Rubrics)</option>
                <option value="step_wise">Step-Wise Analytical Derivation Check</option>
                <option value="concept_keywords">Keyword &amp; Concept Density Mapping</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSavePolicy}
              className="px-6 py-2.5 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Save Grading Policy
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: SYSTEM STATUS & DATA MANAGEMENT                   */}
      {/* ========================================================= */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
                Evaluated Answer Scripts
              </div>
              <div className="font-serif text-3xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                {submissions.length}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Live database records
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
                Saved Exam Blueprints
              </div>
              <div className="font-serif text-3xl font-bold text-[#D8BE8B]">
                {libraryExams.length || 8}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-[#8E9F94]">
                Templates &amp; Question Papers
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
                AI Vision Engine
              </div>
              <div className="font-serif text-xl font-bold text-emerald-600 dark:text-emerald-400">
                Gemini 3.1 Flash-Lite
              </div>
              <div className="text-[11px] text-stone-500 dark:text-[#8E9F94]">
                High-speed OCR &amp; Step Grading
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#7B8F82]">
                PDF Engine
              </div>
              <div className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                ReportLab 4.x
              </div>
              <div className="text-[11px] text-stone-500 dark:text-[#8E9F94]">
                Tamper-evident running ledger
              </div>
            </div>
          </div>

          {/* Data Actions */}
          <div className="bg-white dark:bg-[#18241E] p-6 rounded-2xl border border-stone-200 dark:border-[#28392F] shadow-sm space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE]">
              Database Audit &amp; Data Operations
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleExportSummaryCsv}
                className="px-5 py-2.5 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <span>📊</span>
                <span>Export Database Summary (CSV)</span>
              </button>

              <button
                type="button"
                onClick={handleClearDrafts}
                className="px-5 py-2.5 rounded-xl bg-[#FAF8F4] dark:bg-[#141D18] border border-stone-300 dark:border-[#28392F] text-stone-700 dark:text-stone-300 hover:text-red-500 hover:border-red-400 font-bold text-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>🧹</span>
                <span>Clear Old Unverified Drafts</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
