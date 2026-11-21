import React from 'react';

export default function SidebarRail({
  activeView,
  setActiveView,
  pendingCount = 14,
  totalCount = 18,
  verifiedCount = 4,
  currentUser = null,
  onOpenAuthModal,
  onSignOut,
}) {
  const navItems = [
    {
      id: 'home',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: 'upload',
      label: 'Upload Papers',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      id: 'workspace',
      label: 'Evaluation',
      badge: pendingCount,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'analytics',
      label: 'Class Analytics',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'rubric',
      label: 'Saved Exams',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const verifiedPct = Math.round((verifiedCount / (totalCount || 1)) * 100);

  return (
    <aside className="w-[230px] min-h-screen bg-[#141D18] text-[#A3B1A8] flex flex-col justify-between p-4 border-r border-[#233129] shrink-0 sticky top-0 h-screen select-none z-30">
      {/* Top Branding & Workspace Switcher */}
      <div className="space-y-4">
        {/* Brand Crest & Title */}
        <div
          onClick={() => setActiveView('landing')}
          title="Return to SmartEd Introduction page"
          className="flex items-center gap-2.5 cursor-pointer group px-1 pt-1"
        >
          <div className="w-9 h-9 rounded-lg bg-[#D8BE8B] flex items-center justify-center text-[#141D18] font-serif font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
            S
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-[17px] font-semibold text-[#F6F4EE] leading-tight tracking-wide group-hover:text-[#D8BE8B] transition-colors">
              SmartEd
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[#7B8F82] font-semibold">
              Evaluation Studio
            </span>
          </div>
        </div>

        {/* Workspace Pill */}
        <div className="bg-[#18241E] border border-[#26372D] hover:border-[#354C3E] rounded-xl px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors group">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8F82]">Faculty</span>
            <span className="text-xs font-medium text-[#E4EDE7] group-hover:text-white transition-colors">Workspace</span>
          </div>
          <svg className="w-3.5 h-3.5 text-[#7B8F82] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Workspace Navigation */}
        <div className="pt-2">
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#62776A] px-2.5 mb-2">
            Workspace
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeView === item.id || (item.id === 'workspace' && activeView === 'evaluation');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#D8BE8B] text-[#141D18] font-semibold shadow-sm'
                      : 'text-[#A3B1A8] hover:text-[#F6F4EE] hover:bg-[#1A251F]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-[#141D18]' : 'text-[#7B8F82]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#141D18] text-[#D8BE8B]'
                          : 'bg-[#223127] text-[#D8BE8B]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Middle/Bottom Widget & Account */}
      <div className="space-y-4 pt-4 border-t border-[#233129]">
        {/* Verification Progress Banner */}
        <div className="bg-[#18241E] border border-[#26372D] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-serif text-xs font-semibold text-[#F6F4EE]">A little more to go.</span>
          </div>
          <p className="text-[11px] text-[#86998D] leading-tight">
            {verifiedCount} of {totalCount} scripts verified
          </p>
          <div className="w-full bg-[#111814] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#D8BE8B] h-full rounded-full transition-all duration-300"
              style={{ width: `${verifiedPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setActiveView('workspace')}
            className="w-full pt-1 flex items-center justify-between text-[11px] font-medium text-[#D8BE8B] hover:text-[#ebd5a7] transition-colors cursor-pointer group"
          >
            <span>Continue reviewing</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
        </div>

        {/* Secondary Links & Profile */}
        <div className="space-y-1 text-xs">
          <button
            type="button"
            onClick={() => window.open('https://github.com', '_blank')}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#86998D] hover:text-[#F6F4EE] hover:bg-[#1A251F] transition-colors"
          >
            <span className="text-xs">?</span>
            <span>Help & resources</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('rubric')}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#86998D] hover:text-[#F6F4EE] hover:bg-[#1A251F] transition-colors"
          >
            <span className="text-xs">⚙</span>
            <span>Settings</span>
          </button>

          {/* Educator Account Row */}
          <div
            onClick={currentUser ? onSignOut : onOpenAuthModal}
            title={currentUser ? "Click to Sign Out" : "Click to Sign In"}
            className="pt-2 flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#18241E] border border-[#233129] cursor-pointer hover:bg-[#202E27] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-[#D8BE8B]/20 border border-[#D8BE8B]/50 flex items-center justify-center text-[10px] font-bold text-[#D8BE8B] shrink-0">
                {currentUser?.initials || 'EA'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-medium text-[#E4EDE7] truncate">
                  {currentUser?.name || 'Educator Account'}
                </span>
                <span className="text-[9px] text-[#7B8F82] truncate">
                  {currentUser ? 'Click to Sign Out' : 'Sign In to Studio'}
                </span>
              </div>
            </div>
            <svg className="w-3.5 h-3.5 text-[#7B8F82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </aside>
  );
}
