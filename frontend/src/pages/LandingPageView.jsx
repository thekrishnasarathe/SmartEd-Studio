import React, { useState, useEffect, useRef } from 'react';

export default function LandingPageView({
  setActiveView,
  isReportLightMode,
  setIsReportLightMode,
  submissions = [],
}) {
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [earlyAccessEmail, setEarlyAccessEmail] = useState('');
  const [isEarlyAccessSubmitted, setIsEarlyAccessSubmitted] = useState(false);

  // Auto-cycle through the 4 scenes every 4.5 seconds when video is not playing
  useEffect(() => {
    if (hasVideo || !isPlaying) return;
    const interval = setInterval(() => {
      setActiveScene((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(interval);
  }, [hasVideo, isPlaying]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEarlyAccessSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!earlyAccessEmail || !earlyAccessEmail.includes('@')) return;
    setIsEarlyAccessSubmitted(true);
    try {
      localStorage.setItem('smarted_recheck_early_access', earlyAccessEmail);
    } catch (_) {}
  };

  const scenes = [
    { id: 0, label: 'Upload Papers', title: 'Upload & Batch Processing' },
    { id: 1, label: 'Reading Handwriting', title: 'Handwriting Recognition & Extraction' },
    { id: 2, label: 'Smart Marking', title: 'Point-by-Point Marking & Red Ink' },
    { id: 3, label: 'Class Analytics', title: 'Real-time Cohort Performance' },
  ];

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-200 ${
        isReportLightMode ? 'bg-[#F6F4EE] text-[#18241E]' : 'bg-[#0E1410] text-[#F6F4EE]'
      }`}
    >
      {/* ========================================================= */}
      {/* TOP NAVBAR                                                */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 dark:bg-[#141D18]/90 border-b border-[#E3E1D8] dark:border-[#233129] px-6 md:px-12 h-16 flex items-center justify-between shadow-sm transition-colors">
        {/* Brand Crest */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-lg bg-[#D8BE8B] flex items-center justify-center text-[#141D18] font-serif font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
            S
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE] leading-tight tracking-wide group-hover:text-[#D8BE8B] transition-colors">
              SmartEd
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[#7B8F82] font-semibold">
              Evaluation Studio
            </span>
          </div>
        </div>

        {/* Center Anchor Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#475569] dark:text-[#A3B1A8]">
          <button
            type="button"
            onClick={() => scrollToSection('features')}
            className="hover:text-[#18241E] dark:hover:text-[#F6F4EE] transition-colors cursor-pointer"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('how-it-works')}
            className="hover:text-[#18241E] dark:hover:text-[#F6F4EE] transition-colors cursor-pointer"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('rechecking')}
            className="hover:text-[#D8BE8B] text-[#D8BE8B] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Google OCR Recheck</span>
            <span className="px-1.5 py-0.2 bg-[#D8BE8B]/20 text-[9px] rounded-full uppercase">Soon</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('about-us')}
            className="hover:text-[#18241E] dark:hover:text-[#F6F4EE] transition-colors cursor-pointer"
          >
            About Us
          </button>
        </nav>

        {/* Right Action & Theme Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsReportLightMode(!isReportLightMode)}
            className="p-2 rounded-lg bg-stone-100 dark:bg-[#1A251F] text-[#18241E] dark:text-[#F6F4EE] hover:bg-stone-200 dark:hover:bg-[#28392F] transition-colors cursor-pointer text-sm"
            title={isReportLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle Theme"
          >
            {isReportLightMode ? '🌙' : '☀️'}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="px-4 py-2 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Enter Workspace</span>
            <span>→</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 1. HERO SECTION (STICKY STACKING VIEWPORT 1)             */}
      {/* ========================================================= */}
      <section className="sticky top-16 z-10 w-full min-h-[calc(100vh-4rem)] flex items-center px-6 md:px-12 py-12 bg-[#F6F4EE] dark:bg-[#0E1410] border-b border-[#E3E1D8] dark:border-[#233129] transition-colors">
        <div className="max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column (7 cols): Headline & Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#EBF0EC] dark:bg-[#1A251F] text-[#16A34A] dark:text-[#4ADE80] border border-[#D5E1D8] dark:border-[#28392F]">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span>Built for University Educators &amp; Department Evaluators</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#18241E] dark:text-[#F6F4EE] leading-[1.12]">
              Grade handwritten answer sheets in minutes, with every mark under your control.
            </h1>

            <p className="text-base sm:text-lg text-[#475569] dark:text-[#A3B1A8] leading-relaxed max-w-2xl font-sans">
              SmartEd transforms stacks of physical exam booklets into an effortless, transparent digital evaluation flow.
              AI assists by reading handwriting and aligning answers point-by-point against your marking scheme—while you retain complete authority to review, annotate in red ink, and award every mark.
            </p>

            {/* CTA Buttons Row */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setActiveView('upload')}
                className="px-6 py-3.5 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center gap-2 group"
              >
                <span>Start Evaluating</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('home')}
                className="px-6 py-3.5 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] hover:bg-stone-50 dark:hover:bg-[#202E27] text-[#18241E] dark:text-[#F6F4EE] font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>Open Faculty Dashboard</span>
                <span>↗</span>
              </button>
            </div>

            {/* Quick Badges Strip */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-semibold text-[#475569] dark:text-[#7B8F82]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#16A34A]">✓</span>
                <span>60% Evaluation Time Saved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#16A34A]">✓</span>
                <span>100% Teacher Authority</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#16A34A]">✓</span>
                <span>Exact QP Marks Preserved</span>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): App Preview Showcase */}
          <div className="lg:col-span-5">
            <div className="bg-[#141D18] border-2 border-[#D8BE8B] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all">
              {/* macOS Window Title Bar */}
              <div className="bg-[#1B2720] px-4 py-3 border-b border-[#28392F] flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-[#10B981] inline-block shadow-sm" />
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#141D18] border border-[#2A3D31] text-[11px] font-mono text-[#D8BE8B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                  <span>smarted://studio/eval</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="text-xs text-[#A3B1A8] hover:text-[#D8BE8B] transition-colors p-1 cursor-pointer"
                  title={isPlaying ? 'Pause animation' : 'Play animation'}
                >
                  {isPlaying ? '❚❚' : '▶'}
                </button>
              </div>

              {/* Main Showcase Stage */}
              <div className="p-5 min-h-[340px] flex flex-col justify-between bg-[#111814] text-[#F6F4EE] relative">
                {activeScene === 0 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#D8BE8B]">
                        Stage 1 · Upload Papers
                      </span>
                      <span className="text-[10px] bg-[#1F2C24] text-[#4ADE80] px-2 py-0.5 rounded-full border border-[#2B3E32]">
                        Batch Ingestion Active
                      </span>
                    </div>

                    <div className="border-2 border-dashed border-[#D8BE8B]/60 rounded-xl p-5 bg-[#18241E]/70 text-center space-y-3 relative overflow-hidden group">
                      <div className="w-12 h-12 mx-auto rounded-full bg-[#D8BE8B]/20 flex items-center justify-center text-2xl text-[#D8BE8B] animate-bounce">
                        📥
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F6F4EE]">
                          Drop Scanned Answer Booklets (PDF / JPEG)
                        </div>
                        <div className="text-[10px] text-[#A3B1A8] mt-0.5">
                          Multi-page auto-splitting with pypdfium2 rendering
                        </div>
                      </div>
                      <div className="w-full bg-[#111814] h-2 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-[#D8BE8B] to-[#4ADE80] h-full rounded-full w-3/4 animate-pulse" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="p-2 rounded-lg bg-[#18241E] border border-[#28392F] flex items-center justify-between">
                        <span className="font-mono text-[#D8BE8B]">Booklet #1</span>
                        <span className="text-emerald-400 font-bold">✓ 9 pgs</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#18241E] border border-[#28392F] flex items-center justify-between">
                        <span className="font-mono text-[#D8BE8B]">Booklet #2</span>
                        <span className="text-emerald-400 font-bold">✓ 9 pgs</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#18241E] border border-[#28392F] flex items-center justify-between">
                        <span className="font-mono text-[#A3B1A8]">Booklet #3</span>
                        <span className="text-[#F59E0B] font-bold">⏳ Parsing</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeScene === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#D8BE8B]">
                        Stage 2 · Reading Handwriting
                      </span>
                      <span className="text-[10px] bg-[#1F2C24] text-[#4ADE80] px-2 py-0.5 rounded-full border border-[#2B3E32]">
                        Clarity: 94%
                      </span>
                    </div>

                    <div className="relative bg-[#FBF9F4] text-[#18241E] rounded-xl p-4 shadow-inner border border-stone-300 font-serif overflow-hidden">
                      <div
                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D8BE8B] to-transparent shadow-[0_0_12px_#D8BE8B] pointer-events-none animate-bounce"
                        style={{ animationDuration: '2s' }}
                      />
                      <div className="text-[10px] text-stone-500 font-mono flex justify-between border-b border-stone-200 pb-1 mb-2">
                        <span>Q.1(A)(i) Student Handwritten Script</span>
                        <span className="text-emerald-700 font-bold">Transcribed</span>
                      </div>
                      <p className="text-xs leading-relaxed italic text-stone-800">
                        "UNIX is an operating system developed at Bell Labs. pwd command shows current working directory..."
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ✓ "operating system" matched
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ✓ "pwd" identified
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        ⚠ Relative path: verify syntax
                      </span>
                    </div>
                  </div>
                )}

                {activeScene === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#D8BE8B]">
                        Stage 3 · Smart Marking &amp; Red Ink
                      </span>
                      <span className="text-[10px] bg-[#1F2C24] text-[#D8BE8B] px-2 py-0.5 rounded-full border border-[#2B3E32]">
                        Faculty Verified
                      </span>
                    </div>

                    <div className="bg-[#18241E] border border-[#28392F] rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-xs font-bold text-[#F6F4EE]">
                          Part I — Objective &amp; Small Answers
                        </span>
                        <span className="font-serif text-sm font-bold text-[#4ADE80]">
                          8.0 / 10.0m
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between p-1.5 rounded bg-[#111814] border border-[#233129]">
                          <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                            <span className="text-sm">✓</span>
                            <span>Q.1(A)(i) Operating System</span>
                          </span>
                          <span className="font-mono text-emerald-400 text-[11px] font-bold">+1.0</span>
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded bg-[#111814] border border-[#233129]">
                          <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                            <span className="text-sm">✓</span>
                            <span>Q.1(A)(ii) pwd shows current dir</span>
                          </span>
                          <span className="font-mono text-emerald-400 text-[11px] font-bold">+1.0</span>
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded bg-[#2A1618] border border-red-900/40">
                          <span className="text-red-300 font-medium flex items-center gap-1.5">
                            <span className="text-sm">✕</span>
                            <span>Q.1(A)(iii) Relative path: home/student</span>
                          </span>
                          <span className="font-mono text-red-400 text-[11px] font-bold">0.0</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#233129] text-[10px] text-[#A3B1A8]">
                        <span>One-click override:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-[#202E27] text-stone-200 border border-[#2B3E32] font-mono">
                            -0.5
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#202E27] text-stone-200 border border-[#2B3E32] font-mono">
                            +0.5
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#D8BE8B] text-[#141D18] font-bold">
                            Save ✓
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeScene === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#D8BE8B]">
                        Stage 4 · Class Analytics
                      </span>
                      <span className="text-[10px] bg-[#1F2C24] text-[#4ADE80] px-2 py-0.5 rounded-full border border-[#2B3E32]">
                        Live Cohort Data
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-xl bg-[#18241E] border border-[#28392F] text-center">
                        <div className="text-[10px] text-[#A3B1A8] uppercase font-bold">Class Avg</div>
                        <div className="font-serif text-lg font-bold text-[#F6F4EE]">74.5%</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#18241E] border border-[#28392F] text-center">
                        <div className="text-[10px] text-[#A3B1A8] uppercase font-bold">Pass Rate</div>
                        <div className="font-serif text-lg font-bold text-[#4ADE80]">94.4%</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#18241E] border border-[#28392F] text-center">
                        <div className="text-[10px] text-[#A3B1A8] uppercase font-bold">Top Score</div>
                        <div className="font-serif text-lg font-bold text-[#D8BE8B]">54.0/60</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#18241E] border border-[#28392F] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[#F6F4EE]">Performance Breakdown</span>
                        <span className="text-[10px] text-[#A3B1A8]">BCA Linux MST-I</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[#111814] overflow-hidden flex">
                        <div className="bg-[#16A34A] h-full" style={{ width: '62%' }} />
                        <div className="bg-[#F59E0B] h-full" style={{ width: '28%' }} />
                        <div className="bg-[#EF4444] h-full" style={{ width: '10%' }} />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-[#A3B1A8] font-mono pt-0.5">
                        <span className="text-emerald-400">● 62% Mastery (≥80%)</span>
                        <span className="text-amber-400">● 28% Partial</span>
                        <span className="text-red-400">● 10% Support</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Navigation Dots */}
                <div className="pt-3 border-t border-[#233129] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {scenes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setActiveScene(s.id);
                          setIsPlaying(false);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                          activeScene === s.id
                            ? 'bg-[#D8BE8B] text-[#141D18] font-bold shadow-sm'
                            : 'bg-[#18241E] text-[#A3B1A8] hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveView('workspace')}
                    className="text-[11px] font-bold text-[#D8BE8B] hover:text-[#ebd5a7] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Try Workspace</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. HOW IT WORKS (STICKY STACKING VIEWPORT 2)             */}
      {/* ========================================================= */}
      <section
        id="how-it-works"
        className="sticky top-16 z-20 w-full min-h-[calc(100vh-4rem)] flex items-center py-16 md:py-24 bg-white dark:bg-[#141D18] border-b border-[#E3E1D8] dark:border-[#233129] px-6 md:px-12 shadow-2xl transition-colors"
      >
        <div className="max-w-[1400px] w-full mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#7B8F82] bg-[#EBF0EC] dark:bg-[#1F2C24] px-3 py-1 rounded-full border border-[#D5E1D8] dark:border-[#28392F]">
              The Evaluation Journey
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal">
              How SmartEd works in 3 simple steps
            </h2>
            <p className="text-sm text-[#475569] dark:text-[#8E9F94]">
              No complicated setups. From raw physical booklets to signed and verified mark sheets in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#FBF9F4] dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-2xl p-7 space-y-4 relative group hover:border-[#D8BE8B] transition-colors shadow-sm">
              <span className="w-10 h-10 rounded-xl bg-[#18241E] dark:bg-[#D8BE8B] text-[#D8BE8B] dark:text-[#141D18] font-mono font-bold text-lg flex items-center justify-center shadow">
                01
              </span>
              <h3 className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                Upload Answer Booklets
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Drop single student sheets, multi-page PDFs, or complete class batches. Optionally upload a Question Paper and Answer Key or reuse one from your Saved Exams.
              </p>
            </div>

            <div className="bg-[#FBF9F4] dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-2xl p-7 space-y-4 relative group hover:border-[#D8BE8B] transition-colors shadow-sm">
              <span className="w-10 h-10 rounded-xl bg-[#18241E] dark:bg-[#D8BE8B] text-[#D8BE8B] dark:text-[#141D18] font-mono font-bold text-lg flex items-center justify-center shadow">
                02
              </span>
              <h3 className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                AI Reads &amp; Checks Every Answer
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                SmartEd deciphers handwritten answers across all pages, segments each question, maps points earned against your criteria, and identifies missing steps.
              </p>
            </div>

            <div className="bg-[#FBF9F4] dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-2xl p-7 space-y-4 relative group hover:border-[#D8BE8B] transition-colors shadow-sm">
              <span className="w-10 h-10 rounded-xl bg-[#18241E] dark:bg-[#D8BE8B] text-[#D8BE8B] dark:text-[#141D18] font-mono font-bold text-lg flex items-center justify-center shadow">
                03
              </span>
              <h3 className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                Review, Annotate &amp; Export
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Use digital red pen, highlighter, and stamps directly on the scanned sheet. Override marks with one click, add personal feedback notes, and export official PDF reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. KEY FEATURES (STICKY STACKING VIEWPORT 3)              */}
      {/* ========================================================= */}
      <section
        id="features"
        className="sticky top-16 z-30 w-full min-h-[calc(100vh-4rem)] flex items-center py-16 md:py-24 px-6 md:px-12 bg-[#F6F4EE] dark:bg-[#0E1410] border-b border-[#E3E1D8] dark:border-[#233129] shadow-2xl transition-colors"
      >
        <div className="max-w-[1400px] w-full mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#7B8F82] bg-[#EBF0EC] dark:bg-[#1F2C24] px-3 py-1 rounded-full border border-[#D5E1D8] dark:border-[#28392F]">
              Capabilities
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal">
              Designed around how teachers actually grade
            </h2>
            <p className="text-sm text-[#475569] dark:text-[#8E9F94]">
              Every tool is purpose-built to combine digital efficiency with physical marking intuition.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] space-y-3 shadow-sm hover:border-[#D8BE8B] transition-colors">
              <span className="text-2xl">✍️</span>
              <h4 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE]">
                Live Scribe Red-Ink Tools
              </h4>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Mark directly on top of student answer sheets with red pen, yellow highlighter, checkmark stamps, and pinned margin notes—all persisted automatically.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] space-y-3 shadow-sm hover:border-[#D8BE8B] transition-colors">
              <span className="text-2xl">⚖️</span>
              <h4 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE]">
                4 Accordion Diagnostic Breakdown
              </h4>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Every question shows 4 collapsible cards: What Is Correct (🟢), Mistakes &amp; Deductions (🔴), What Is Missing (🟠), and Model Solutions (📘).
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] space-y-3 shadow-sm hover:border-[#D8BE8B] transition-colors">
              <span className="text-2xl">🎚️</span>
              <h4 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE]">
                Adjustable Strictness (1–10)
              </h4>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Tune AI checking sensitivity from Lenient to Rigorous to match semester standards, university guidelines, or competitive entrance benchmarks.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] space-y-3 shadow-sm hover:border-[#D8BE8B] transition-colors">
              <span className="text-2xl">📊</span>
              <h4 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE]">
                Class Analytics &amp; Visual Charts
              </h4>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Detect class-wide misconceptions, track score distributions across sessions, and export institutional grade sheets in standard CSV format.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] space-y-3 shadow-sm hover:border-[#D8BE8B] transition-colors">
              <span className="text-2xl">📚</span>
              <h4 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE]">
                Saved Exams Blueprint
              </h4>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Store standard Question Papers and marking schemes once. Seamlessly evaluate new batches or parallel sections with zero manual re-entry.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] space-y-3 shadow-sm hover:border-[#D8BE8B] transition-colors">
              <span className="text-2xl">🛡️</span>
              <h4 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE]">
                Institutional Admin Controls
              </h4>
              <p className="text-xs text-[#475569] dark:text-[#8E9F94] leading-relaxed">
                Configure institution branding, university departments, grading policies, and manage evaluator accounts with full privacy safeguards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. COMING SOON: GOOGLE OCR RECHECKING (STACKING VIEWPORT 4) */}
      {/* ========================================================= */}
      <section
        id="rechecking"
        className="sticky top-16 z-40 w-full min-h-[calc(100vh-4rem)] flex items-center py-16 md:py-24 px-6 md:px-12 bg-[#141D18] text-[#F6F4EE] border-b border-[#233129] shadow-2xl transition-colors"
      >
        <div className="max-w-[1400px] w-full mx-auto space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#D8BE8B]/15 text-[#D8BE8B] border border-[#D8BE8B]/40 uppercase tracking-widest">
              <span>✦ Coming Soon · Q1 2027</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#F6F4EE] leading-tight">
              Super-Accuracy Copy Rechecking with Google OCR
            </h2>

            <p className="text-sm sm:text-base text-[#A3B1A8] leading-relaxed font-sans">
              Experience bulletproof academic fairness. Our upcoming secondary verification pipeline runs handwritten student scripts through Google Cloud Vision and Cloud Document OCR in parallel with multimodal LLM reasoning, double-checking borderline grades and disputed questions with forensic precision.
            </p>
          </div>

          {/* 3 High-Impact Capability Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1A251F] border border-[#D8BE8B]/30 rounded-2xl p-7 space-y-3 relative hover:border-[#D8BE8B] transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-[#D8BE8B]/20 text-[#D8BE8B] flex items-center justify-center font-bold text-lg">
                🔍
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F6F4EE]">
                Dual-Engine Cross-Validation
              </h3>
              <p className="text-xs text-[#A3B1A8] leading-relaxed">
                Both Gemini Vision and Google Cloud Document OCR independently transcribe complex cursive handwriting, flagging character-level discrepancies before marks are finalized.
              </p>
            </div>

            <div className="bg-[#1A251F] border border-[#D8BE8B]/30 rounded-2xl p-7 space-y-3 relative hover:border-[#D8BE8B] transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-[#D8BE8B]/20 text-[#D8BE8B] flex items-center justify-center font-bold text-lg">
                🎯
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F6F4EE]">
                Borderline Grade Recalibration
              </h3>
              <p className="text-xs text-[#A3B1A8] leading-relaxed">
                Automatically identifies scripts landing within 0.5 to 1.5 marks of a grade cutoff (e.g. 39/100 or 79/100) and triggers an enhanced second-pass review for missed partial credits.
              </p>
            </div>

            <div className="bg-[#1A251F] border border-[#D8BE8B]/30 rounded-2xl p-7 space-y-3 relative hover:border-[#D8BE8B] transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-[#D8BE8B]/20 text-[#D8BE8B] flex items-center justify-center font-bold text-lg">
                📜
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F6F4EE]">
                Official Revaluation Certificate
              </h3>
              <p className="text-xs text-[#A3B1A8] leading-relaxed">
                Export comprehensive, tamper-evident Rechecking Dossiers with side-by-side OCR confidence heatmaps ready for Academic Council review and student RTI queries.
              </p>
            </div>
          </div>

          {/* Interactive Early Access Box */}
          <div className="max-w-2xl mx-auto bg-[#18241E] border-2 border-[#D8BE8B] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <div className="font-serif text-xl font-bold text-[#D8BE8B]">
              Get Early Access to Google OCR Rechecking
            </div>
            <p className="text-xs text-[#A3B1A8] max-w-lg mx-auto">
              Be the first faculty department to pilot double-pass handwritten script rechecking when our Google Cloud Vision integration goes live.
            </p>

            {isEarlyAccessSubmitted ? (
              <div className="p-3 rounded-xl bg-[#16A34A]/20 border border-[#16A34A]/60 text-[#4ADE80] font-semibold text-xs flex items-center justify-center gap-2 animate-fadeIn">
                <span>✓</span>
                <span>You're on the early access priority list! We'll notify you as soon as it launches.</span>
              </div>
            ) : (
              <form onSubmit={handleEarlyAccessSubmit} className="flex flex-col sm:flex-row items-center gap-2 max-w-md mx-auto">
                <input
                  type="email"
                  required
                  placeholder="Enter your university or faculty email..."
                  value={earlyAccessEmail}
                  onChange={(e) => setEarlyAccessEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#111814] border border-[#28392F] text-xs text-[#F6F4EE] placeholder-[#7B8F82] focus:outline-none focus:border-[#D8BE8B]"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  Notify Me
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. CALL TO ACTION & FOOTER (STICKY STACKING VIEWPORT 5)  */}
      {/* ========================================================= */}
      <section className="sticky top-16 z-50 w-full min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-[#111814] text-[#A3B1A8] shadow-2xl transition-colors">
        {/* Upper CTA Banner */}
        <div className="px-6 md:px-12 py-16 max-w-[1400px] w-full mx-auto my-auto">
          <div className="bg-[#18241E] border-2 border-[#D8BE8B] rounded-2xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
            <div className="space-y-2 max-w-2xl">
              <h3 className="font-serif text-2xl md:text-3xl font-medium text-[#F6F4EE]">
                Ready to modernize your evaluation desk?
              </h3>
              <p className="text-xs md:text-sm text-[#A3B1A8] leading-relaxed">
                Jump straight into the Faculty Workspace or upload your first student answer booklet to experience the workflow.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveView('upload')}
                className="px-5 py-3 rounded-xl bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Upload New Scripts</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('workspace')}
                className="px-5 py-3 rounded-xl bg-[#141D18] border border-[#2A3B30] hover:bg-[#202E27] text-[#F6F4EE] font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Open Evaluation Workspace</span>
              </button>
            </div>
          </div>
        </div>

        {/* Complete Footer with About Us */}
        <footer id="about-us" className="border-t border-[#233129] px-6 md:px-12 py-12 bg-[#141D18]">
          <div className="max-w-[1400px] mx-auto space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
              {/* About Us (5 cols) */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#D8BE8B] flex items-center justify-center text-[#141D18] font-serif font-bold text-lg shadow">
                    S
                  </div>
                  <span className="font-serif text-lg font-bold text-[#F6F4EE]">
                    SmartEd Evaluation Studio
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#8E9F94]">
                  SmartEd Evaluation Studio is an academic evaluation intelligence platform engineered for university educators, faculty members, and examination controllers. Developed in alignment with higher education standards, it eliminates hours of mechanical grading while upholding 100% transparent, human-in-the-loop academic rigor.
                </p>
                <div className="text-[11px] text-[#7B8F82]">
                  Universal Higher Education &amp; Examination Standards
                </div>
              </div>

              {/* Quick Links (3 cols) */}
              <div className="md:col-span-3 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#D8BE8B]">
                  Faculty Workspace
                </div>
                <ul className="space-y-2 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveView('home')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Overview &amp; Scripts Desk
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveView('upload')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Upload Papers
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveView('workspace')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Evaluation Workspace
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveView('analytics')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Class Analytics
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveView('admin')}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      Admin Settings
                    </button>
                  </li>
                </ul>
              </div>

              {/* Assessment Support (4 cols) */}
              <div className="md:col-span-4 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#D8BE8B]">
                  Supported Assessment Schemes
                </div>
                <p className="text-xs text-[#8E9F94] leading-relaxed">
                  Pre-configured for Mid-Semester Tests (MST-I, MST-II), Final University End-Sem Examinations, Objective MCQs, Technical Architecture Diagrams, and Code/Algorithm derivations.
                </p>
                <div className="pt-2 text-xs font-mono text-[#D8BE8B]">
                  Security: End-to-end local processing &amp; audited grading logs.
                </div>
              </div>
            </div>

            {/* Bottom Copyright Strip */}
            <div className="pt-6 border-t border-[#233129] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7B8F82]">
              <div>
                © 2026 SmartEd Evaluation Studio. Designed for educators with Editorial Ivory &amp; Deep Botanical Forest aesthetics.
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Back to top ↑
                </button>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
