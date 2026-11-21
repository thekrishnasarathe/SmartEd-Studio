import React, { useState, useRef, useEffect } from 'react';

export default function TopHeader({
  activeView,
  searchQuery,
  setSearchQuery,
  isReportLightMode,
  setIsReportLightMode,
  currentUser = null,
  onOpenAuthModal,
  onSignOut,
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);
  const getBreadcrumb = () => {
    switch (activeView) {
      case 'landing':
        return 'Introduction';
      case 'home':
        return 'Overview';
      case 'upload':
        return 'Upload Papers';
      case 'workspace':
      case 'evaluation':
        return 'Evaluation';
      case 'analytics':
        return 'Class Analytics';
      case 'rubric':
        return 'Saved Exams';
      default:
        return 'Overview';
    }
  };

  return (
    <header className="h-14 border-b border-[#E3E1D8] dark:border-[#233129] bg-white/95 dark:bg-[#141D18]/90 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-20 transition-colors shadow-sm">
      {/* Breadcrumb Left */}
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="text-[#475569] dark:text-[#7B8F82]">Workspace</span>
        <span className="text-stone-400 dark:text-[#526659]">/</span>
        <span className="text-[#18241E] dark:text-[#F6F4EE]">
          {getBreadcrumb()}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Search Input ⌘K */}
        <div className="relative hidden sm:block">
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-56 lg:w-64 pl-8 pr-9 py-1.5 rounded-lg bg-white dark:bg-[#18241E] border border-[#D6D3C9] dark:border-[#28392F] text-xs text-[#18241E] dark:text-[#F6F4EE] placeholder:text-[#94A3B8] dark:placeholder:text-[#6A7E72] focus:outline-none focus:ring-1 focus:ring-[#16A34A] font-medium shadow-sm"
          />
          <svg className="w-3.5 h-3.5 text-[#475569] dark:text-[#6A7E72] absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-[#475569] dark:text-[#6A7E72] bg-stone-100 dark:bg-[#121A15] px-1.5 py-0.5 rounded border border-[#E3E1D8] dark:border-[#233129]">
            ⌘K
          </kbd>
        </div>

        {/* Dark / Light Toggle */}
        <button
          type="button"
          onClick={() => setIsReportLightMode(!isReportLightMode)}
          title={`Switch to ${isReportLightMode ? 'Dark Botanical' : 'Editorial Ivory'} mode`}
          className="p-2 rounded-lg text-[#18241E] dark:text-[#A3B1A8] hover:bg-stone-100 dark:hover:bg-[#1F2C24] transition-colors cursor-pointer border border-[#E3E1D8] dark:border-transparent"
        >
          {isReportLightMode ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {/* Bell Notification */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-[#18241E] dark:text-[#A3B1A8] hover:bg-stone-100 dark:hover:bg-[#1F2C24] transition-colors cursor-pointer border border-[#E3E1D8] dark:border-transparent"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="w-1.5 h-1.5 bg-[#D8BE8B] rounded-full absolute top-1.5 right-1.5" />
        </button>

        {/* Faculty Profile Pill / Sign In */}
        <div className="relative" ref={profileRef}>
          {currentUser ? (
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 pl-2 border-l border-[#E3E1D8] dark:border-[#28392F] cursor-pointer group text-left"
            >
              <div className="w-7 h-7 rounded-full bg-[#18241E] dark:bg-[#D8BE8B] flex items-center justify-center text-xs font-serif font-bold text-[#F6F4EE] dark:text-[#141D18] shadow-sm">
                {currentUser?.initials || 'FE'}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-bold text-[#18241E] dark:text-[#F6F4EE] leading-tight truncate max-w-[130px]">
                  {currentUser?.name || 'Faculty Member'}
                </span>
                <span className="text-[10px] text-[#475569] dark:text-[#7B8F82] font-semibold truncate max-w-[130px]">
                  {currentUser?.dept || 'Educator Account'}
                </span>
              </div>
              <svg className="w-3 h-3 text-[#7B8F82] group-hover:text-[#18241E] dark:group-hover:text-white transition-colors ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D8BE8B] hover:bg-[#ebd5a7] text-[#141D18] font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <span>Faculty Sign In</span>
            </button>
          )}

          {/* Profile Dropdown */}
          {isProfileOpen && currentUser && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#18241E] border border-[#E3E1D8] dark:border-[#28392F] shadow-xl p-3 space-y-2 z-50 animate-scale-up text-xs">
              <div className="border-b border-[#E3E1D8] dark:border-[#28392F] pb-2">
                <div className="font-bold text-[#18241E] dark:text-[#F6F4EE] truncate">{currentUser?.name || 'Educator'}</div>
                <div className="text-[10px] text-[#7B8F82] truncate">{currentUser?.email || ''}</div>
                <div className="text-[10px] font-semibold text-[#D8BE8B] truncate mt-0.5">{currentUser?.dept || ''}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  if (onSignOut) onSignOut();
                }}
                className="w-full text-left px-2 py-1.5 rounded-lg text-[#DC2626] dark:text-[#F87171] hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold cursor-pointer transition-colors flex items-center justify-between"
              >
                <span>Sign Out</span>
                <span>🚪</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
