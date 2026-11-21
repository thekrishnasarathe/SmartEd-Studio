import React, { useState, useRef, useMemo, useEffect } from 'react';

// Helper to extract clean and real rubric criteria from an answer
export const getRubricCriteria = (ans) => {
  if (!ans) return [];

  // Check structured sources in order of richness
  const sources = [
    ans.step_checks,
    ans.rubric_steps,
    ans.rubric_breakdown,
    ans.evidence_breakdown,
    ans.point_by_point,
    ans.criteria
  ];

  for (const src of sources) {
    if (Array.isArray(src) && src.length > 0) {
      return src.map((item, idx) => {
        if (typeof item === 'string') {
          return {
            id: `crit-${idx}`,
            label: item,
            maxMarks: 1,
            awardedMarks: 1,
            isPassed: true,
            isPartial: false,
            evidence: ''
          };
        }
        const label =
          item.criterion ||
          item.label ||
          item.description ||
          item.step ||
          item.point ||
          item.text ||
          item.title ||
          `Criterion #${idx + 1}`;
        const maxMarks = Number(item.max_marks ?? item.marks ?? item.weight ?? 1);
        let awardedMarks = 0;
        if (item.marks_awarded !== undefined) {
          awardedMarks = Number(item.marks_awarded);
        } else if (item.awarded !== undefined) {
          awardedMarks = Number(item.awarded);
        } else if (item.score !== undefined) {
          awardedMarks = Number(item.score);
        } else if (item.met === true || item.status === 'passed' || item.is_correct === true || item.isPassed === true) {
          awardedMarks = maxMarks;
        }

        const isPassed = item.status === 'passed' || item.isPassed === true || awardedMarks >= maxMarks || (item.met === true && awardedMarks > 0);
        const isPartial = !isPassed && awardedMarks > 0;
        const evidence = item.student_evidence || item.evidence || '';

        return {
          id: item.step_id || item.id || `crit-${idx}`,
          label,
          maxMarks,
          awardedMarks,
          isPassed,
          isPartial,
          evidence
        };
      });
    }
  }

  // If keyword breakdown exists
  const items = [];
  if (Array.isArray(ans.matched_keywords) && ans.matched_keywords.length > 0) {
    ans.matched_keywords.forEach((kw, idx) => {
      const text = typeof kw === 'string' ? kw : (kw.keyword || kw.text || `Concept #${idx + 1}`);
      items.push({
        id: `kw-match-${idx}`,
        label: `Key concept covered: ${text}`,
        maxMarks: 1,
        awardedMarks: 1,
        isPassed: true,
        isPartial: false,
        evidence: `Matched: "${text}"`
      });
    });
  }
  if (Array.isArray(ans.missing_keywords) && ans.missing_keywords.length > 0) {
    ans.missing_keywords.forEach((kw, idx) => {
      const text = typeof kw === 'string' ? kw : (kw.keyword || kw.text || `Missing #${idx + 1}`);
      items.push({
        id: `kw-miss-${idx}`,
        label: `Missing expected concept: ${text}`,
        maxMarks: 1,
        awardedMarks: 0,
        isPassed: false,
        isPartial: false,
        evidence: `Expected: "${text}"`
      });
    });
  }

  if (items.length > 0) return items;

  // Single fallback criterion based on question marks
  const totalAwarded = Number(ans.final_marks ?? ans.awarded_marks ?? ans.marks_awarded ?? ans.suggested_score ?? 0);
  const totalMax = Number(ans.max_marks || ans.max_score || 1);
  return [
    {
      id: 'crit-fallback-1',
      label: ans.title || ans.question_text || 'Standard Question Rubric',
      maxMarks: totalMax,
      awardedMarks: totalAwarded,
      isPassed: totalAwarded >= totalMax,
      isPartial: totalAwarded > 0 && totalAwarded < totalMax,
      evidence: ans.student_transcription || ans.student_answer || ''
    }
  ];
};

export const computeGradeInfo = (pct) => {
  const p = Number(pct) || 0;
  if (p >= 85) return { grade: 'Grade A+', letter: 'A+', label: 'Distinction', color: 'text-[#059669] dark:text-[#34D399]', badge: 'bg-[#DCFCE7] text-[#15803D]' };
  if (p >= 70) return { grade: 'Grade A', letter: 'A', label: 'Mastery', color: 'text-[#16A34A] dark:text-[#4ADE80]', badge: 'bg-[#DCFCE7] text-[#16A34A]' };
  if (p >= 55) return { grade: 'Grade B', letter: 'B', label: 'Proficient', color: 'text-[#2563EB] dark:text-[#60A5FA]', badge: 'bg-[#DBEAFE] text-[#1D4ED8]' };
  if (p >= 40) return { grade: 'Grade C', letter: 'C', label: 'Satisfactory', color: 'text-[#D97706] dark:text-[#FBBF24]', badge: 'bg-[#FEF3C7] text-[#B45309]' };
  return { grade: 'Grade F', letter: 'F', label: 'Needs Work', color: 'text-[#DC2626] dark:text-[#F87171]', badge: 'bg-[#FEE2E2] text-[#DC2626]' };
};

export const formatPageBadge = (rawPage) => {
  if (!rawPage) return '1';
  if (typeof rawPage === 'number') return `${rawPage}`;
  const str = String(rawPage);
  const nums = Array.from(new Set((str.match(/\d+/g) || []).map(Number)));
  if (nums.length === 0) return '1';
  if (nums.length === 1) return `${nums[0]}`;
  nums.sort((a, b) => a - b);
  const isConsecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  return isConsecutive ? `${nums[0]}–${nums[nums.length - 1]}` : nums.join(', ');
};

export default function EvaluationWorkspaceView({
  currentSub,
  submissions = [],
  setCurrentSubId,
  setActiveView,
  activeQuestion,
  setActiveQuestion,
  strictness = 7,
  setStrictness,
  handleScoreOverride,
  handleVerifyQuestion,
  handleNextQuestion,
  handlePrevQuestion,
  handleExportSubmissionPdf,
  handleConsignAndAdvance,
  handleUpdateTeacherComment,
  handleSaveTeacherComment,
  isIndependentScroll = false,
  setIsIndependentScroll,
  activeTool = 'pen',
  setActiveTool,
  sheetRotation = 0,
  setSheetRotation,
}) {
  // CRITICAL: Sub is always initialized at the very top to avoid TDZ errors
  const sub = currentSub || (submissions && submissions[0]) || {};
  const answers = useMemo(() => sub.answers || [], [sub.answers]);
  const currentAns = answers.find((a) => a.question_number === activeQuestion) || answers[0] || {};

  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'qp'
  const [evalSubTab, setEvalSubTab] = useState('questions'); // 'overview' | 'questions' | 'key'
  const [selectedPartFilter, setSelectedPartFilter] = useState('all'); // 'all' | 'Part I' | 'Part II' | 'Part III'
  const [qpViewMode, setQpViewMode] = useState('scan'); // 'scan' | 'doc'
  const [qpImageError, setQpImageError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(85); // 85% | 100% | 125%
  const [qpRotation, setQpRotation] = useState(0);

  // Quick Inline Student Metadata Editing
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaRoll, setMetaRoll] = useState('');
  const [metaClass, setMetaClass] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  const handleSaveMetadata = async () => {
    if (!sub?.id) return;
    setIsSavingMeta(true);
    try {
      const res = await fetch(`/api/submissions/${sub.id}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: metaName,
          roll_number: metaRoll,
          class_name: metaClass,
          subject: metaSubject,
        }),
      });
      if (res.ok) {
        sub.student_name = metaName;
        sub.roll_number = metaRoll;
        sub.class_name = metaClass;
        sub.subject = metaSubject;
        setIsEditingMetadata(false);
      }
    } catch (e) {
      console.error('Metadata update failed:', e);
    } finally {
      setIsSavingMeta(false);
    }
  };

  // Live Scribe Annotation State & Handlers
  const [currentTool, setCurrentTool] = useState('pan'); // 'pan' | 'pen' | 'highlighter' | 'stamp_check' | 'stamp_cross' | 'note'
  const [pageAnnotations, setPageAnnotations] = useState({});
  const [activeStroke, setActiveStroke] = useState(null);
  const [saveToast, setSaveToast] = useState(false);
  const [isToolsetMenuOpen, setIsToolsetMenuOpen] = useState(false);
  const toolsetMenuRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const lastSyncedPageRef = useRef(1);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsetMenuRef.current && !toolsetMenuRef.current.contains(e.target)) {
        setIsToolsetMenuOpen(false);
      }
    };
    if (isToolsetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isToolsetMenuOpen]);

  const selectTool = (tool) => {
    setCurrentTool(tool);
    if (setActiveTool) setActiveTool(tool);
  };

  // Convert points array to SVG path string
  const pointsToSvgPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  // Load annotations from localStorage
  useEffect(() => {
    if (!sub?.id) return;
    const storageKey = `smarted_annotations_sub_${sub.id}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setPageAnnotations(JSON.parse(raw));
        return;
      } catch (e) {
        console.error('Failed to parse annotations', e);
      }
    }
    setPageAnnotations({});
  }, [sub?.id]);

  const handleSaveAnnotations = () => {
    if (!sub?.id) return;
    const storageKey = `smarted_annotations_sub_${sub.id}`;
    localStorage.setItem(storageKey, JSON.stringify(pageAnnotations));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2800);
  };

  const handleUndo = () => {
    setPageAnnotations((prev) => {
      const list = prev[currentPage] || [];
      if (list.length === 0) return prev;
      return {
        ...prev,
        [currentPage]: list.slice(0, -1),
      };
    });
  };

  const handleClear = () => {
    setPageAnnotations((prev) => ({
      ...prev,
      [currentPage]: [],
    }));
  };

  // Helper to extract relative mouse/touch coordinates in % (0 - 100)
  const getRelativeCoords = (e, pageNum) => {
    const pageEl = document.getElementById(`answer-page-${pageNum}`);
    if (!pageEl) return { x: 50, y: 50 };
    const rect = pageEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  };

  const handleMouseDown = (e, pageNum) => {
    if (currentTool === 'pan') return;
    const coords = getRelativeCoords(e, pageNum);

    if (currentTool === 'eraser') {
      // Find annotation closest to coords on this page and delete it
      setPageAnnotations((prev) => {
        const list = prev[pageNum] || [];
        if (list.length === 0) return prev;
        const filtered = list.filter((item) => {
          if (item.type === 'stamp' || item.type === 'note') {
            const dist = Math.hypot((item.x || 0) - coords.x, (item.y || 0) - coords.y);
            return dist > 5.0; // remove within 5% radius
          }
          if (item.type === 'stroke' && item.points) {
            const hit = item.points.some(
              (pt) => Math.hypot(pt.x - coords.x, pt.y - coords.y) < 3.5
            );
            return !hit;
          }
          return true;
        });
        return { ...prev, [pageNum]: filtered };
      });
      return;
    }

    if (currentTool === 'stamp_check') {
      const newStamp = {
        id: `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'stamp',
        symbol: '✓',
        color: '#16A34A',
        x: coords.x,
        y: coords.y,
      };
      setPageAnnotations((prev) => ({
        ...prev,
        [pageNum]: [...(prev[pageNum] || []), newStamp],
      }));
      return;
    }

    if (currentTool === 'stamp_cross') {
      const newStamp = {
        id: `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'stamp',
        symbol: '✕',
        color: '#DC2626',
        x: coords.x,
        y: coords.y,
      };
      setPageAnnotations((prev) => ({
        ...prev,
        [pageNum]: [...(prev[pageNum] || []), newStamp],
      }));
      return;
    }

    if (currentTool === 'note') {
      const noteText = window.prompt('Enter margin note / teacher comment:', '');
      if (noteText && noteText.trim()) {
        const newNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'note',
          text: noteText.trim(),
          x: coords.x,
          y: coords.y,
        };
        setPageAnnotations((prev) => ({
          ...prev,
          [pageNum]: [...(prev[pageNum] || []), newNote],
        }));
      }
      return;
    }

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      isDrawingRef.current = true;
      const stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'stroke',
        tool: currentTool,
        color: currentTool === 'pen' ? '#DC2626' : 'rgba(234, 179, 8, 0.45)',
        width: currentTool === 'pen' ? 0.75 : 3.2,
        page: pageNum,
        points: [coords],
      };
      currentStrokeRef.current = stroke;
      setActiveStroke(stroke);
    }
  };

  const handleMouseMove = (e, pageNum) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    if (currentStrokeRef.current.page !== pageNum) return;
    const coords = getRelativeCoords(e, pageNum);
    currentStrokeRef.current.points.push(coords);
    setActiveStroke({ ...currentStrokeRef.current });
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;
    if (stroke && stroke.points.length > 0) {
      setPageAnnotations((prev) => ({
        ...prev,
        [stroke.page]: [...(prev[stroke.page] || []), stroke],
      }));
    }
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
    setActiveStroke(null);
  };

  const handleDeleteNote = (pageNum, noteId) => {
    setPageAnnotations((prev) => ({
      ...prev,
      [pageNum]: (prev[pageNum] || []).filter((item) => item.id !== noteId),
    }));
  };

  // =========================================================================
  // LIVE SYNCHRONIZED SCORING & PART GROUPING
  // =========================================================================
  const getAnswerScore = (a) => Number(
    a.final_marks ??
    a.awarded_marks ??
    a.marks_awarded ??
    a.awarded_score ??
    a.suggested_score ??
    a.suggested_marks ??
    0
  );

  const getAnswerMax = (a) => Number(a.max_marks || a.max_score || 1);

  // Live total sum that updates instantly when any question is adjusted via +/-
  const liveTotalMarks = useMemo(() => {
    return answers.reduce((sum, a) => sum + getAnswerScore(a), 0);
  }, [answers]);

  const liveTotalMax = useMemo(() => {
    const sumMax = answers.reduce((sum, a) => sum + getAnswerMax(a), 0);
    return sumMax > 0 ? sumMax : (sub.max_score || sub.max_marks || 60.0);
  }, [answers, sub.max_score, sub.max_marks]);

  const compositePct = Math.round((liveTotalMarks / (liveTotalMax || 1)) * 100);
  const reviewedCount = Math.min(
    answers.length,
    answers.filter((a) => a.is_verified || a.status === 'verified' || a.verification_status === 'VERIFIED').length
  );

  // Identify Part for grouping dynamically
  const getPartKey = (a, idx) => {
    if (a.part_id && typeof a.part_id === 'string' && a.part_id.trim()) {
      return a.part_id.trim();
    }
    if (a.part && typeof a.part === 'string' && a.part.trim()) {
      return a.part.trim();
    }
    const qNum = String(a.question_number || '').trim();
    if (qNum.startsWith('Part III') || qNum.startsWith('Part-III')) return 'Part III';
    if (qNum.startsWith('Part II') || qNum.startsWith('Part-II')) return 'Part II';
    if (qNum.startsWith('Part I') || qNum.startsWith('Part-I')) return 'Part I';
    if (/^Q\.?1\([A-Z]\)/i.test(qNum)) return 'Part I';
    if (/^Q\.?[2-5]\b/i.test(qNum) && answers.length > 5) return 'Part II';
    if (/^Q\.?[6-9]\b/i.test(qNum) && answers.length > 5) return 'Part III';
    if (answers.length > 1) {
      return 'Part I';
    }
    return 'Section 1';
  };

  // Structured Part definitions computed 100% dynamically from answers
  const partGroups = useMemo(() => {
    const parts = {};

    answers.forEach((ans, idx) => {
      const partKey = getPartKey(ans, idx);
      if (!parts[partKey]) {
        parts[partKey] = {
          key: partKey,
          title: partKey,
          subheading: '',
          max: 0,
          awarded: 0,
          items: [],
        };
      }
      const ansMax = getAnswerMax(ans);
      const ansScore = getAnswerScore(ans);
      parts[partKey].max += ansMax;
      parts[partKey].awarded += ansScore;
      parts[partKey].items.push({ ans, originalIdx: idx });
    });

    // Populate descriptive subheadings dynamically
    Object.values(parts).forEach((p) => {
      p.subheading = `${p.items.length} question(s) · Subtotal: ${p.max.toFixed(1)} marks`;
    });

    return parts;
  }, [answers]);

  // Student Switch Navigation
  const subIdx = Array.isArray(submissions) ? submissions.findIndex((s) => s.id === sub?.id) : -1;
  const handlePrevStudent = () => {
    if (!Array.isArray(submissions) || submissions.length <= 1) return;
    const prevIdx = (subIdx - 1 + submissions.length) % submissions.length;
    if (submissions[prevIdx]) setCurrentSubId(submissions[prevIdx].id);
  };
  const handleNextStudent = () => {
    if (!Array.isArray(submissions) || submissions.length <= 1) return;
    const nextIdx = (subIdx + 1) % submissions.length;
    if (submissions[nextIdx]) setCurrentSubId(submissions[nextIdx].id);
  };

  // Helper for question status dot color
  const getQuestionStatusDot = (ans) => {
    const score = getAnswerScore(ans);
    const max = getAnswerMax(ans);
    const ratio = score / max;
    if (ratio >= 0.8) return 'bg-[#16A34A]'; // Green (>= 80%)
    if (ratio >= 0.4) return 'bg-[#D97706]'; // Amber / Orange (40% - 79.99%)
    return 'bg-[#DC2626]'; // Red (< 40%)
  };

  // Compact Pill Label formatter: 1A·i, 1B·ii, P2·Q1, P3·Q2, P3·Req
  const formatPillLabel = (qNum) => {
    if (!qNum) return '';
    const match1 = qNum.match(/Q\.1\(([AB])\)\(([ivx]+)\)/i);
    if (match1) return `1${match1[1]}·${match1[2]}`;
    if (qNum.includes('Part II · Q.') || qNum.includes('Part-II Q.')) return qNum.replace(/Part[- ]II ·? ?Q\./, 'P2·Q');
    if (qNum.includes('Part III · Q.') || qNum.includes('Part-III Q.')) return qNum.replace(/Part[- ]III ·? ?Q\./, 'P3·Q');
    if (qNum.includes('2nd Required')) return 'P3·Req';
    if (qNum.includes('Part-I Q.1(A)')) return 'P1·1(A)';
    if (qNum.includes('Part-I Q.1(B)')) return 'P1·1(B)';
    return qNum;
  };

  // Overall Performance Stats for Executive Overview tab
  const questionStats = useMemo(() => {
    let fullCount = 0;
    let partialCount = 0;
    let redCount = 0;

    answers.forEach((ans) => {
      const awarded = getAnswerScore(ans);
      const max = getAnswerMax(ans);
      const ratio = awarded / max;

      if (ratio >= 0.8) fullCount++;
      else if (ratio >= 0.4) partialCount++;
      else redCount++;
    });

    const totalCount = answers.length || 1;

    return {
      fullCount,
      partialCount,
      redCount,
      sumAwarded: liveTotalMarks,
      sumMax: liveTotalMax,
      scorePct: compositePct,
      totalCount,
      fullPct: Math.round((fullCount / totalCount) * 100),
      partialPct: Math.round((partialCount / totalCount) * 100),
      redPct: Math.round((redCount / totalCount) * 100),
    };
  }, [answers, liveTotalMarks, liveTotalMax, compositePct]);

  // Student Pages (1 to 9) — memoized resolution from sub.pages, sub.pages_metadata or sub.page_images
  const resolvedPages = useMemo(() => {
    const getPageUrl = (p) => {
      if (!p) return '';
      if (typeof p === 'string') return p;
      return p.clahe_url || p.original_url || p.url || '';
    };

    if (Array.isArray(sub.pages) && sub.pages.length > 0) {
      const urls = sub.pages.map(getPageUrl).filter(Boolean);
      if (urls.length > 0) return urls;
    }
    if (Array.isArray(sub.pages_metadata) && sub.pages_metadata.length > 0) {
      const urls = sub.pages_metadata.map(getPageUrl).filter(Boolean);
      if (urls.length > 0) return urls;
    }
    if (Array.isArray(sub.page_images) && sub.page_images.length > 0) {
      const urls = sub.page_images.map(getPageUrl).filter(Boolean);
      if (urls.length > 0) return urls;
    }
    if (sub.enhanced_image_url || sub.original_image_url) {
      return [sub.enhanced_image_url || sub.original_image_url];
    }
    if (sub.id) {
      return Array.from({ length: sub.total_pages || 1 }, (_, i) =>
        `/api/sheets/${sub.id}/render-page?page=${i + 1}&variant=clahe`
      );
    }
    return [];
  }, [sub.id, sub.pages, sub.pages_metadata, sub.page_images, sub.enhanced_image_url, sub.original_image_url, sub.total_pages]);

  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollRafRef = useRef(null);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  // Smooth scroll to target page in left viewer
  const scrollToPage = (pageNum) => {
    const targetPage = Math.max(1, Math.min(resolvedPages.length, pageNum));
    currentPageRef.current = targetPage;
    setCurrentPage(targetPage);
    const container = leftScrollRef.current;
    const el = document.getElementById(`answer-page-${targetPage}`) || document.getElementById(`sheet-page-${targetPage}`);
    if (container && el) {
      isProgrammaticScrollRef.current = true;
      const targetScrollTop = Math.max(0, el.offsetTop - 16);
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 700);
    }
  };

  // Report -> Answer Sheet Auto-Sync: IntersectionObserver on #report-qcard-${idx}
  useEffect(() => {
    if (isIndependentScroll || evalSubTab !== 'questions') return;
    const container = rightScrollRef.current;
    if (!container) return;

    const cards = container.querySelectorAll('[id^="report-qcard-"]');
    if (!cards || cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScrollRef.current) return;
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length === 0) return;

        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topEntry = visibleEntries[0];
        const cardId = topEntry.target.id;
        const qIdx = parseInt(cardId.replace('report-qcard-', ''), 10);

        if (!isNaN(qIdx) && answers[qIdx]) {
          const ans = answers[qIdx];
          const pageNum = ans.page_number || (qIdx < 5 ? 1 : qIdx < 10 ? 2 : qIdx < 15 ? 4 : 9);
          if (pageNum && pageNum !== lastSyncedPageRef.current) {
            lastSyncedPageRef.current = pageNum;
            scrollToPage(pageNum);
          }
        }
      },
      {
        root: container,
        threshold: 0.25,
      }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [isIndependentScroll, evalSubTab, answers, resolvedPages.length]);

  // Jump directly to a question card in right pane, and sync left answer sheet if auto-sync is on
  const handleJumpToQuestion = (ans, idx) => {
    if (setActiveQuestion) setActiveQuestion(ans.question_number);

    if (evalSubTab !== 'questions') {
      setEvalSubTab('questions');
    }

    // Scroll right pane to that card
    setTimeout(() => {
      const cardEl = document.getElementById(`report-qcard-${idx}`);
      const container = rightScrollRef.current;
      if (cardEl && container) {
        const topOffset = cardEl.offsetTop - container.offsetTop - 12;
        container.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    }, 60);

    // Auto-sync: scroll left answer sheet to that question's page
    if (!isIndependentScroll) {
      const pageNum = ans.page_number || (idx < 5 ? 1 : idx < 10 ? 2 : idx < 15 ? 4 : 9);
      scrollToPage(pageNum);
    }
  };

  // Auto-update Page X of N indicator as user scrolls left viewer (throttled via rAF, no ping-pong)
  const handleScrollUpdatePage = () => {
    if (isProgrammaticScrollRef.current) return;
    if (scrollRafRef.current) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!leftScrollRef.current) return;
      const container = leftScrollRef.current;
      const containerTop = container.scrollTop;
      const offsetThreshold = containerTop + 160;

      let detected = 1;
      for (let i = 1; i <= resolvedPages.length; i++) {
        const el = document.getElementById(`answer-page-${i}`) || document.getElementById(`sheet-page-${i}`);
        if (el) {
          const elTop = el.offsetTop;
          const elBottom = elTop + el.offsetHeight;
          if (offsetThreshold >= elTop && offsetThreshold < elBottom) {
            detected = i;
            break;
          }
        }
      }
      if (detected !== currentPageRef.current) {
        currentPageRef.current = detected;
        setCurrentPage(detected);
      }
    });
  };

  const toggleZoom = () => {
    setZoom((z) => (z === 85 ? 100 : z === 100 ? 125 : 85));
  };

  const handleRotate = () => {
    if (activeTab === 'sheet') {
      setSheetRotation && setSheetRotation((prev) => (prev + 90) % 360);
    } else {
      setQpRotation((prev) => (prev + 90) % 360);
    }
  };

  if (!sub || !sub.id) {
    return (
      <div className="py-20 px-6 text-center flex flex-col items-center justify-center space-y-4 animate-fade-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-[#F6F4EE] dark:bg-[#202E27] border border-[#E3E1D8] dark:border-[#28392F] flex items-center justify-center text-3xl shadow-inner">
          📑
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-semibold text-[#18241E] dark:text-[#F6F4EE]">
            No paper selected for evaluation
          </h2>
          <p className="text-xs text-[#475569] dark:text-[#8E9F94] max-w-sm mx-auto">
            Please select a student script from your queue or upload a new answer paper to evaluate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('upload')}
          className="px-5 py-2.5 rounded-xl bg-[#141D18] dark:bg-[#D8BE8B] hover:bg-[#1F2C24] dark:hover:bg-[#E2CE9F] text-[#F6F4EE] dark:text-[#141D18] font-semibold text-xs tracking-wide shadow-md transition-all cursor-pointer flex items-center gap-2"
        >
          <span>Upload Answer Sheet</span>
          <span>→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-slide-up">
      {/* Inline Student Metadata Edit Modal */}
      {isEditingMetadata && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#E3E1D8] dark:border-[#28392F] pb-3">
              <h3 className="font-serif font-bold text-lg text-[#18241E] dark:text-[#F6F4EE] flex items-center gap-2">
                <span>✎</span>
                <span>Edit Student &amp; Exam Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingMetadata(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#18241E] dark:text-[#D8BE8B] mb-1">
                  Student Name
                </label>
                <input
                  type="text"
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18] text-[#18241E] dark:text-[#F6F4EE] focus:ring-2 focus:ring-[#D8BE8B] outline-none"
                  placeholder="Candidate Name"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18241E] dark:text-[#D8BE8B] mb-1">
                  Roll / Enrollment Number
                </label>
                <input
                  type="text"
                  value={metaRoll}
                  onChange={(e) => setMetaRoll(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18] text-[#18241E] dark:text-[#F6F4EE] focus:ring-2 focus:ring-[#D8BE8B] outline-none font-mono"
                  placeholder="e.g. 23BTM053"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18241E] dark:text-[#D8BE8B] mb-1">
                  Class / Course &amp; Semester
                </label>
                <input
                  type="text"
                  value={metaClass}
                  onChange={(e) => setMetaClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18] text-[#18241E] dark:text-[#F6F4EE] focus:ring-2 focus:ring-[#D8BE8B] outline-none"
                  placeholder="e.g. B.Tech · Semester 4"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18241E] dark:text-[#D8BE8B] mb-1">
                  Subject / Assessment
                </label>
                <input
                  type="text"
                  value={metaSubject}
                  onChange={(e) => setMetaSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18] text-[#18241E] dark:text-[#F6F4EE] focus:ring-2 focus:ring-[#D8BE8B] outline-none"
                  placeholder="e.g. Operating Systems"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3E1D8] dark:border-[#28392F]">
              <button
                type="button"
                onClick={() => setIsEditingMetadata(false)}
                className="px-4 py-2 rounded-lg border border-[#E3E1D8] dark:border-[#28392F] text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#202E27] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingMeta}
                onClick={handleSaveMetadata}
                className="px-4 py-2 rounded-lg bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow cursor-pointer flex items-center gap-1.5"
              >
                <span>{isSavingMeta ? 'Saving...' : 'Save details'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="text-[10px] font-bold uppercase tracking-widest text-[#475569] dark:text-[#7B8F82] hover:text-[#18241E] dark:hover:text-white flex items-center gap-1 cursor-pointer mb-1 transition-colors"
          >
            <span>←</span>
            <span>All scripts</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-medium text-[#18241E] dark:text-[#F6F4EE]">
              {sub.student_name || 'Candidate'}
            </h1>
            <button
              type="button"
              onClick={() => {
                setMetaName(sub.student_name || '');
                setMetaRoll(sub.roll_number || '');
                setMetaClass(sub.class_name || '');
                setMetaSubject(sub.subject || '');
                setIsEditingMetadata(true);
              }}
              className="text-xs px-2 py-0.5 rounded-md bg-[#FBF9F4] dark:bg-[#202E27] border border-[#E3E1D8] dark:border-[#28392F] text-[#18241E] dark:text-[#D8BE8B] hover:border-[#D8BE8B] transition-colors cursor-pointer flex items-center gap-1 font-semibold"
              title="Edit student name, roll number, or class details"
            >
              <span>✎</span>
              <span>Edit details</span>
            </button>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
              In review
            </span>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#8E9F94] mt-0.5">
            Roll no. {sub.roll_number || 'N/A'} {sub.class_name ? ` · ${sub.class_name}` : ''} {sub.exam_title || sub.subject ? ` · ${sub.exam_title || sub.subject}` : ''}
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleExportSubmissionPdf && handleExportSubmissionPdf(sub.id)}
            className="px-4 py-2 rounded-lg bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] hover:bg-[#F8F7F4] dark:hover:bg-[#202E27] text-[#18241E] dark:text-[#F6F4EE] font-semibold text-xs shadow-sm transition-all hover-lift cursor-pointer flex items-center gap-2"
          >
            <span>📥</span>
            <span>Export report</span>
          </button>
          <button
            type="button"
            onClick={() => handleConsignAndAdvance && handleConsignAndAdvance()}
            className="px-5 py-2 rounded-lg bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-md transition-all hover-lift cursor-pointer flex items-center gap-2 group"
          >
            <span>✓</span>
            <span>Verify script</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
        </div>
      </div>

      {/* Horizontal Summary Strip with Live Synced Total Marks */}
      <div className="bg-[#EBF0EC] dark:bg-[#1A251F] border border-[#D5E1D8] dark:border-[#28392F] rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs shadow-sm">
        {/* Metric 1: Total Marks (Live Synchronized to Sum of Cards) */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
            Total marks
          </div>
          <div className="mt-0.5 flex items-baseline">
            <span className="font-serif text-2xl font-bold text-[#18241E] dark:text-[#F6F4EE] score-pulse">
              {liveTotalMarks.toFixed(1)}
            </span>
            <span className="text-[#475569] dark:text-[#8E9F94] ml-1 font-semibold">/ {liveTotalMax.toFixed(1)}</span>
          </div>
        </div>

        {/* Metric 2: Grade */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
            Grade
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`font-serif text-2xl font-bold ${computeGradeInfo(compositePct).color}`}>
              {computeGradeInfo(compositePct).letter}
            </span>
            <span className="text-[#475569] dark:text-[#A3B1A8] font-semibold text-xs">
              {compositePct}% · {computeGradeInfo(compositePct).label}
            </span>
          </div>
        </div>

        {/* Metric 3: Strictness */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
            Strictness
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-bold text-[#18241E] dark:text-[#F6F4EE]">
              {strictness}/10 Balanced
            </span>
            <input
              type="range"
              min="1"
              max="10"
              value={strictness}
              onChange={(e) => setStrictness && setStrictness(Number(e.target.value))}
              className="w-24 accent-[#16A34A] cursor-pointer"
            />
          </div>
        </div>

        {/* Metric 4: Review Progress */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
            Review progress
          </div>
          <div className="text-xs font-bold text-[#18241E] dark:text-[#F6F4EE] mt-1">
            {reviewedCount} of {answers.length} questions checked
          </div>
        </div>

        {/* Metric 5: Changes Saved */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#141D18] border border-[#D5E1D8] dark:border-[#28392F] px-3 py-1 rounded-full text-[11px] font-bold text-[#18241E] dark:text-[#8E9F94] shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          <span>Changes saved</span>
        </div>
      </div>

      {/* Main Split-View Grid: Viewport Bounded on Laptop & Desktop Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-205px)] min-h-[520px]">
        {/* ========================================================= */}
        {/* LEFT COLUMN: ANSWER SHEET SCAN / QP VIEWER (50%)         */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl overflow-hidden shadow-sm flex flex-col h-full min-h-0 relative">
          {/* Header Tab Strip & Controls */}
          <div className="h-11 shrink-0 px-4 border-b border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18]/70 flex items-center justify-between text-xs">
            {/* Tabs */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('sheet')}
                className={`py-2.5 font-semibold flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
                  activeTab === 'sheet'
                    ? 'border-[#18241E] dark:border-[#D8BE8B] text-[#18241E] dark:text-[#F6F4EE]'
                    : 'border-transparent text-[#475569] dark:text-[#7B8F82]'
                }`}
              >
                <span>📄</span>
                <span>Answer sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qp')}
                className={`py-2.5 font-semibold flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
                  activeTab === 'qp'
                    ? 'border-[#18241E] dark:border-[#D8BE8B] text-[#18241E] dark:text-[#F6F4EE]'
                    : 'border-transparent text-[#475569] dark:text-[#7B8F82]'
                }`}
              >
                <span>Question paper</span>
              </button>
            </div>

            {/* Right Tools: Zoom, Rotate, and QP View Mode */}
            <div className="flex items-center gap-2 text-[#475569] dark:text-[#8E9F94] font-semibold">
              {activeTab === 'qp' && (
                <div className="inline-flex items-center p-0.5 rounded bg-stone-100 dark:bg-[#202E27] border border-stone-200 dark:border-[#28392F]">
                  <button
                    type="button"
                    onClick={() => setQpViewMode('scan')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      qpViewMode === 'scan'
                        ? 'bg-white dark:bg-[#18241E] text-[#18241E] dark:text-[#F6F4EE] shadow-xs'
                        : 'text-[#475569] dark:text-[#8E9F94]'
                    }`}
                  >
                    📷 Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setQpViewMode('doc')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      qpViewMode === 'doc'
                        ? 'bg-white dark:bg-[#18241E] text-[#18241E] dark:text-[#F6F4EE] shadow-xs'
                        : 'text-[#475569] dark:text-[#8E9F94]'
                    }`}
                  >
                    📄 Paper
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={toggleZoom}
                title="Click to toggle zoom: 85% / 100% / 125%"
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-[#202E27] hover:bg-stone-200 text-[#18241E] dark:text-[#F6F4EE] border border-stone-200 dark:border-[#28392F] cursor-pointer"
              >
                🔍 {zoom}%
              </button>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90°"
                className="p-1 px-2 rounded bg-stone-100 dark:bg-[#202E27] hover:bg-stone-200 text-[#18241E] dark:text-[#F6F4EE] border border-stone-200 dark:border-[#28392F] cursor-pointer text-xs font-bold"
              >
                ↻ 90°
              </button>
            </div>
          </div>

          {/* Body: High-Quality In-Place Continuous Answer Sheet View OR Question Paper */}
          <div
            ref={leftScrollRef}
            id="answer-sheet-scroll-container"
            onScroll={handleScrollUpdatePage}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 bg-[#EDEAE3] dark:bg-[#121A15] relative scrollbar-thin custom-scroll"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {activeTab === 'sheet' ? (
              <div
                className="w-full h-auto flex flex-col items-center gap-6 py-4 pb-28"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${sheetRotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.25s ease'
                }}
              >
                {resolvedPages.map((imgSrc, pIdx) => (
                  <div
                    key={pIdx}
                    id={`answer-page-${pIdx + 1}`}
                    data-page-index={pIdx + 1}
                    className="relative w-full max-w-[580px] min-h-[780px] bg-white shadow-md rounded border border-stone-300 overflow-hidden flex flex-col justify-start shrink-0 sheet-page-item select-none"
                  >
                    <span id={`sheet-page-${pIdx + 1}`} className="sr-only">Page {pIdx + 1}</span>
                    <div className="absolute top-2 right-2 bg-black/75 text-white text-[10px] font-mono font-bold px-2.5 py-0.5 rounded backdrop-blur z-10 shadow pointer-events-none">
                      Page {pIdx + 1} of {resolvedPages.length}
                    </div>
                    <img
                      src={imgSrc}
                      alt={`Answer sheet page ${pIdx + 1}`}
                      className="w-full h-auto object-contain select-none block pointer-events-none"
                      loading={pIdx < 2 ? 'eager' : 'lazy'}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        if (sub.id) {
                          e.currentTarget.src = `/api/sheets/${sub.id}/render-page?page=${pIdx + 1}&variant=clahe`;
                        }
                      }}
                    />

                    {/* Interactive Scribe Annotation SVG & Notes Layer */}
                    <div className="absolute inset-0 w-full h-full">
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className={`absolute inset-0 w-full h-full ${
                          currentTool === 'pan' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
                        }`}
                        onMouseDown={(e) => handleMouseDown(e, pIdx + 1)}
                        onMouseMove={(e) => handleMouseMove(e, pIdx + 1)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={(e) => handleMouseDown(e, pIdx + 1)}
                        onTouchMove={(e) => handleMouseMove(e, pIdx + 1)}
                        onTouchEnd={handleMouseUp}
                      >
                        {/* Committed Strokes */}
                        {(pageAnnotations[pIdx + 1] || [])
                          .filter((item) => item.type === 'stroke')
                          .map((str) => (
                            <path
                              key={str.id}
                              d={pointsToSvgPath(str.points)}
                              stroke={str.color}
                              strokeWidth={str.width || 0.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                              opacity={str.tool === 'highlighter' ? 0.45 : 0.95}
                            />
                          ))}

                        {/* Active Drawing Stroke */}
                        {activeStroke && activeStroke.page === pIdx + 1 && (
                          <path
                            d={pointsToSvgPath(activeStroke.points)}
                            stroke={activeStroke.color}
                            strokeWidth={activeStroke.width || 0.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            opacity={activeStroke.tool === 'highlighter' ? 0.45 : 0.95}
                          />
                        )}

                        {/* Committed Stamps (Check / Cross) */}
                        {(pageAnnotations[pIdx + 1] || [])
                          .filter((item) => item.type === 'stamp')
                          .map((st) => (
                            <g key={st.id} transform={`translate(${st.x}, ${st.y})`}>
                              <circle
                                r="2.8"
                                fill={st.color === '#16A34A' ? '#DCFCE7' : '#FEE2E2'}
                                stroke={st.color}
                                strokeWidth="0.5"
                              />
                              <text
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={st.color}
                                fontSize="3.2"
                                fontWeight="bold"
                                fontFamily="sans-serif"
                              >
                                {st.symbol}
                              </text>
                            </g>
                          ))}
                      </svg>

                      {/* Margin Note Chips */}
                      {(pageAnnotations[pIdx + 1] || [])
                        .filter((item) => item.type === 'note')
                        .map((nt) => (
                          <div
                            key={nt.id}
                            style={{ left: `${nt.x}%`, top: `${nt.y}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bg-[#FEF3C7] dark:bg-[#2A2312] border border-[#F59E0B] text-[#92400E] dark:text-[#FDE68A] text-[10px] font-sans font-medium px-2 py-1 rounded-md shadow-md flex items-center gap-1.5 max-w-[200px]">
                              <span>📌</span>
                              <span className="truncate" title={nt.text}>
                                {nt.text}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(pIdx + 1, nt.id)}
                                className="text-stone-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                                title="Delete note"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Question Paper Tab Content */
              <div className="p-4 text-center pb-12 animate-fade-slide-up">
                {/* Header Information */}
                <div className="bg-white dark:bg-[#18241E] p-4 rounded-xl border border-[#E3E1D8] dark:border-[#28392F] shadow-sm max-w-[620px] mx-auto text-center mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                    Official Examination Paper
                  </div>
                  <h3 className="font-serif font-bold text-xl text-[#18241E] dark:text-[#F6F4EE] mt-0.5">
                    {sub.exam_title || 'University Assessment'}
                  </h3>
                  <div className="text-xs text-[#475569] dark:text-[#8E9F94] mt-1">
                    {sub.subject || 'Examination Script'} · Maximum Marks: {liveTotalMax.toFixed(1)}m
                  </div>
                </div>

                {/* Display either Scan View or Formatted Document */}
                {qpViewMode === 'scan' && !qpImageError ? (
                  <div
                    className="flex flex-col items-center"
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${qpRotation}deg)`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.25s ease'
                    }}
                  >
                    {(() => {
                      const qpUrls = (Array.isArray(sub.question_paper_pages) && sub.question_paper_pages.length > 0)
                        ? sub.question_paper_pages
                        : [sub.question_paper_url || "/uploads/question_papers/cs502_ml_qp.png"];
                      return qpUrls.map((qUrl, qIdx) => (
                        <img
                          key={qIdx}
                          src={qUrl}
                          alt={`Question Paper Page ${qIdx + 1}`}
                          className="max-w-full w-[600px] rounded-lg border border-stone-300 shadow-md bg-white block mb-4"
                          onError={() => {
                            if (qIdx === 0) setQpImageError(true);
                          }}
                        />
                      ));
                    })()}
                  </div>
                ) : (
                  /* Pristine Formatted University Question Paper Sheet */
                  <div
                    className="max-w-[620px] mx-auto bg-white dark:bg-[#18241E] p-6 rounded-xl border border-stone-300 dark:border-[#28392F] shadow-md text-left font-sans space-y-5"
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${qpRotation}deg)`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.25s ease'
                    }}
                  >
                    {/* Header Banner */}
                    <div className="text-center border-b-2 border-stone-800 dark:border-stone-200 pb-3">
                      <div className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                        {sub.exam_title || 'University Examination'}
                      </div>
                      <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        {sub.subject || 'Academic Term Assessment'}
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-stone-600 dark:text-stone-400 mt-2 px-2">
                        <span>Course: {sub.class_name || 'Academic Degree'}</span>
                        <span>Max. Marks: {liveTotalMax.toFixed(1)}m</span>
                        <span>Standard Evaluation</span>
                      </div>
                    </div>

                    {/* Part I Section A */}
                    <div className="space-y-2">
                      <div className="font-bold text-xs bg-stone-100 dark:bg-[#202E27] p-1.5 rounded flex justify-between">
                        <span>Part I — Section A: Objective Type (5 × 1 = 5 Marks)</span>
                        <span className="text-[#16A34A] font-mono">5 Marks</span>
                      </div>
                      <ol className="list-none text-xs space-y-1.5 pl-2 text-stone-800 dark:text-stone-200">
                        <li><strong>(i)</strong> What is UNIX? (A) Hardware (B) Operating System (C) Language (D) Application</li>
                        <li><strong>(ii)</strong> Which command is used to display current working directory? (A) cd (B) dir (C) pwd (D) ls</li>
                        <li><strong>(iii)</strong> Which of the following is an example of relative path? (A) /home/student (B) /bin (C) Documents (D) /etc</li>
                        <li><strong>(iv)</strong> What is the function of the PATH environment variable in Linux?</li>
                        <li><strong>(v)</strong> Which symbol represents the parent directory in UNIX file system? (A) . (B) .. (C) ~ (D) /</li>
                      </ol>
                    </div>

                    {/* Part I Section B */}
                    <div className="space-y-2">
                      <div className="font-bold text-xs bg-stone-100 dark:bg-[#202E27] p-1.5 rounded flex justify-between">
                        <span>Part I — Section B: Small Definitions (5 × 1 = 5 Marks)</span>
                        <span className="text-[#16A34A] font-mono">5 Marks</span>
                      </div>
                      <ol className="list-none text-xs space-y-1.5 pl-2 text-stone-800 dark:text-stone-200">
                        <li><strong>(i)</strong> Define Kernel and its bridge role with system hardware.</li>
                        <li><strong>(ii)</strong> What is a Shell? Explain its role as command interpreter.</li>
                        <li><strong>(iii)</strong> What is a Directory in Linux operating systems?</li>
                        <li><strong>(iv)</strong> What is a Login Prompt? (Username and password credential entry).</li>
                        <li><strong>(v)</strong> What is POSIX? (Portable Operating System Interface IEEE standard).</li>
                      </ol>
                    </div>

                    {/* Part II */}
                    <div className="space-y-2">
                      <div className="font-bold text-xs bg-stone-100 dark:bg-[#202E27] p-1.5 rounded flex justify-between">
                        <span>Part II — Short Answer Questions (Attempt Any 5 × 6 = 30 Marks)</span>
                        <span className="text-[#16A34A] font-mono">30 Marks</span>
                      </div>
                      <ol className="list-none text-xs space-y-2 pl-2 text-stone-800 dark:text-stone-200">
                        <li><strong>Q.1</strong> Differentiate between Absolute and Relative path with examples. (6m)</li>
                        <li><strong>Q.2</strong> Explain vi editor modes (Command, Insert, Ex/Last-line) and basic navigation commands. (6m)</li>
                        <li><strong>Q.3</strong> Describe the Linux Directory Structure and Hierarchy (/, /bin, /etc, /home, /dev, /tmp). (6m)</li>
                        <li><strong>Q.5</strong> Explain standard file operation commands: cat, cp, mv, rm, ls, mkdir, rmdir with terminal syntax. (6m)</li>
                        <li><strong>Q.6</strong> What is Process Management in Linux? Explain ps, kill, and top commands. (6m)</li>
                      </ol>
                    </div>

                    {/* Part III */}
                    <div className="space-y-2">
                      <div className="font-bold text-xs bg-stone-100 dark:bg-[#202E27] p-1.5 rounded flex justify-between">
                        <span>Part III — Long Answer Questions (Attempt Any 2 × 10 = 20 Marks)</span>
                        <span className="text-[#16A34A] font-mono">20 Marks</span>
                      </div>
                      <ol className="list-none text-xs space-y-2 pl-2 text-stone-800 dark:text-stone-200">
                        <li><strong>Q.2</strong> Explain Shell Programming in detail: writing a shell script, setting execution permissions (chmod +x), variables, and script execution. (10m)</li>
                        <li><strong>Q.3</strong> (Required Question) Explain Linux User Administration and File Permissions (rwx bit triplets, chmod, chown, useradd). (10m)</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compact Floating Scribe's Toolset Pill: ONLY DISPLAYED WHEN ON ANSWER SHEET TAB */}
          {activeTab === 'sheet' && (
            <div className="absolute bottom-10 right-4 z-20" ref={toolsetMenuRef}>
              {/* Toolset Popover Menu */}
              {isToolsetMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 p-2 bg-[#18241E]/95 backdrop-blur-md text-white border border-[#2A3B30] rounded-2xl shadow-2xl flex flex-col gap-1.5 min-w-[210px] animate-scale-up text-xs">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#A3B1A8] px-2 py-0.5 border-b border-[#2A3B30]">
                    Annotation Tools
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => { selectTool('pan'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        currentTool === 'pan' ? 'bg-[#D8BE8B] text-[#141D18]' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>✋</span>
                      <span>Pan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectTool('pen'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        currentTool === 'pen' ? 'bg-[#FEE2E2] text-[#DC2626] font-bold' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>✎</span>
                      <span>Red Pen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectTool('highlighter'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        currentTool === 'highlighter' ? 'bg-[#FEF08A] text-[#854D0E] font-bold' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>🖍️</span>
                      <span>Highlighter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectTool('eraser'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        currentTool === 'eraser' ? 'bg-[#E2E8F0] text-[#334155] font-bold' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>🧽</span>
                      <span>Eraser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectTool('stamp_check'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        currentTool === 'stamp_check' ? 'bg-[#DCFCE7] text-[#16A34A] font-bold' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>✓</span>
                      <span>Stamp ✓</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectTool('stamp_cross'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        currentTool === 'stamp_cross' ? 'bg-[#FEE2E2] text-[#DC2626] font-bold' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>✕</span>
                      <span>Stamp ✕</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectTool('note'); setIsToolsetMenuOpen(false); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5 col-span-2 ${
                        currentTool === 'note' ? 'bg-[#FEF3C7] text-[#D97706] font-bold' : 'hover:bg-[#23352A] text-[#E3E1D8]'
                      }`}
                    >
                      <span>💬</span>
                      <span>Pin Margin Note</span>
                    </button>
                  </div>

                  <div className="border-t border-[#2A3B30] pt-1.5 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="px-2 py-1 rounded-lg text-[#A3B1A8] hover:text-white hover:bg-[#23352A] cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                      title="Undo last stroke"
                    >
                      <span>↺</span>
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2 py-1 rounded-lg text-[#A3B1A8] hover:text-red-400 hover:bg-[#23352A] cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                      title="Clear page annotations"
                    >
                      <span>🗑️</span>
                      <span>Clear</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAnnotations}
                      className="px-2.5 py-1 rounded-lg bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold cursor-pointer transition-all flex items-center gap-1 text-[11px] shadow-sm ml-auto"
                      title="Save annotations"
                    >
                      <span>💾</span>
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Main Compact Toolset Button */}
              <button
                type="button"
                onClick={() => setIsToolsetMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-[#18241E]/95 hover:bg-[#23352A] text-white border border-[#2A3B30] rounded-full px-3.5 py-2 shadow-2xl transition-all cursor-pointer text-xs font-semibold backdrop-blur-md"
                title="Open annotation toolset"
              >
                <span>
                  {currentTool === 'pan' && '✋'}
                  {currentTool === 'pen' && '✎'}
                  {currentTool === 'highlighter' && '🖍️'}
                  {currentTool === 'eraser' && '🧽'}
                  {currentTool === 'stamp_check' && '✓'}
                  {currentTool === 'stamp_cross' && '✕'}
                  {currentTool === 'note' && '💬'}
                </span>
                <span className="font-bold text-[#D8BE8B]">Toolset</span>
                <span className="text-[10px] text-[#A3B1A8]">{isToolsetMenuOpen ? '▲' : '▾'}</span>
              </button>
            </div>
          )}

          {/* Floating Save Toast Badge */}
          {saveToast && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-[#16A34A] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn">
              <span>✓</span>
              <span>Annotations saved to script</span>
            </div>
          )}

          {/* Footer Bar of Left Card: ONLY DISPLAYED WHEN ON ANSWER SHEET TAB */}
          {activeTab === 'sheet' && (
            <div className="h-10 shrink-0 px-4 border-t border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18]/70 flex items-center justify-between text-xs text-[#475569] dark:text-[#8E9F94] font-semibold relative z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollToPage(currentPage - 1)}
                  className="hover:text-black dark:hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-stone-200/50 text-sm font-bold"
                  title="Previous page"
                >
                  ‹
                </button>
                <span className="text-[11px] font-bold">Page {currentPage} of {resolvedPages.length}</span>
                <button
                  type="button"
                  onClick={() => scrollToPage(currentPage + 1)}
                  className="hover:text-black dark:hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-stone-200/50 text-sm font-bold"
                  title="Next page"
                >
                  ›
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsIndependentScroll && setIsIndependentScroll(!isIndependentScroll)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#475569] dark:text-[#A3B1A8] hover:text-[#18241E] dark:hover:text-white cursor-pointer transition-colors"
              >
                <span>⇄</span>
                <span>{isIndependentScroll ? 'Independent scroll: ON' : 'Auto-sync on'}</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: EVALUATION REPORT CARD (50%)               */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl overflow-hidden shadow-sm flex flex-col h-full min-h-0">
          {/* Sub-Tabs: Overview, Question-wise marks, Reference key */}
          <div className="h-11 shrink-0 px-4 border-b border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18]/70 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setEvalSubTab('overview')}
                className={`py-2.5 font-bold cursor-pointer border-b-2 transition-colors ${
                  evalSubTab === 'overview'
                    ? 'border-[#18241E] dark:border-[#D8BE8B] text-[#18241E] dark:text-[#F6F4EE]'
                    : 'border-transparent text-[#475569] dark:text-[#7B8F82]'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setEvalSubTab('questions')}
                className={`py-2.5 font-bold cursor-pointer border-b-2 transition-colors ${
                  evalSubTab === 'questions'
                    ? 'border-[#18241E] dark:border-[#D8BE8B] text-[#18241E] dark:text-[#F6F4EE]'
                    : 'border-transparent text-[#475569] dark:text-[#7B8F82]'
                }`}
              >
                Question-wise marks
              </button>
              <button
                type="button"
                onClick={() => setEvalSubTab('key')}
                className={`py-2.5 font-bold cursor-pointer border-b-2 transition-colors ${
                  evalSubTab === 'key'
                    ? 'border-[#18241E] dark:border-[#D8BE8B] text-[#18241E] dark:text-[#F6F4EE]'
                    : 'border-transparent text-[#475569] dark:text-[#7B8F82]'
                }`}
              >
                Reference key
              </button>
            </div>
            <span className="text-[11px] text-[#475569] dark:text-[#7B8F82] font-mono">
              {answers.length || 17} questions
            </span>
          </div>

          {/* Jump Pills Bar with Crisp Color Dots */}
          <div className="px-4 py-2 border-b border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18] flex items-center gap-1.5 overflow-x-auto custom-scroll shrink-0">
            {answers.map((ans, idx) => {
              const isSelected = ans.question_number === activeQuestion && evalSubTab === 'questions';
              const dotClass = getQuestionStatusDot(ans);
              const label = formatPillLabel(ans.question_number);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleJumpToQuestion(ans, idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all hover-lift shrink-0 ${
                    isSelected
                      ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                      : 'bg-white dark:bg-[#1E2922] border border-[#E3E1D8] dark:border-[#28392F] text-[#18241E] dark:text-[#A3B1A8] hover:bg-stone-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotClass} shrink-0`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* ======================================================= */}
          {/* SCROLLABLE CONTENT BODY (DISPATCHED BY evalSubTab)       */}
          {/* ======================================================= */}
          <div
            ref={rightScrollRef}
            id="right-evaluation-scroll-container"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-6 custom-scroll scrollbar-thin"
          >
            {/* ----------------------------------------------------- */}
            {/* VIEW 1: OVERVIEW TAB (Executive Summary & Marks Table)*/}
            {/* ----------------------------------------------------- */}
            {evalSubTab === 'overview' && (
              <div className="space-y-6 animate-fade-slide-up">
                {/* Executive Score & Performance Bar */}
                <div className="bg-[#FBF9F4] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E3E1D8] dark:border-[#28392F] pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                        Script Performance Summary
                      </span>
                      <h3 className="font-serif text-2xl font-bold text-[#18241E] dark:text-[#F6F4EE] mt-0.5">
                        {sub.student_name || 'Candidate'} {sub.roll_number ? `· ${sub.roll_number}` : ''}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-3xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                        {liveTotalMarks.toFixed(1)} <span className="text-sm font-sans text-[#475569] dark:text-[#8E9F94]">/ {liveTotalMax.toFixed(1)}m</span>
                      </div>
                      <div className="text-xs font-bold text-[#16A34A] dark:text-[#4ADE80]">
                        {compositePct}% Overall Mastery
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Segmented Bar Chart */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#475569] dark:text-[#8E9F94]">
                      <span>Score Distribution Across {questionStats.totalCount} Questions</span>
                      <span className="font-mono">{compositePct}% Aggregate</span>
                    </div>

                    {/* Segmented Stacked Bar with Smooth Fill */}
                    <div className="h-4 w-full bg-stone-200 dark:bg-[#202E27] rounded-full overflow-hidden flex shadow-inner">
                      <div
                        style={{ width: `${questionStats.fullPct}%` }}
                        className="bg-[#16A34A] h-full transition-all duration-500 ease-out"
                        title={`Full Marks (≥80%): ${questionStats.fullCount} questions`}
                      />
                      <div
                        style={{ width: `${questionStats.partialPct}%` }}
                        className="bg-[#D97706] h-full transition-all duration-500 ease-out"
                        title={`Partial (40-79%): ${questionStats.partialCount} questions`}
                      />
                      <div
                        style={{ width: `${questionStats.redPct}%` }}
                        className="bg-[#DC2626] h-full transition-all duration-500 ease-out"
                        title={`Deductions (<40%): ${questionStats.redCount} questions`}
                      />
                    </div>

                    {/* Legend Cards Aligned Horizontally */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs hover-lift">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                          <span>Full Marks (≥80%)</span>
                        </div>
                        <div className="mt-1 font-serif text-lg font-bold text-emerald-900 dark:text-emerald-100">
                          {questionStats.fullCount} <span className="text-xs font-sans font-normal text-emerald-700 dark:text-emerald-400">questions ({questionStats.fullPct}%)</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs hover-lift">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                          <span>Partial (40%–79%)</span>
                        </div>
                        <div className="mt-1 font-serif text-lg font-bold text-amber-900 dark:text-amber-100">
                          {questionStats.partialCount} <span className="text-xs font-sans font-normal text-amber-700 dark:text-amber-400">questions ({questionStats.partialPct}%)</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs hover-lift">
                        <div className="flex items-center gap-1.5 font-bold text-red-800 dark:text-red-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                          <span>Needs Work (&lt;40%)</span>
                        </div>
                        <div className="mt-1 font-serif text-lg font-bold text-red-900 dark:text-red-100">
                          {questionStats.redCount} <span className="text-xs font-sans font-normal text-red-700 dark:text-red-400">questions ({questionStats.redPct}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Question-Wise Marks Summary Table */}
                <div className="bg-white dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18] flex items-center justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#18241E] dark:text-[#F6F4EE]">
                        Question-Wise Marks Summary Table
                      </h4>
                      <p className="text-[11px] text-[#475569] dark:text-[#8E9F94]">
                        Click any row to jump straight to that question's full evaluation and rubric breakdown.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#18241E] dark:text-[#F6F4EE] bg-stone-100 dark:bg-[#202E27] px-2.5 py-1 rounded border border-stone-200 dark:border-[#28392F]">
                      Total: {liveTotalMarks.toFixed(1)} / {liveTotalMax.toFixed(1)}m
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#E3E1D8] dark:border-[#28392F] bg-stone-50 dark:bg-[#1a251f] text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Question &amp; Concept</th>
                          <th className="py-2.5 px-3">Page</th>
                          <th className="py-2.5 px-3">Awarded / Max</th>
                          <th className="py-2.5 px-3 text-center">Quick Adjust</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E1D8] dark:divide-[#28392F]">
                        {Object.values(partGroups).map((part) => (
                          <React.Fragment key={part.key}>
                            {/* Part Subtotal Row */}
                            <tr className="bg-stone-100/75 dark:bg-[#1F2D24] font-bold text-[11px] text-[#18241E] dark:text-[#F6F4EE]">
                              <td colSpan={3} className="py-2 px-3">
                                <span className="uppercase tracking-wider">{part.title}</span>
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-[#16A34A] dark:text-[#4ADE80]">
                                {part.awarded.toFixed(1)} / {part.max.toFixed(1)}m
                              </td>
                              <td colSpan={3} className="py-2 px-3 text-right text-[10px] text-[#475569] dark:text-[#8E9F94]">
                                Part Subtotal ({part.items.length} questions)
                              </td>
                            </tr>

                            {/* Question Rows for this Part */}
                            {part.items.map(({ ans, originalIdx }) => {
                              const awarded = getAnswerScore(ans);
                              const max = getAnswerMax(ans);
                              const ratio = awarded / max;
                              const dotClass = getQuestionStatusDot(ans);
                              const statusLabel = ratio >= 0.8 ? 'Full / High' : ratio >= 0.4 ? 'Partial' : 'Deductions';
                              const statusBadgeClass =
                                ratio >= 0.8
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
                                  : ratio >= 0.4
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300'
                                  : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300';

                              return (
                                <tr
                                  key={originalIdx}
                                  onClick={() => handleJumpToQuestion(ans, originalIdx)}
                                  className="hover:bg-[#FBF9F4] dark:hover:bg-[#1E2922] cursor-pointer transition-colors group"
                                >
                                  <td className="py-3 px-3 font-mono font-bold text-[#475569] dark:text-[#8E9F94]">
                                    #{String(originalIdx + 1).padStart(2, '0')}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="font-bold text-[#18241E] dark:text-[#F6F4EE] group-hover:text-[#16A34A] transition-colors">
                                      {ans.question_number}
                                    </div>
                                    <div className="text-[11px] text-[#475569] dark:text-[#8E9F94] line-clamp-1">
                                      {ans.title || ans.question_text}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-mono text-[11px] text-[#475569] dark:text-[#8E9F94]">
                                    p.{formatPageBadge(ans.page_number || (originalIdx < 5 ? 1 : originalIdx < 10 ? 2 : originalIdx < 15 ? 4 : 9))}
                                  </td>
                                  <td className="py-3 px-3 font-mono font-bold text-[#18241E] dark:text-[#F6F4EE]">
                                    {awarded.toFixed(1)} / {max.toFixed(1)}m
                                  </td>
                                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="inline-flex items-center gap-1 bg-stone-100 dark:bg-[#202E27] p-0.5 rounded border border-stone-200 dark:border-[#28392F]">
                                      <button
                                        type="button"
                                        onClick={() => handleScoreOverride && handleScoreOverride(ans.question_number, -0.5, true)}
                                        className="w-5 h-5 rounded hover:bg-white dark:hover:bg-[#141D18] text-[#18241E] dark:text-[#F6F4EE] font-bold text-xs flex items-center justify-center cursor-pointer transition-colors"
                                        title="Deduct 0.5 marks"
                                      >
                                        −
                                      </button>
                                      <span className="font-mono font-bold text-[11px] px-1 text-[#18241E] dark:text-[#F6F4EE]">
                                        0.5
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleScoreOverride && handleScoreOverride(ans.question_number, 0.5, true)}
                                        className="w-5 h-5 rounded hover:bg-white dark:hover:bg-[#141D18] text-[#18241E] dark:text-[#F6F4EE] font-bold text-xs flex items-center justify-center cursor-pointer transition-colors"
                                        title="Add 0.5 marks"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                      <span>{statusLabel}</span>
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <span className="text-[#16A34A] dark:text-[#D8BE8B] font-bold text-xs group-hover:underline">
                                      Review →
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* VIEW 2: QUESTION-WISE MARKS TAB (Discrete Cards Stack)*/}
            {/* ----------------------------------------------------- */}
            {evalSubTab === 'questions' && (
              <div className="space-y-6 animate-fade-slide-up">
                {/* Part Filter Ribbon with Live Subtotals */}
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#E3E1D8] dark:border-[#28392F]">
                  <button
                    type="button"
                    onClick={() => setSelectedPartFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 hover-lift ${
                      selectedPartFilter === 'all'
                        ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                        : 'bg-white dark:bg-[#1E2922] border border-[#E3E1D8] dark:border-[#28392F] text-[#475569] dark:text-[#A3B1A8] hover:bg-stone-50'
                    }`}
                  >
                    <span>All Parts</span>
                    <span className="font-mono text-[10px] opacity-75">({answers.length})</span>
                  </button>
                  {Object.values(partGroups).map((part) => {
                    const isSelected = selectedPartFilter === part.key;
                    return (
                      <button
                        key={part.key}
                        type="button"
                        onClick={() => setSelectedPartFilter(part.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 hover-lift ${
                          isSelected
                            ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                            : 'bg-white dark:bg-[#1E2922] border border-[#E3E1D8] dark:border-[#28392F] text-[#475569] dark:text-[#A3B1A8] hover:bg-stone-50'
                        }`}
                      >
                        <span>{part.key}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white dark:text-[#141D18] dark:bg-black/10'
                            : 'bg-stone-100 dark:bg-[#202E27] text-[#18241E] dark:text-[#F6F4EE]'
                        }`}>
                          {part.awarded.toFixed(1)} / {part.max.toFixed(1)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Render Parts and Discrete Cards */}
                {Object.values(partGroups)
                  .filter((part) => selectedPartFilter === 'all' || selectedPartFilter === part.key)
                  .map((part) => (
                    <div key={part.key} className="space-y-5">
                      {/* Part Section Header */}
                      <div className="bg-[#F4F1EA] dark:bg-[#1C2720] border-l-4 border-[#D8BE8B] rounded-r-xl p-3.5 flex items-center justify-between shadow-sm">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#8E9F94]">
                            Examination Section
                          </div>
                          <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE] mt-0.5">
                            {part.title === 'Part I' ? 'Part I — Objective & Small Answers' :
                             part.title === 'Part II' ? 'Part II — Short Answers (6m × 5 = 30 Marks)' :
                             part.title === 'Part III' ? 'Part III — Long Answers (10m × 2 = 20 Marks)' :
                             part.title}
                          </h3>
                          <p className="text-[11px] text-[#475569] dark:text-[#8E9F94]">{part.subheading}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#8E9F94]">
                            Part Subtotal
                          </div>
                          <div className="font-serif text-xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                            {part.awarded.toFixed(1)} <span className="text-xs font-sans text-[#475569] dark:text-[#8E9F94]">/ {part.max.toFixed(1)}m</span>
                          </div>
                        </div>
                      </div>

                      {/* Discrete Question Cards for this Part */}
                      <div className="space-y-6">
                        {part.items.map(({ ans, originalIdx }) => {
                          const awarded = getAnswerScore(ans);
                          const max = getAnswerMax(ans);
                          const criteria = getRubricCriteria(ans);

                          // Section dividers check inside Part I
                          const prevAns = originalIdx > 0 ? part.items[originalIdx - 1]?.ans : null;
                          const isSectionADivider = part.key === 'Part I' && originalIdx === 0;
                          const isSectionBDivider = part.key === 'Part I' && (
                            (ans.question_number && (ans.question_number.includes('(B)') || ans.question_number.includes('.1(B)'))) ||
                            (ans.section_label && ans.section_label.includes('Section B')) ||
                            originalIdx === 5
                          ) && (!prevAns || !(prevAns.question_number && (prevAns.question_number.includes('(B)') || prevAns.question_number.includes('.1(B)'))));

                          // Extract data for 4 accordions
                          const correctCriteria = criteria.filter((c) => c.isPassed || c.isPartial);
                          const failedCriteria = criteria.filter((c) => !c.isPassed);

                          const mistakesList = Array.isArray(ans.mistakes_found) && ans.mistakes_found.length > 0
                            ? ans.mistakes_found
                            : failedCriteria.map((c) => `${c.label} (-${(c.maxMarks - c.awardedMarks).toFixed(1)}m)`);

                          const missingList = Array.isArray(ans.missing_points) && ans.missing_points.length > 0
                            ? ans.missing_points
                            : (Array.isArray(ans.missing_keywords) ? ans.missing_keywords.map((k) => `Expected keyword/step: ${k}`) : []);

                          const correctList = correctCriteria.length > 0
                            ? correctCriteria
                            : [{ label: 'Conceptual points aligned with rubric', awardedMarks: awarded, maxMarks: max }];

                          const modelAnsText = ans.model_answer || ans.correct_model_answer || 'Refer to standard university examination rubric.';

                          return (
                            <React.Fragment key={originalIdx}>
                              {isSectionADivider && (
                                <div className="pt-1">
                                  <div className="bg-[#FAF8F3] dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] rounded-lg px-4 py-2 flex items-center justify-between text-xs">
                                    <span className="font-bold text-[#18241E] dark:text-[#F6F4EE]">
                                      Part I — Section A (Objective · 1m × 5 = 5 Marks)
                                    </span>
                                    <span className="font-mono text-[11px] text-[#475569] dark:text-[#8E9F94]">5 Questions · MCQs</span>
                                  </div>
                                </div>
                              )}
                              {isSectionBDivider && (
                                <div className="pt-2">
                                  <div className="bg-[#FAF8F3] dark:bg-[#18241E] border border-stone-200 dark:border-[#28392F] rounded-lg px-4 py-2 flex items-center justify-between text-xs">
                                    <span className="font-bold text-[#18241E] dark:text-[#F6F4EE]">
                                      Part I — Section B (Small Definitions · 1m × 5 = 5 Marks)
                                    </span>
                                    <span className="font-mono text-[11px] text-[#475569] dark:text-[#8E9F94]">5 Questions · Definitions</span>
                                  </div>
                                </div>
                              )}

                              <div
                                id={`report-qcard-${originalIdx}`}
                                className="bg-white dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 space-y-4 shadow-sm scroll-mt-3 hover-lift transition-all"
                              >
                                {/* Card Header: Question Index, Title & Score Stepper */}
                                <div className="flex items-start justify-between gap-4 border-b border-[#E3E1D8] dark:border-[#28392F] pb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#DCFCE7] dark:bg-[#1F3D2A] text-[#16A34A] dark:text-[#4ADE80] px-2 py-0.5 rounded">
                                        #{String(originalIdx + 1).padStart(2, '0')} · {ans.part_label || part.key}
                                      </span>
                                      <span className="text-[10px] font-mono text-[#475569] dark:text-[#8E9F94] bg-stone-100 dark:bg-[#202E27] px-2 py-0.5 rounded border border-stone-200 dark:border-[#28392F]">
                                        📄 Page {formatPageBadge(ans.page_number || (originalIdx < 5 ? 1 : originalIdx < 10 ? 2 : originalIdx < 15 ? 4 : 9))}
                                      </span>
                                    </div>
                                    <h3 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE] mt-1.5">
                                      {ans.question_number} {ans.title && ans.title !== ans.question_text ? `· ${ans.title}` : ''}
                                    </h3>
                                    {ans.question_text && (
                                      <p className="text-xs text-[#475569] dark:text-[#8E9F94] mt-0.5 max-w-xl">
                                        {ans.question_text}
                                      </p>
                                    )}
                                    {Array.isArray(ans.options) && ans.options.length > 0 && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-stone-100 dark:border-[#223028]">
                                        {ans.options.map((opt, oIdx) => (
                                          <div
                                            key={oIdx}
                                            className="px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#1A251F] border border-stone-200 dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#E2DEC9] font-mono flex items-center gap-2"
                                          >
                                            <span className="font-bold text-[#16A34A] dark:text-[#D8BE8B]">{opt.slice(0, 2)}</span>
                                            <span className="truncate">{opt.slice(2).trim()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Marks Stepper */}
                                  <div className="flex items-center gap-2.5 bg-[#FBF9F4] dark:bg-[#1E2922] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl px-3 py-1.5 shrink-0 shadow-sm">
                                    <div>
                                      <span className="font-serif text-2xl font-bold text-[#18241E] dark:text-[#F6F4EE]">
                                        {awarded.toFixed(1)}
                                      </span>
                                      <span className="text-[#475569] dark:text-[#8E9F94] text-xs ml-1 font-semibold">
                                        / {max.toFixed(1)}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 ml-1">
                                      <button
                                        type="button"
                                        onClick={() => handleScoreOverride && handleScoreOverride(ans.question_number, 0.5, true)}
                                        className="w-5 h-5 rounded bg-stone-200 dark:bg-[#202E27] hover:bg-stone-300 text-stone-700 dark:text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                                        title="Add 0.5 marks"
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleScoreOverride && handleScoreOverride(ans.question_number, -0.5, true)}
                                        className="w-5 h-5 rounded bg-stone-200 dark:bg-[#202E27] hover:bg-stone-300 text-stone-700 dark:text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                                        title="Deduct 0.5 marks"
                                      >
                                        −
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Extracted Student Answer Box */}
                                <div className="bg-[#FBF9F4] dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-3.5 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                                      Extracted student answer
                                    </span>
                                    <span className="text-[10px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                                      Handwriting Clarity: {Math.round((ans.ocr_confidence || 0.88) * 100)}%
                                    </span>
                                  </div>
                                  <p className="font-serif text-sm text-[#18241E] dark:text-[#F6F4EE] leading-relaxed whitespace-pre-wrap">
                                    {ans.student_transcription ||
                                     ans.student_answer ||
                                     ans.extracted_text ||
                                     ans.transcribed_text ||
                                     '(No student response detected for this question)'}
                                  </p>
                                </div>

                                {/* Marking Guide Check Box: Real Criteria Mapping */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                                    <span>Marking Guide Check</span>
                                    <span>Marks awarded</span>
                                  </div>

                                  <div className="space-y-1 text-xs">
                                    {criteria.map((item, cIdx) => (
                                      <div
                                        key={cIdx}
                                        className={`flex items-start justify-between p-2 rounded-lg border transition-colors ${
                                          item.isPassed
                                            ? 'bg-white dark:bg-[#141D18] border-[#E3E1D8] dark:border-[#28392F]'
                                            : item.isPartial
                                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                                            : 'bg-[#FEE2E2]/60 dark:bg-[#3D2E16]/40 border-[#FECACA] dark:border-[#785419]'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <span
                                            className={`font-bold mt-0.5 ${
                                              item.isPassed
                                                ? 'text-[#16A34A]'
                                                : item.isPartial
                                                ? 'text-[#D97706]'
                                                : 'text-[#DC2626]'
                                            }`}
                                          >
                                            {item.isPassed ? '✓' : item.isPartial ? '~' : '✕'}
                                          </span>
                                          <div>
                                            <div
                                              className={`font-medium ${
                                                item.isPassed
                                                  ? 'text-[#18241E] dark:text-[#F6F4EE]'
                                                  : item.isPartial
                                                  ? 'text-amber-900 dark:text-amber-200'
                                                  : 'text-[#B91C1C] dark:text-[#FCD34D] font-bold'
                                              }`}
                                            >
                                              {item.label}
                                            </div>
                                            {item.evidence && (
                                              <div className="text-[11px] text-[#475569] dark:text-[#8E9F94] mt-0.5 font-mono">
                                                Evidence: {item.evidence}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <span
                                          className={`font-mono font-bold shrink-0 ml-3 ${
                                            item.isPassed
                                              ? 'text-[#16A34A]'
                                              : item.isPartial
                                              ? 'text-[#D97706]'
                                              : 'text-[#DC2626]'
                                          }`}
                                        >
                                          {Number(item.awardedMarks).toFixed(1)} / {Number(item.maxMarks).toFixed(1)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* 4 Collapsible Accordions */}
                                <div className="space-y-2 pt-1">
                                  {/* 1. 🟢 What Is Correct */}
                                  <details className="group border border-emerald-200 dark:border-emerald-900/50 rounded-lg overflow-hidden shadow-sm" open>
                                    <summary className="w-full px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between cursor-pointer list-none select-none">
                                      <span className="flex items-center gap-2">
                                        <span>🟢</span>
                                        <span>What Is Correct ({correctList.length} earned points)</span>
                                      </span>
                                      <span className="text-emerald-700 dark:text-emerald-400 group-open:rotate-180 transition-transform">
                                        ▼
                                      </span>
                                    </summary>
                                    <div className="p-3 text-xs text-[#18241E] dark:text-[#E2E8F0] bg-white dark:bg-[#141D18] space-y-1.5 border-t border-emerald-100 dark:border-emerald-900/30">
                                      {ans.feedback_rationale && (
                                        <p className="font-medium text-[#16A34A] dark:text-[#4ADE80] pb-1 border-b border-stone-100 dark:border-[#28392F]">
                                          {ans.feedback_rationale}
                                        </p>
                                      )}
                                      <ul className="list-disc list-inside space-y-1">
                                        {correctList.map((item, idx) => (
                                          <li key={idx} className="leading-relaxed">
                                            <span className="font-semibold">{item.label}</span>
                                            {item.awardedMarks !== undefined && (
                                              <span className="font-mono text-[11px] text-[#16A34A] ml-1.5 font-bold">
                                                (+{item.awardedMarks}m)
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </details>

                                  {/* 2. 🔴 Mistakes & Deductions */}
                                  <details className="group border border-red-200 dark:border-red-900/50 rounded-lg overflow-hidden shadow-sm" open>
                                    <summary className="w-full px-3 py-2 bg-red-50/70 dark:bg-red-950/30 text-xs font-bold text-red-900 dark:text-red-200 flex items-center justify-between cursor-pointer list-none select-none">
                                      <span className="flex items-center gap-2">
                                        <span>🔴</span>
                                        <span>Mistakes &amp; Deductions ({mistakesList.length} items)</span>
                                      </span>
                                      <span className="text-red-700 dark:text-red-400 group-open:rotate-180 transition-transform">
                                        ▼
                                      </span>
                                    </summary>
                                    <div className="p-3 text-xs text-[#991B1B] dark:text-[#FCA5A5] bg-red-50/20 dark:bg-red-950/10 space-y-1 border-t border-red-100 dark:border-red-900/30">
                                      {mistakesList.length > 0 ? (
                                        <ul className="list-disc list-inside space-y-1">
                                          {mistakesList.map((m, idx) => (
                                            <li key={idx} className="leading-relaxed font-medium">
                                              {typeof m === 'string' ? m : JSON.stringify(m)}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                                          ✓ No factual errors or mistakes identified in this answer.
                                        </p>
                                      )}
                                    </div>
                                  </details>

                                  {/* 3. 🟠 What Is Missing */}
                                  <details className="group border border-amber-200 dark:border-amber-900/50 rounded-lg overflow-hidden shadow-sm">
                                    <summary className="w-full px-3 py-2 bg-amber-50/70 dark:bg-amber-950/30 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between cursor-pointer list-none select-none">
                                      <span className="flex items-center gap-2">
                                        <span>🟠</span>
                                        <span>What Is Missing ({missingList.length} concepts)</span>
                                      </span>
                                      <span className="text-amber-700 dark:text-amber-400 group-open:rotate-180 transition-transform">
                                        ▼
                                      </span>
                                    </summary>
                                    <div className="p-3 text-xs text-amber-900 dark:text-amber-200 bg-white dark:bg-[#141D18] space-y-1 border-t border-amber-100 dark:border-amber-900/30">
                                      {missingList.length > 0 ? (
                                        <ul className="list-disc list-inside space-y-1">
                                          {missingList.map((miss, idx) => (
                                            <li key={idx} className="leading-relaxed">
                                              {typeof miss === 'string' ? miss : JSON.stringify(miss)}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                                          ✓ All core requirements, diagrams, and steps were addressed.
                                        </p>
                                      )}
                                    </div>
                                  </details>

                                  {/* 4. 📘 Correct Reference Answer */}
                                  <details className="group border border-[#D5E1D8] dark:border-[#28392F] rounded-lg overflow-hidden shadow-sm">
                                    <summary className="w-full px-3 py-2 bg-[#FBF9F4] dark:bg-[#1E2922] text-xs font-bold text-[#18241E] dark:text-[#F6F4EE] flex items-center justify-between cursor-pointer list-none select-none">
                                      <span className="flex items-center gap-2 text-[#2563EB] dark:text-[#D8BE8B]">
                                        <span>📘</span>
                                        <span>Correct Reference Answer &amp; Model Solution</span>
                                      </span>
                                      <span className="text-[#475569] dark:text-[#8E9F94] group-open:rotate-180 transition-transform">
                                        ▼
                                      </span>
                                    </summary>
                                    <div className="p-3 text-xs text-[#18241E] dark:text-[#F6F4EE] bg-white dark:bg-[#141D18] space-y-1.5 border-t border-[#E3E1D8] dark:border-[#28392F]">
                                      <div className="font-mono text-[11px] bg-stone-50 dark:bg-[#1E2922] p-2.5 rounded border border-stone-200 dark:border-[#28392F] leading-relaxed whitespace-pre-wrap">
                                        {modelAnsText}
                                      </div>
                                      {Array.isArray(ans.required_keywords) && ans.required_keywords.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                          <span className="text-[10px] font-bold uppercase text-[#475569] dark:text-[#8E9F94]">
                                            Key criteria:
                                          </span>
                                          {ans.required_keywords.map((kw, kwIdx) => (
                                            <span
                                              key={kwIdx}
                                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                                            >
                                              #{kw}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                </div>

                                {/* Teacher's Feedback Box */}
                                <div className="space-y-1.5 pt-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82] flex items-center gap-1.5">
                                    <span>💬</span>
                                    <span>Teacher's feedback for {ans.question_number}</span>
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Add personalized note or feedback for student..."
                                    defaultValue={ans.teacher_comment || ''}
                                    onBlur={(e) => handleSaveTeacherComment && handleSaveTeacherComment(ans, e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#141D18] border border-[#D6D3C9] dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                                  />
                                </div>

                                {/* Bottom Action Bar for Question */}
                                <div className="pt-2 border-t border-[#E3E1D8] dark:border-[#28392F] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs font-semibold">
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyQuestion && handleVerifyQuestion(ans)}
                                    className="text-[#16A34A] dark:text-[#4ADE80] font-bold hover:underline flex items-center gap-1.5 cursor-pointer shrink-0"
                                  >
                                    <span>✓</span>
                                    <span>{ans.is_verified ? 'Verified by teacher' : 'Mark question as reviewed'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const p = parseInt(formatPageBadge(ans.page_number || (originalIdx < 5 ? 1 : originalIdx < 10 ? 2 : originalIdx < 15 ? 4 : 9))) || 1;
                                      scrollToPage(p);
                                    }}
                                    className="text-[#475569] dark:text-[#8E9F94] hover:text-[#18241E] dark:hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                                  >
                                    <span>View on page {formatPageBadge(ans.page_number || (originalIdx < 5 ? 1 : originalIdx < 10 ? 2 : originalIdx < 15 ? 4 : 9))}</span>
                                    <span>↗</span>
                                  </button>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* VIEW 3: REFERENCE KEY TAB (Full Rubric & Model Answers)*/}
            {/* ----------------------------------------------------- */}
            {evalSubTab === 'key' && (
              <div className="space-y-6 animate-fade-slide-up">
                <div className="bg-[#FBF9F4] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82]">
                    Official Examination Model Key
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#18241E] dark:text-[#F6F4EE] mt-0.5">
                    {sub.exam_title || 'Official Assessment Blueprint'}
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-[#8E9F94] mt-1">
                    Complete reference model answers, grading steps, and required conceptual rubrics for all {answers.length || 17} questions.
                  </p>
                </div>

                <div className="space-y-6">
                  {answers.map((ans, kIdx) => {
                    const criteria = getRubricCriteria(ans);
                    return (
                      <div
                        key={kIdx}
                        className="bg-white dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 space-y-4 shadow-sm hover-lift"
                      >
                        <div className="flex items-center justify-between border-b border-[#E3E1D8] dark:border-[#28392F] pb-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded">
                              #{String(kIdx + 1).padStart(2, '0')} · {ans.part_label || 'Question Key'}
                            </span>
                            <h4 className="font-serif text-lg font-bold text-[#18241E] dark:text-[#F6F4EE] mt-1">
                              {ans.question_number} · {ans.title || 'Question Rubric'}
                            </h4>
                          </div>
                          <span className="font-mono font-bold text-xs bg-stone-100 dark:bg-[#202E27] px-2.5 py-1 rounded text-[#18241E] dark:text-[#F6F4EE]">
                            Max: {ans.max_marks || ans.max_score || 1} Marks
                          </span>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82] mb-1">
                            Question Statement
                          </div>
                          <p className="text-xs text-[#18241E] dark:text-[#F6F4EE] leading-relaxed bg-[#FBF9F4] dark:bg-[#1E2922] p-3 rounded border border-stone-200 dark:border-[#28392F]">
                            {ans.question_text}
                          </p>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-[#D8BE8B] mb-1 flex items-center gap-1.5">
                            <span>📘</span>
                            <span>Model Answer / Reference Solution</span>
                          </div>
                          <div className="font-mono text-xs text-[#18241E] dark:text-[#F6F4EE] bg-stone-50 dark:bg-[#1E2922] p-3.5 rounded-lg border border-stone-200 dark:border-[#28392F] leading-relaxed whitespace-pre-wrap">
                            {ans.model_answer || ans.correct_model_answer || 'Standard University Model Solution.'}
                          </div>
                        </div>

                        {criteria.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82] mb-1">
                              Evaluation Step Breakdown
                            </div>
                            <div className="border border-[#E3E1D8] dark:border-[#28392F] rounded-lg overflow-hidden divide-y divide-[#E3E1D8] dark:divide-[#28392F] text-xs">
                              {criteria.map((c, idx) => (
                                <div key={idx} className="p-2.5 flex items-center justify-between bg-white dark:bg-[#141D18]">
                                  <span className="font-medium text-[#18241E] dark:text-[#F6F4EE]">
                                    {c.label}
                                  </span>
                                  <span className="font-mono font-bold text-[#16A34A] shrink-0 ml-3">
                                    {c.maxMarks}m
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar of Right Card */}
          <div className="h-12 px-5 border-t border-[#E3E1D8] dark:border-[#28392F] bg-[#FBF9F4] dark:bg-[#141D18]/70 flex items-center justify-between text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                if (currentAns) handleVerifyQuestion && handleVerifyQuestion(currentAns);
              }}
              className="text-[#16A34A] dark:text-[#4ADE80] font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>✓</span>
              <span>Mark current question as reviewed</span>
            </button>

            <button
              type="button"
              onClick={() => handleNextQuestion && handleNextQuestion()}
              className="text-[#18241E] dark:text-[#F6F4EE] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Next question</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Navigation: Evaluation Log & Prev/Next Student */}
      <footer className="pt-4 border-t border-[#E3E1D8] dark:border-[#28392F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#475569] dark:text-[#7B8F82]">
        <div>Every override is recorded in the evaluation log.</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handlePrevStudent}
            className="hover:text-black dark:hover:text-white cursor-pointer font-medium transition-colors"
          >
            Previous script
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={handleNextStudent}
            className="hover:text-black dark:hover:text-white cursor-pointer font-bold transition-colors"
          >
            Next script →
          </button>
        </div>
      </footer>
    </div>
  );
}
