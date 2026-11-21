import React, { useState, useRef } from 'react';

export default function UploadIngestView({
  setActiveView,
  strictness = 5,
  setStrictness,
  handleQuickIngest,
  onDropFiles,
  libraryExams = [],
  selectedExamId,
  setSelectedExamId,
  questionPaperFile: propQpFile,
  setQuestionPaperFile: propSetQpFile,
  answerKeyFile: propAkFile,
  setAnswerKeyFile: propSetAkFile,
  assessmentTitle: propTitle,
  setAssessmentTitle: propSetTitle,
  className: propClass,
  setClassName: propSetClass,
  isUploading = false,
  uploadProgress = '',
  uploadStage = 1,
  uploadPercent = 10,
  uploadElapsedSeconds = 0,
  showToast,
}) {
  // Mode: 'library' | 'upload'
  const [rubricSource, setRubricSource] = useState('library');
  const [scriptMode, setScriptMode] = useState('single'); // 'single' | 'batch' | 'folder'

  // Local state fallbacks if not passed from parent
  const [localQpFile, setLocalQpFile] = useState(null);
  const [localAkFile, setLocalAkFile] = useState(null);
  const [localTitle, setLocalTitle] = useState('');
  const [localClass, setLocalClass] = useState('');
  const [saveToRubricLibrary, setSaveToRubricLibrary] = useState(true);

  // Drag states
  const [isDraggingQp, setIsDraggingQp] = useState(false);
  const [isDraggingAk, setIsDraggingAk] = useState(false);
  const [isDraggingScript, setIsDraggingScript] = useState(false);

  // File Input Refs
  const qpInputRef = useRef(null);
  const akInputRef = useRef(null);
  const scriptInputRef = useRef(null);

  // Effective values
  const qpFile = propQpFile !== undefined ? propQpFile : localQpFile;
  const setQpFile = propSetQpFile || setLocalQpFile;

  const akFile = propAkFile !== undefined ? propAkFile : localAkFile;
  const setAkFile = propSetAkFile || setLocalAkFile;

  const assessmentTitle = propTitle !== undefined ? propTitle : localTitle;
  const setAssessmentTitle = propSetTitle || setLocalTitle;

  const currentClass = propClass !== undefined ? propClass : localClass;
  const setCurrentClass = propSetClass || setLocalClass;

  // Answer Scripts State
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchFiles, setBatchFiles] = useState([]);
  const [folderFiles, setFolderFiles] = useState([]);

  // Validation Error State
  const [qpError, setQpError] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStrictnessLabel = (val) => {
    const num = Number(val) || 5;
    if (num <= 3) return 'Lenient';
    if (num <= 7) return 'Balanced';
    return 'Rigorous';
  };

  // Handle Question Paper File Selection
  const handleSelectQpFile = (file) => {
    if (!file) return;
    setQpFile(file);
    setQpError(false);
    // Auto-fill title from filename if currently empty
    if (!assessmentTitle || assessmentTitle.trim() === '') {
      const cleanName = (file?.name || '')
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      if (cleanName) setAssessmentTitle(cleanName);
    }
  };

  const handleRemoveQpFile = (e) => {
    e.stopPropagation();
    setQpFile(null);
    if (qpInputRef.current) qpInputRef.current.value = '';
  };

  // Handle Answer Key File Selection
  const handleSelectAkFile = (file) => {
    if (!file) return;
    setAkFile(file);
  };

  const handleRemoveAkFile = (e) => {
    e.stopPropagation();
    setAkFile(null);
    if (akInputRef.current) akInputRef.current.value = '';
  };

  // Handle Answer Script File Selection
  const handleSelectScriptFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    if (scriptMode === 'single') {
      const f = fileList[0];
      if (!f) return;
      setSelectedFile({
        name: f?.name || 'Student Script',
        size: f?.size || 0,
        pages: f?.type === 'application/pdf' ? 9 : 1,
        status: 'Uploaded & ready',
        fileObj: f,
      });
    } else if (scriptMode === 'batch') {
      const arr = Array.from(fileList).filter(Boolean);
      setBatchFiles(arr);
      setSelectedFile({
        name: `${arr.length} scripts selected`,
        size: arr.reduce((acc, f) => acc + (f?.size || 0), 0),
        pages: arr.length * 5,
        status: 'Batch ready',
        fileObj: arr[0] || null,
      });
    } else if (scriptMode === 'folder') {
      const arr = Array.from(fileList).filter(Boolean);
      setFolderFiles(arr);
      setSelectedFile({
        name: `Folder: ${arr.length} files`,
        size: arr.reduce((acc, f) => acc + (f?.size || 0), 0),
        pages: arr.length,
        status: 'Folder ready',
        fileObj: arr[0] || null,
      });
    }
  };

  const handleRemoveScript = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    setBatchFiles([]);
    setFolderFiles([]);
    if (scriptInputRef.current) scriptInputRef.current.value = '';
  };

  // Submit Handler
  const handleStartEvaluation = () => {
    if (rubricSource === 'upload' && !qpFile) {
      setQpError(true);
      if (typeof showToast === 'function') {
        showToast('⚠️ Please upload a Question Paper (.pdf, .jpg, .png) to proceed.');
      }
      return;
    }
    setQpError(false);

    if (typeof handleQuickIngest === 'function') {
      handleQuickIngest({
        scriptFile: selectedFile?.fileObj || null,
        batchFiles: scriptMode === 'batch' ? batchFiles : [],
        folderFiles: scriptMode === 'folder' ? folderFiles : [],
        scriptMode,
        rubricSource,
        questionPaperFile: qpFile,
        answerKeyFile: akFile,
        assessmentTitle: assessmentTitle || 'Assessment & Examination',
        className: currentClass || 'Academic Batch',
        saveToRubricLibrary,
        selectedExamId,
        strictness,
      });
    } else {
      setActiveView('workspace');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-[1300px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-[#475569] dark:text-[#7B8F82]">
            New evaluation
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#18241E] dark:text-[#F6F4EE] font-normal tracking-tight mt-1">
            Good evaluation starts here.
          </h1>
          <p className="text-xs md:text-sm text-[#475569] dark:text-[#8E9F94] mt-1 font-sans">
            Choose an assessment, add your scripts, and let SmartEd take the first pass.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="self-start sm:self-auto text-xs font-semibold text-[#18241E] dark:text-[#D8BE8B] hover:underline flex items-center gap-1.5 cursor-pointer"
        >
          <span>←</span>
          <span>Back to overview</span>
        </button>
      </div>

      {/* 3-Step Timeline Strip */}
      <div className="bg-[#EFECE4] dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-full p-1.5 flex items-center justify-between max-w-xl text-xs font-semibold shadow-sm">
        <div className="flex items-center gap-2 bg-[#18241E] text-white px-4 py-1.5 rounded-full shadow-sm">
          <span className="font-mono text-xs font-bold text-[#D8BE8B]">01</span>
          <span>Configure evaluation</span>
        </div>
        <span className="text-[#475569] dark:text-[#526659]">→</span>
        <div className="flex items-center gap-2 px-3 py-1.5 text-[#475569] dark:text-[#7B8F82]">
          <span className="font-mono text-xs font-bold">02</span>
          <span>AI processing</span>
        </div>
        <span className="text-[#475569] dark:text-[#526659]">→</span>
        <div className="flex items-center gap-2 px-3 py-1.5 text-[#475569] dark:text-[#7B8F82]">
          <span className="font-mono text-xs font-bold">03</span>
          <span>Teacher review</span>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 Cols): Crisp White Cards in Light Mode */}
        <div className="lg:col-span-8 space-y-5">
          {/* Card 01: Choose an Assessment */}
          <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-[#18241E] dark:text-[#D8BE8B]">
                  01
                </span>
                <h3 className="font-serif text-lg font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                  Choose an assessment
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#D97706] px-2.5 py-0.5 rounded-full">
                Required
              </span>
            </div>

            {/* Assessment Mode Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRubricSource('library');
                  setQpError(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  rubricSource === 'library'
                    ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                    : 'bg-[#F8F7F4] text-[#475569] hover:bg-[#EFECE4] border border-[#E3E1D8] dark:bg-transparent dark:text-[#A3B1A8]'
                }`}
              >
                <span>📖</span>
                <span>From saved exams</span>
              </button>
              <button
                type="button"
                onClick={() => setRubricSource('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  rubricSource === 'upload'
                    ? 'bg-[#18241E] text-white dark:bg-[#D8BE8B] dark:text-[#141D18] shadow-sm'
                    : 'bg-[#F8F7F4] text-[#475569] hover:bg-[#EFECE4] border border-[#E3E1D8] dark:bg-transparent dark:text-[#A3B1A8]'
                }`}
              >
                <span>📤</span>
                <span>Upload question paper &amp; key</span>
              </button>
            </div>

            {/* Sub-view A: From Rubric Library */}
            {rubricSource === 'library' ? (
              <div className="space-y-3">
                {(() => {
                  const activeLibExam = (libraryExams || []).find((e) => e.id === selectedExamId) || (libraryExams && libraryExams[0]);
                  return (
                    <div className="bg-[#FBF9F4] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-stone-200 dark:bg-[#202E27] flex items-center justify-center text-base shrink-0">
                          📄
                        </div>
                        <div>
                          <div className="font-serif font-semibold text-sm text-[#18241E] dark:text-[#F6F4EE]">
                            {activeLibExam?.title || 'Standard Assessment Blueprint'}
                          </div>
                          <div className="text-xs text-[#475569] dark:text-[#8E9F94] mt-0.5">
                            {activeLibExam?.class_name ? `${activeLibExam.class_name} · ` : ''}{activeLibExam?.max_marks || 60} marks · {activeLibExam?.questions?.length || 9} questions
                          </div>
                        </div>
                      </div>
                      <span className="w-6 h-6 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center text-xs font-bold shadow-sm">
                        ✓
                      </span>
                    </div>
                  );
                })()}

                {libraryExams && libraryExams.length > 1 && (
                  <div className="text-xs text-[#475569] dark:text-[#8E9F94] flex items-center justify-between px-1">
                    <span>Available templates in library: {libraryExams.length}</span>
                    <button
                      type="button"
                      onClick={() => setActiveView('rubric')}
                      className="text-[#2563EB] dark:text-[#D8BE8B] font-semibold hover:underline"
                    >
                      Browse full library →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Sub-view B: Upload Question Paper & Key */
              <div className="space-y-4 pt-1">
                {/* Dual File Pickers: Question Paper & Answer Key */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Question Paper File Picker */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-[#18241E] dark:text-[#F6F4EE] flex items-center gap-1.5">
                        <span>1. Question Paper</span>
                        <span className="text-[10px] font-bold text-[#DC2626] bg-[#FEE2E2] dark:bg-[#3E1A1A] px-1.5 py-0.2 rounded">
                          Required
                        </span>
                      </label>
                      {qpFile && (
                        <span className="text-[11px] font-mono text-[#16A34A] font-bold">
                          {formatFileSize(qpFile.size)}
                        </span>
                      )}
                    </div>

                    {!qpFile ? (
                      <div
                        onClick={() => qpInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingQp(true);
                        }}
                        onDragLeave={() => setIsDraggingQp(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingQp(false);
                          if (e.dataTransfer.files?.[0]) handleSelectQpFile(e.dataTransfer.files[0]);
                        }}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                          qpError
                            ? 'border-[#DC2626] bg-[#FEF2F2] dark:bg-[#2A1618]'
                            : isDraggingQp
                            ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#1C2922]'
                            : 'border-[#D6D3C9] dark:border-[#2D3F33] bg-[#FBF9F4] dark:bg-[#141D18] hover:border-[#16A34A]'
                        }`}
                      >
                        <div className="text-2xl mb-1">📄</div>
                        <div className="font-serif text-xs font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                          Drop Question Paper here or <span className="text-[#2563EB] underline font-bold">browse</span>
                        </div>
                        <div className="text-[10px] text-[#475569] dark:text-[#62776A] mt-1 font-mono">
                          PDF, JPG, PNG, WEBP (Max 25MB)
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#FBF9F4] dark:bg-[#141D18] border border-[#BBF7D0] dark:border-[#28392F] rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">📄</span>
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-bold text-[#18241E] dark:text-[#F6F4EE] truncate" title={qpFile?.name || ''}>
                              {qpFile?.name || ''}
                            </div>
                            <div className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-1">
                              <span>✓ Ready</span>
                              <span>·</span>
                              <span>{formatFileSize(qpFile.size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => qpInputRef.current?.click()}
                            className="text-[11px] font-semibold text-[#475569] hover:text-[#18241E] dark:text-[#A3B1A8] dark:hover:text-white px-2 py-1 rounded bg-stone-100 dark:bg-[#202E27] cursor-pointer"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveQpFile}
                            className="text-[11px] font-bold text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/40 p-1 px-2 rounded cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    <input
                      ref={qpInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSelectQpFile(e.target.files[0]);
                        }
                      }}
                    />
                  </div>

                  {/* 2. Answer Key / Model Rubric File Picker */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-[#18241E] dark:text-[#F6F4EE] flex items-center gap-1.5">
                        <span>2. Answer Key / Rubric</span>
                        <span className="text-[10px] text-stone-500 italic">Optional</span>
                      </label>
                      {akFile && (
                        <span className="text-[11px] font-mono text-[#2563EB] font-bold">
                          {formatFileSize(akFile.size)}
                        </span>
                      )}
                    </div>

                    {!akFile ? (
                      <div
                        onClick={() => akInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingAk(true);
                        }}
                        onDragLeave={() => setIsDraggingAk(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingAk(false);
                          if (e.dataTransfer.files?.[0]) handleSelectAkFile(e.dataTransfer.files[0]);
                        }}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                          isDraggingAk
                            ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#1E293B]'
                            : 'border-[#D6D3C9] dark:border-[#2D3F33] bg-[#FBF9F4] dark:bg-[#141D18] hover:border-[#2563EB]'
                        }`}
                      >
                        <div className="text-2xl mb-1">📜</div>
                        <div className="font-serif text-xs font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                          Drop Answer Key here or <span className="text-[#2563EB] underline font-bold">browse</span>
                        </div>
                        <div className="text-[10px] text-[#475569] dark:text-[#62776A] mt-1 font-mono">
                          PDF, Word, TXT, MD (Optional — leave blank if no answer key is needed)
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#FBF9F4] dark:bg-[#141D18] border border-[#BFDBFE] dark:border-[#28392F] rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">📜</span>
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-bold text-[#18241E] dark:text-[#F6F4EE] truncate" title={akFile?.name || ''}>
                              {akFile?.name || ''}
                            </div>
                            <div className="text-[10px] text-[#2563EB] font-semibold flex items-center gap-1">
                              <span>✓ Key Attached</span>
                              <span>·</span>
                              <span>{formatFileSize(akFile.size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => akInputRef.current?.click()}
                            className="text-[11px] font-semibold text-[#475569] hover:text-[#18241E] dark:text-[#A3B1A8] dark:hover:text-white px-2 py-1 rounded bg-stone-100 dark:bg-[#202E27] cursor-pointer"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveAkFile}
                            className="text-[11px] font-bold text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/40 p-1 px-2 rounded cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    <input
                      ref={akInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.txt,.md,.docx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSelectAkFile(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Metadata Inputs Row: Title, Class, Branch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82] mb-1">
                      Assessment title
                    </label>
                    <input
                      type="text"
                      value={assessmentTitle}
                      onChange={(e) => setAssessmentTitle(e.target.value)}
                      placeholder="e.g. Operating Systems MST-II"
                      className="w-full px-3 py-2 rounded-lg bg-[#FBF9F4] dark:bg-[#141D18] border border-[#D6D3C9] dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#7B8F82] mb-1">
                      Class &amp; Branch
                    </label>
                    <input
                      type="text"
                      value={currentClass}
                      onChange={(e) => setCurrentClass(e.target.value)}
                      placeholder="e.g. B.Tech (CSE) · Semester 4"
                      className="w-full px-3 py-2 rounded-lg bg-[#FBF9F4] dark:bg-[#141D18] border border-[#D6D3C9] dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                    />
                  </div>
                </div>

                {/* Save to Rubric Library Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="save-rubric-checkbox"
                    type="checkbox"
                    checked={saveToRubricLibrary}
                    onChange={(e) => setSaveToRubricLibrary(e.target.checked)}
                    className="w-4 h-4 rounded text-[#16A34A] focus:ring-[#16A34A] border-stone-300 dark:border-[#28392F] cursor-pointer"
                  />
                  <label htmlFor="save-rubric-checkbox" className="text-xs text-[#475569] dark:text-[#A3B1A8] cursor-pointer font-medium select-none">
                    Save to Saved Exams for future cohort reuse
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Card 02: Add Answer Scripts */}
          <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-[#18241E] dark:text-[#D8BE8B]">
                  02
                </span>
                <h3 className="font-serif text-lg font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                  Add answer scripts
                </h3>
              </div>

              {/* Mode Toggles */}
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setScriptMode('single')}
                  className={`pb-0.5 cursor-pointer ${
                    scriptMode === 'single'
                      ? 'border-b-2 border-[#18241E] dark:border-[#D8BE8B] font-bold text-[#18241E] dark:text-[#F6F4EE]'
                      : 'text-[#475569] dark:text-[#7B8F82]'
                  }`}
                >
                  Single script
                </button>
                <button
                  type="button"
                  onClick={() => setScriptMode('batch')}
                  className={`pb-0.5 cursor-pointer ${
                    scriptMode === 'batch'
                      ? 'border-b-2 border-[#18241E] dark:border-[#D8BE8B] font-bold text-[#18241E] dark:text-[#F6F4EE]'
                      : 'text-[#475569] dark:text-[#7B8F82]'
                  }`}
                >
                  Batch
                </button>
                <button
                  type="button"
                  onClick={() => setScriptMode('folder')}
                  className={`pb-0.5 cursor-pointer ${
                    scriptMode === 'folder'
                      ? 'border-b-2 border-[#18241E] dark:border-[#D8BE8B] font-bold text-[#18241E] dark:text-[#F6F4EE]'
                      : 'text-[#475569] dark:text-[#7B8F82]'
                  }`}
                >
                  Folder / ZIP
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => scriptInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingScript(true);
              }}
              onDragLeave={() => setIsDraggingScript(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingScript(false);
                if (e.dataTransfer.files) handleSelectScriptFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors group ${
                isDraggingScript
                  ? 'border-[#16A34A] bg-[#F0FDF4] dark:bg-[#1C2922]'
                  : 'border-[#D6D3C9] dark:border-[#2D3F33] bg-[#FBF9F4] dark:bg-[#141D18] hover:border-[#16A34A] dark:hover:border-[#D8BE8B]'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-[#202E27] text-[#2563EB] dark:text-[#D8BE8B] mx-auto flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition-transform">
                📤
              </div>
              <div className="font-serif text-sm font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                Drop your answer scripts here
              </div>
              <div className="text-xs text-[#475569] dark:text-[#8E9F94] mt-0.5">
                or <span className="underline font-bold text-[#2563EB]">browse files</span>
              </div>
              <div className="text-[11px] text-[#475569] dark:text-[#62776A] mt-2 font-mono">
                {scriptMode === 'single'
                  ? 'PDF, JPG, PNG · Multiple pages supported'
                  : scriptMode === 'batch'
                  ? 'Select multiple PDF copies for batch grading'
                  : 'Folder of student PDF copies or .ZIP archive'}
              </div>

              <input
                ref={scriptInputRef}
                type="file"
                className="hidden"
                multiple={scriptMode !== 'single'}
                accept=".pdf,.png,.jpg,.jpeg,.zip"
                onChange={(e) => {
                  if (e.target.files) handleSelectScriptFiles(e.target.files);
                }}
              />
            </div>

            {/* Uploaded File Pill */}
            {selectedFile && (
              <div className="bg-[#FBF9F4] dark:bg-[#141D18] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">📄</span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-[#18241E] dark:text-[#F6F4EE] truncate" title={selectedFile?.name || ''}>
                      {selectedFile?.name || ''}
                    </div>
                    <div className="text-[11px] text-[#475569] dark:text-[#7B8F82]">
                      {selectedFile.pages} pages · {selectedFile.status}
                      {selectedFile.size > 0 && ` · ${formatFileSize(selectedFile.size)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold bg-[#DCFCE7] text-[#16A34A] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    ✓ Uploaded
                  </span>
                  {selectedFile.fileObj && (
                    <button
                      type="button"
                      onClick={handleRemoveScript}
                      className="text-xs text-stone-400 hover:text-red-500 p-1 cursor-pointer"
                      title="Clear uploaded script"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card 03: Set Evaluation Strictness */}
          <div className="bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-[#18241E] dark:text-[#D8BE8B]">
                  03
                </span>
                <h3 className="font-serif text-lg font-semibold text-[#18241E] dark:text-[#F6F4EE]">
                  Set evaluation strictness
                </h3>
              </div>
              <span className="text-xs font-bold bg-[#F8F7F4] dark:bg-[#202E27] text-[#18241E] dark:text-[#D8BE8B] px-2.5 py-0.5 rounded-full border border-[#E3E1D8]">
                {strictness} / 10 · {getStrictnessLabel(strictness)}
              </span>
            </div>

            <p className="text-xs text-[#475569] dark:text-[#8E9F94]">
              A balanced first pass with fair partial credit. You can adjust this later in the workspace.
            </p>

            <div className="pt-2">
              <input
                type="range"
                min="1"
                max="10"
                value={strictness}
                onChange={(e) => setStrictness && setStrictness(Number(e.target.value))}
                className="w-full accent-[#16A34A] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] text-[#475569] dark:text-[#7B8F82] font-semibold mt-1">
                <span>Lenient</span>
                <span>Balanced</span>
                <span>Rigorous</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 Cols): Dark Botanical Forest Card (Remains Dark by Design) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#18241E] text-white rounded-2xl p-6 border border-[#2A3B30] shadow-xl space-y-4">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#8E9F94]">
              Your evaluation
            </div>
            <h3 className="font-serif text-2xl font-normal text-[#F6F4EE]">
              Ready for a closer look.
            </h3>

            {/* 3D Cream Exam Dossier Booklet */}
            <div className="bg-[#F6F2E8] text-[#141D18] rounded-xl p-5 border border-[#E0D8C8] shadow-inner text-center space-y-1.5 my-3 transform hover:scale-[1.01] transition-transform">
              <div className="text-[9px] font-bold tracking-widest uppercase text-stone-500">
                University Examination Studio
              </div>
              <div className="font-serif text-2xl font-bold tracking-tight text-[#141D18] truncate px-1">
                {assessmentTitle || 'Academic Assessment'}
              </div>
              <div className="text-[10px] font-semibold text-stone-600 tracking-wider uppercase">
                {rubricSource === 'upload' ? 'Standard Examination' : 'Term Assessment Blueprint'}
              </div>
              <div className="text-[11px] text-stone-600 pt-2 border-t border-stone-300/70 mt-2 font-medium">
                {currentClass || 'Academic Cohort'}
              </div>
              <div className="text-[11px] font-mono text-stone-500 font-semibold">
                60 marks / Question-paper aligned
              </div>
            </div>

            {/* Summary Details Updating Live */}
            <div className="space-y-2 text-xs pt-1 divide-y divide-[#28392F]">
              {/* Answer Scripts Row */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#8E9F94]">Answer scripts</span>
                <span className="font-semibold text-[#F6F4EE] truncate max-w-[170px]" title={selectedFile?.name || ''}>
                  {selectedFile?.name
                    ? `${selectedFile?.name}${selectedFile?.size ? ` (${formatFileSize(selectedFile.size)})` : ''}`
                    : scriptMode === 'batch' && batchFiles.length > 0
                    ? `${batchFiles.length} scripts`
                    : scriptMode === 'folder' && folderFiles.length > 0
                    ? `${folderFiles.length} scripts`
                    : 'No script selected'}
                </span>
              </div>

              {/* Question Paper Row */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#8E9F94]">Question paper</span>
                {rubricSource === 'upload' ? (
                  qpFile ? (
                    <span className="font-semibold text-[#D8BE8B] truncate max-w-[170px]" title={qpFile?.name || ''}>
                      {qpFile?.name || ''}
                    </span>
                  ) : (
                    <span className="text-[#F87171] font-bold text-[11px]">⚠️ Upload required</span>
                  )
                ) : (
                  <span className="font-semibold text-[#F6F4EE]">Library template</span>
                )}
              </div>

              {/* Answer Key Row */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#8E9F94]">Answer key</span>
                {rubricSource === 'upload' ? (
                  akFile ? (
                    <span className="font-semibold text-[#D8BE8B] truncate max-w-[170px]" title={akFile?.name || ''}>
                      {akFile?.name || ''}
                    </span>
                  ) : (
                    <span className="text-[#A3B1A8] font-medium italic">Standard Auto-Marking (No key needed)</span>
                  )
                ) : (
                  <span className="font-semibold text-[#F6F4EE]">Institutional 60m Key</span>
                )}
              </div>

              {/* Strictness Row */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#8E9F94]">Strictness</span>
                <span className="font-semibold text-[#F6F4EE]">{strictness}/10 · {getStrictnessLabel(strictness)}</span>
              </div>
            </div>

            {/* Start AI Evaluation Button */}
            <button
              type="button"
              disabled={isUploading}
              onClick={handleStartEvaluation}
              className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 group mt-2 ${
                isUploading
                  ? 'bg-stone-600 text-stone-300 cursor-not-allowed opacity-80'
                  : 'bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18]'
              }`}
            >
              <span>{isUploading ? 'Inscribing & Evaluating...' : 'Start AI evaluation'}</span>
              {!isUploading && <span className="group-hover:translate-x-1 transition-transform">→</span>}
            </button>

            <div className="text-[11px] text-center text-[#8E9F94]">
              You review every mark before it's final.
            </div>
          </div>

          {/* Teacher Judgment Callout Card */}
          <div className="bg-[#DCFCE7] dark:bg-[#1A251F] border border-[#BBF7D0] dark:border-[#28392F] rounded-xl p-4 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#16A34A] dark:text-[#4ADE80] font-bold text-sm">✓</span>
              <span className="font-serif text-xs font-bold text-[#141D18] dark:text-[#F6F4EE]">
                Your judgment. Always.
              </span>
            </div>
            <p className="text-[11px] text-[#15803D] dark:text-[#8E9F94] leading-relaxed font-medium">
              AI suggests scores against your uploaded question paper and rubric. Review, annotate, or override any mark before releasing the final report.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-6 border-t border-[#E3E1D8] dark:border-[#28392F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#475569] dark:text-[#7B8F82]">
        <div>Automated page alignment · Reading handwriting · Marking guide alignment</div>
        <div>Secure, teacher-controlled evaluation</div>
      </footer>
    </div>
  );
}
