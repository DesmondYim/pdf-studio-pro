import React, { useState, useRef } from 'react';

/**
 * Reads array buffer metadata for a PDF file using PDFLib
 */
async function getPdfMetadata(buffer) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib library is not loaded");
    const pdfDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    return { pageCount: pdfDoc.getPageCount() };
  } catch (error) {
    console.error("Error reading PDF metadata:", error);
    throw new Error("Unable to parse PDF metadata.");
  }
}

/**
 * Converts range string formats like "1-3, 5, 8-10" into an array of page numbers
 */
function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  const parts = rangeStr.split(',');

  for (let part of parts) {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
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
 * Extracts specific pages from a PDF and applies custom rotations
 */
async function extractPdfPages(srcBuffer, selectedPages, rotations = {}) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib library is not loaded");
    const srcDoc = await window.PDFLib.PDFDocument.load(srcBuffer, { ignoreEncryption: true });
    const newPdf = await window.PDFLib.PDFDocument.create();

    const pageIndices = selectedPages.map((p) => p - 1);
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
 * Formats raw byte counts into human readable strings (KB, MB)
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PdfSplitter({ onSplitComplete, showToast }) {
  const [splitFile, setSplitFile] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [rangeInput, setRangeInput] = useState('');
  const [pageRotations, setPageRotations] = useState({});
  const [isSplitting, setIsSplitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileAdd = async (e) => {
    const file = (e.target.files || e.dataTransfer?.files || [])[0];
    if (!file || file.type !== 'application/pdf') {
      if (typeof showToast === 'function') {
        showToast('Please select a valid PDF file.', 'error');
      }
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

      if (typeof showToast === 'function') {
        showToast(`Loaded "${file.name}" (${pageCount} pages).`, 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Failed to parse PDF document.', 'error');
      }
    }
  };

  const togglePage = (pageNum) => {
    setSelectedPages((prev) => {
      const next = prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setRangeInput(next.join(', '));
      return next;
    });
  };

  const rotatePage = (pageNum) => {
    setPageRotations((prev) => ({
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
      if (typeof showToast === 'function') {
        showToast('Please select at least one page to extract.', 'error');
      }
      return;
    }

    setIsSplitting(true);
    try {
      const pdfUrl = await extractPdfPages(splitFile.buffer, selectedPages, pageRotations);
      const outputName = `Extracted_${splitFile.name}`;
      if (typeof onSplitComplete === 'function') {
        onSplitComplete(pdfUrl, outputName);
      }
      if (typeof showToast === 'function') {
        showToast(`Extracted ${selectedPages.length} pages successfully!`, 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Error occurred while extracting pages.', 'error');
      }
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!splitFile ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileAdd(e);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileAdd}
            accept="application/pdf"
            className="hidden"
          />
          <div className="flex flex-col items-center">
            <h3 className="mt-3 text-lg font-semibold text-slate-200">
              Select a PDF file to <span className="text-indigo-400">split or extract</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Extract specific pages, custom ranges, or re-orient individual pages.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active File Banner */}
          <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">{splitFile.name}</h3>
              <p className="text-xs text-slate-400">
                {splitFile.totalPages} Pages • {formatBytes(splitFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
            >
              Change File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileAdd}
              accept="application/pdf"
              className="hidden"
            />
          </div>

          {/* Range Selection Input */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-200">Page Selection</h4>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const all = Array.from({ length: splitFile.totalPages }, (_, i) => i + 1);
                    setSelectedPages(all);
                    setRangeInput(all.join(', '));
                  }}
                  className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPages([]);
                    setRangeInput('');
                  }}
                  className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              value={rangeInput}
              onChange={handleRangeInputChange}
              placeholder="e.g. 1-4, 7, 10-12"
              className="w-full bg-slate-900 border border-slate-700 text-sm rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Page Grid Matrix */}
          <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {Array.from({ length: splitFile.totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = selectedPages.includes(pageNum);
                const rot = pageRotations[pageNum] || 0;

                return (
                  <div
                    key={pageNum}
                    onClick={() => togglePage(pageNum)}
                    className={`relative cursor-pointer bg-slate-900 rounded-xl p-3 border-2 text-center transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'border-slate-800 opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(pageNum);
                      }}
                      className="absolute top-2 right-2 text-xs bg-slate-800 hover:bg-indigo-600 p-1 rounded text-slate-300"
                      title="Rotate Page"
                    >
                      ↻
                    </button>
                    <p className="text-lg font-bold text-slate-200 mt-2">Page {pageNum}</p>
                    {rot > 0 && <p className="text-xs text-amber-400">({rot}°)</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSplit}
              disabled={isSplitting || selectedPages.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSplitting
                ? 'Extracting Pages...'
                : `Extract Selected Pages (${selectedPages.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}import React, { useState, useRef } from 'react';

/**
 * Reads array buffer metadata for a PDF file using PDFLib
 */
async function getPdfMetadata(buffer) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib library is not loaded");
    const pdfDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    return { pageCount: pdfDoc.getPageCount() };
  } catch (error) {
    console.error("Error reading PDF metadata:", error);
    throw new Error("Unable to parse PDF metadata.");
  }
}

/**
 * Converts range string formats like "1-3, 5, 8-10" into an array of page numbers
 */
function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  const parts = rangeStr.split(',');

  for (let part of parts) {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
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
 * Extracts specific pages from a PDF and applies custom rotations
 */
async function extractPdfPages(srcBuffer, selectedPages, rotations = {}) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib library is not loaded");
    const srcDoc = await window.PDFLib.PDFDocument.load(srcBuffer, { ignoreEncryption: true });
    const newPdf = await window.PDFLib.PDFDocument.create();

    const pageIndices = selectedPages.map((p) => p - 1);
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
 * Formats raw byte counts into human readable strings (KB, MB)
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PdfSplitter({ onSplitComplete, showToast }) {
  const [splitFile, setSplitFile] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [rangeInput, setRangeInput] = useState('');
  const [pageRotations, setPageRotations] = useState({});
  const [isSplitting, setIsSplitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileAdd = async (e) => {
    const file = (e.target.files || e.dataTransfer?.files || [])[0];
    if (!file || file.type !== 'application/pdf') {
      if (typeof showToast === 'function') {
        showToast('Please select a valid PDF file.', 'error');
      }
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

      if (typeof showToast === 'function') {
        showToast(`Loaded "${file.name}" (${pageCount} pages).`, 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Failed to parse PDF document.', 'error');
      }
    }
  };

  const togglePage = (pageNum) => {
    setSelectedPages((prev) => {
      const next = prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setRangeInput(next.join(', '));
      return next;
    });
  };

  const rotatePage = (pageNum) => {
    setPageRotations((prev) => ({
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
      if (typeof showToast === 'function') {
        showToast('Please select at least one page to extract.', 'error');
      }
      return;
    }

    setIsSplitting(true);
    try {
      const pdfUrl = await extractPdfPages(splitFile.buffer, selectedPages, pageRotations);
      const outputName = `Extracted_${splitFile.name}`;
      if (typeof onSplitComplete === 'function') {
        onSplitComplete(pdfUrl, outputName);
      }
      if (typeof showToast === 'function') {
        showToast(`Extracted ${selectedPages.length} pages successfully!`, 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Error occurred while extracting pages.', 'error');
      }
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!splitFile ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileAdd(e);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileAdd}
            accept="application/pdf"
            className="hidden"
          />
          <div className="flex flex-col items-center">
            <h3 className="mt-3 text-lg font-semibold text-slate-200">
              Select a PDF file to <span className="text-indigo-400">split or extract</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Extract specific pages, custom ranges, or re-orient individual pages.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active File Banner */}
          <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">{splitFile.name}</h3>
              <p className="text-xs text-slate-400">
                {splitFile.totalPages} Pages • {formatBytes(splitFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
            >
              Change File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileAdd}
              accept="application/pdf"
              className="hidden"
            />
          </div>

          {/* Range Selection Input */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-200">Page Selection</h4>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const all = Array.from({ length: splitFile.totalPages }, (_, i) => i + 1);
                    setSelectedPages(all);
                    setRangeInput(all.join(', '));
                  }}
                  className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPages([]);
                    setRangeInput('');
                  }}
                  className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              value={rangeInput}
              onChange={handleRangeInputChange}
              placeholder="e.g. 1-4, 7, 10-12"
              className="w-full bg-slate-900 border border-slate-700 text-sm rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Page Grid Matrix */}
          <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {Array.from({ length: splitFile.totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = selectedPages.includes(pageNum);
                const rot = pageRotations[pageNum] || 0;

                return (
                  <div
                    key={pageNum}
                    onClick={() => togglePage(pageNum)}
                    className={`relative cursor-pointer bg-slate-900 rounded-xl p-3 border-2 text-center transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'border-slate-800 opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(pageNum);
                      }}
                      className="absolute top-2 right-2 text-xs bg-slate-800 hover:bg-indigo-600 p-1 rounded text-slate-300"
                      title="Rotate Page"
                    >
                      ↻
                    </button>
                    <p className="text-lg font-bold text-slate-200 mt-2">Page {pageNum}</p>
                    {rot > 0 && <p className="text-xs text-amber-400">({rot}°)</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSplit}
              disabled={isSplitting || selectedPages.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSplitting
                ? 'Extracting Pages...'
                : `Extract Selected Pages (${selectedPages.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}