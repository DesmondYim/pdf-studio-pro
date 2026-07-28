import React from 'react';

/**
 * PreviewModal Component
 * Renders an accessible modal overlay with an embedded PDF preview iframe 
 * and direct download link for generated blobs.
 *
 * @param {Object} props
 * @param {string|null} props.pdfUrl - Blob URL of the generated PDF document
 * @param {string} props.filename - Target output filename for download
 * @param {Function} props.onClose - Callback to dismiss modal and revoke Blob URL
 */
export default function PreviewModal({ pdfUrl, filename = 'document.pdf', onClose }) {
  // If no PDF URL is present, do not render the modal overlay
  if (!pdfUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden transform transition-all">
        
        {/* Modal Header Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
            <h3 id="modal-title" className="font-semibold text-slate-100 text-sm sm:text-base">
              Processed PDF Preview
            </h3>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href={pdfUrl}
              download={filename || 'document.pdf'}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download PDF</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Main Body / Iframe Viewport */}
        <div className="flex-1 bg-slate-950 relative">
          <iframe 
            src={pdfUrl} 
            className="w-full h-full border-none rounded-b-2xl" 
            title="PDF Document Preview" 
          />
        </div>

      </div>
    </div>
  );
}