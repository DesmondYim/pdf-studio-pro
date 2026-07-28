import React, { useState, useEffect, useRef } from 'react';


/**
 * Reads array buffer metadata for a PDF file using window.PDFLib
 */
async function getPdfMetadata(buffer) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib not loaded");
    const pdfDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    return { pageCount: pdfDoc.getPageCount() };
  } catch (error) {
    console.error("Error reading PDF metadata:", error);
    throw new Error("Unable to parse PDF metadata.");
  }
}

/**
 * Merges multiple PDF ArrayBuffers into a single downloadable PDF Blob URL
 */
async function mergePdfBuffers(buffers) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib not loaded");
    const mergedPdf = await window.PDFLib.PDFDocument.create();

    for (const buffer of buffers) {
      const srcDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error merging PDFs:", error);
    throw new Error("Failed to merge PDF files.");
  }
}

/**
 * Parses user page range input string like "1-3, 5, 8-10" into numeric array
 */
function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  const parts = rangeStr.split(',');

  for (let part of parts) {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          pages.add(i);
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pages.add(pageNum);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}


/**
 * Extracts selected pages from a PDF buffer with optional rotations
 */
async function extractPdfPages(srcBuffer, selectedPages, rotations = {}) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib not loaded");
    const srcDoc = await window.PDFLib.PDFDocument.load(srcBuffer, { ignoreEncryption: true });
    const newPdf = await window.PDFLib.PDFDocument.create();

    const pageIndices = selectedPages.map(p => p - 1);
    const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);

    copiedPages.forEach((page, idx) => {
      const originalPageNum = selectedPages[idx];
      const rot = rotations[originalPageNum] || 0;
      if (rot !== 0) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(window.PDFLib.degrees(currentRotation + rot));
      }
      newPdf.addPage(page);
    });

    const pdfBytes = await newPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error extracting PDF pages:", error);
    throw new Error("Failed to extract pages from PDF.");
  }
}

/**
 * Formats byte counts into clean readable strings (KB, MB)
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}


function Header({ activeTab = 'merger', setActiveTab }) {
  const handleTabChange = (tabName) => {
    if (typeof setActiveTab === 'function') {
      setActiveTab(tabName);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        
        {/* Simple Brand Header */}
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center text-slate-300 font-mono text-xs font-bold">
            PDF
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-slate-100 tracking-tight">PDF Studio</span>
            <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">v1.0</span>
          </div>
        </div>

        {/* Minimal Tab Selector */}
        <nav className="flex space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => handleTabChange('merger')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'merger'
                ? 'bg-slate-800 text-slate-100 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Merge Files
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('splitter')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'splitter'
                ? 'bg-slate-800 text-slate-100 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Split & Extract
          </button>
        </nav>
      </div>
    </header>
  );
}


function PdfMerger({ onMergeComplete, showToast }) {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [outputName, setOutputName] = useState('merged-document.pdf');
  const fileInputRef = useRef(null);

  const handleAddFiles = async (e) => {
    const rawFiles = Array.from(e.target.files || e.dataTransfer?.files || []).filter(
      file => file.type === 'application/pdf'
    );

    if (rawFiles.length === 0) {
      if (typeof showToast === 'function') showToast('Please select valid PDF files.', 'error');
      return;
    }

    const loadedFiles = [];

    for (const file of rawFiles) {
      try {
        const buffer = await file.arrayBuffer();
        const { pageCount } = await getPdfMetadata(buffer);

        loadedFiles.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          pageCount,
          buffer
        });
      } catch (err) {
        if (typeof showToast === 'function') showToast(`Failed to parse ${file.name}`, 'error');
      }
    }

    setFiles(prev => [...prev, ...loadedFiles]);
    if (typeof showToast === 'function') {
      showToast(`Added ${loadedFiles.length} file(s)`, 'success');
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const moveFile = (index, direction) => {
    const updated = [...files];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFiles(updated);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      if (typeof showToast === 'function') showToast('Add at least 2 PDF files to merge.', 'error');
      return;
    }

    setIsMerging(true);
    try {
      const buffers = files.map(f => f.buffer);
      const pdfUrl = await mergePdfBuffers(buffers);
      if (typeof onMergeComplete === 'function') {
        onMergeComplete(pdfUrl, outputName || 'merged-document.pdf');
      }
      if (typeof showToast === 'function') showToast('PDFs merged successfully', 'success');
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Failed to merge PDF files.', 'error');
      }
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = files.reduce((acc, f) => acc + f.pageCount, 0);
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-5">
      {/* Clean Drag-and-Drop Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleAddFiles(e);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900 rounded-lg p-8 text-center cursor-pointer transition-colors group"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAddFiles}
          multiple
          accept="application/pdf"
          className="hidden"
        />
        <div className="flex flex-col items-center space-y-2">
          <svg className="w-6 h-6 text-slate-400 group-hover:text-slate-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <div className="text-xs font-medium text-slate-200">
            Click to upload or drag and drop PDFs here
          </div>
          <p className="text-[11px] text-slate-500">Supports multiple files simultaneously</p>
        </div>
      </div>

      {/* Structured Queue Table */}
      {files.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-800">
            <span className="font-medium text-slate-300">File Queue ({files.length})</span>
            <span className="font-mono text-slate-500">
              {totalPages} pages • {formatBytes(totalSize)}
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded bg-slate-950/40">
            {files.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-900/60 transition-colors"
              >
                <div className="flex items-center space-x-3 overflow-hidden pr-2">
                  <span className="font-mono text-[11px] text-slate-500 w-4 text-center">{idx + 1}</span>
                  <div className="truncate">
                    <p className="font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      {item.pageCount} pages • {formatBytes(item.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveFile(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(idx, 1)}
                    disabled={idx === files.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors ml-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Controls Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs">
              <label className="text-slate-400 shrink-0">Output:</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-slate-600 text-slate-200 w-full sm:w-56 font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleMerge}
              disabled={isMerging}
              className="px-4 py-1.5 bg-slate-100 hover:bg-white text-slate-900 font-medium text-xs rounded transition-colors disabled:opacity-50"
            >
              {isMerging ? 'Merging...' : 'Merge PDFs'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function PdfSplitter({ onSplitComplete, showToast }) {
  const [splitFile, setSplitFile] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [rangeInput, setRangeInput] = useState('');
  const [pageRotations, setPageRotations] = useState({});
  const [isSplitting, setIsSplitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileAdd = async (e) => {
    const file = (e.target.files || e.dataTransfer?.files || [])[0];
    if (!file || file.type !== 'application/pdf') {
      if (typeof showToast === 'function') showToast('Please select a valid PDF file.', 'error');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const { pageCount } = await getPdfMetadata(buffer);

      setSplitFile({
        file,
        name: file.name,
        size: file.size,
        buffer,
        totalPages: pageCount
      });

      const initialPages = Array.from({ length: pageCount }, (_, i) => i + 1);
      setSelectedPages(initialPages);
      setRangeInput(initialPages.join(', '));
      setPageRotations({});

      if (typeof showToast === 'function') showToast(`Loaded ${file.name}`, 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast('Failed to parse PDF document.', 'error');
    }
  };

  const togglePage = (pageNum) => {
    setSelectedPages(prev => {
      const next = prev.includes(pageNum)
        ? prev.filter(p => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setRangeInput(next.join(', '));
      return next;
    });
  };

  const rotatePage = (pageNum) => {
    setPageRotations(prev => ({
      ...prev,
      [pageNum]: ((prev[pageNum] || 0) + 90) % 360
    }));
  };

  const handleRangeInputChange = (e) => {
    const val = e.target.value;
    setRangeInput(val);
    if (splitFile) {
      const parsed = parsePageRange(val, splitFile.totalPages);
      setSelectedPages(parsed);
    }
  };

  const handleSplit = async () => {
    if (!splitFile || selectedPages.length === 0) {
      if (typeof showToast === 'function') showToast('Select at least one page to extract.', 'error');
      return;
    }

    setIsSplitting(true);
    try {
      const pdfUrl = await extractPdfPages(splitFile.buffer, selectedPages, pageRotations);
      const outputName = `extracted-${splitFile.name}`;
      if (typeof onSplitComplete === 'function') onSplitComplete(pdfUrl, outputName);
      if (typeof showToast === 'function') showToast(`Extracted ${selectedPages.length} pages`, 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast('Error extracting pages.', 'error');
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {!splitFile ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileAdd(e);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900 rounded-lg p-10 text-center cursor-pointer transition-colors group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileAdd}
            accept="application/pdf"
            className="hidden"
          />
          <div className="flex flex-col items-center space-y-2">
            <svg className="w-6 h-6 text-slate-400 group-hover:text-slate-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5M3.75 12h16.5" />
            </svg>
            <div className="text-xs font-medium text-slate-200">
              Select a PDF file to split or extract
            </div>
            <p className="text-[11px] text-slate-500">Supports custom ranges and page rotations</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Info Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs">
            <div>
              <span className="font-medium text-slate-200">{splitFile.name}</span>
              <span className="text-slate-500 font-mono ml-2">
                ({splitFile.totalPages} pages • {formatBytes(splitFile.size)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[11px]"
            >
              Change File
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileAdd} accept="application/pdf" className="hidden" />
          </div>

          {/* Page Range Input Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300 font-medium">Page Selection Range</label>
              <div className="space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    const all = Array.from({ length: splitFile.totalPages }, (_, i) => i + 1);
                    setSelectedPages(all);
                    setRangeInput(all.join(', '));
                  }}
                  className="text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPages([]);
                    setRangeInput('');
                  }}
                  className="text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              value={rangeInput}
              onChange={handleRangeInputChange}
              placeholder="e.g. 1-3, 5, 8-10"
              className="w-full bg-slate-950 border border-slate-800 text-xs rounded px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Page Grid Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
              {Array.from({ length: splitFile.totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = selectedPages.includes(pageNum);
                const rot = pageRotations[pageNum] || 0;

                return (
                  <div
                    key={pageNum}
                    onClick={() => togglePage(pageNum)}
                    className={`relative cursor-pointer bg-slate-950 rounded border p-2 text-center transition-all ${
                      isSelected ? 'border-slate-400 bg-slate-900/90' : 'border-slate-800 opacity-40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(pageNum);
                      }}
                      className="absolute top-1 right-1 text-[10px] bg-slate-800 hover:bg-slate-700 px-1 py-0.5 rounded text-slate-300"
                      title="Rotate 90°"
                    >
                      ↻
                    </button>
                    <div className="text-xs font-mono font-medium text-slate-300 mt-2">
                      p. {pageNum}
                    </div>
                    {rot > 0 && <span className="text-[10px] font-mono text-amber-400">{rot}°</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extract Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSplit}
              disabled={isSplitting || selectedPages.length === 0}
              className="px-4 py-1.5 bg-slate-100 hover:bg-white text-slate-900 font-medium text-xs rounded transition-colors disabled:opacity-50"
            >
              {isSplitting ? 'Extracting...' : `Extract Pages (${selectedPages.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function PreviewModal({ pdfUrl, filename, onClose }) {
  if (!pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col shadow-xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span className="font-medium text-slate-200">PDF Preview</span>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={pdfUrl}
              download={filename || 'document.pdf'}
              className="px-3 py-1 bg-slate-100 hover:bg-white text-slate-900 font-medium rounded transition-colors"
            >
              Download PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 px-2 py-1 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Iframe */}
        <div className="flex-1 bg-slate-950">
          <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Preview" />
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [activeTab, setActiveTab] = useState('merger');
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewFilename, setPreviewFilename] = useState('processed-document.pdf');
  const [toast, setToast] = useState(null);
  const [isLibLoaded, setIsLibLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadScript = async () => {
      if (!window.PDFLib) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        script.onload = () => {
          if (isMounted) setIsLibLoaded(true);
        };
        document.head.appendChild(script);
      } else {
        if (isMounted) setIsLibLoaded(true);
      }
    };
    loadScript();
    return () => { isMounted = false; };
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePdfGenerated = (url, name) => {
    setPreviewPdfUrl(url);
    if (name) setPreviewFilename(name);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased text-xs">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {!isLibLoaded ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 rounded-lg border border-slate-800 my-8">
            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-400 text-xs font-mono">Initializing PDF engine...</p>
          </div>
        ) : (
          <>
            {activeTab === 'merger' && (
              <PdfMerger onMergeComplete={handlePdfGenerated} showToast={showToast} />
            )}

            {activeTab === 'splitter' && (
              <PdfSplitter onSplitComplete={handlePdfGenerated} showToast={showToast} />
            )}
          </>
        )}
      </main>

      {/* Preview Modal */}
      <PreviewModal
        pdfUrl={previewPdfUrl}
        filename={previewFilename}
        onClose={() => {
          if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
          setPreviewPdfUrl(null);
        }}
      />

      {/* Minimal Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`px-3 py-2 rounded border shadow-lg text-xs font-mono ${
              toast.type === 'error'
                ? 'bg-red-950 text-red-200 border-red-800'
                : toast.type === 'success'
                ? 'bg-slate-900 text-slate-200 border-slate-700'
                : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}