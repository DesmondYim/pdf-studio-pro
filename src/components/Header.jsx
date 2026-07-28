import React from 'react';

const IconFilePdf = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const IconMerge = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const IconSplit = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
  </svg>
);

/**
 * Header component providing app title branding and main tab navigation.
 * Uses default prop values and defensive guards to prevent runtime crashes.
 */
export default function Header({ activeTab = 'merger', setActiveTab }) {
  // Defensive helper function to safely trigger tab changes
  const handleTabChange = (tabName) => {
    if (typeof setActiveTab === 'function') {
      setActiveTab(tabName);
    } else {
      console.warn(`[Header] setActiveTab prop was not provided as a function.`);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <IconFilePdf />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              PDF Studio Pro
            </h1>
            <p className="text-xs text-slate-400 mt-1">Client-Side PDF Manipulator</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleTabChange('merger')}
            className={`flex items-center px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'merger'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <IconMerge />
            <span>Merge PDFs</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('splitter')}
            className={`flex items-center px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'splitter'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <IconSplit />
            <span>Split & Extract</span>
          </button>
        </nav>

      </div>
    </header>
  );
}