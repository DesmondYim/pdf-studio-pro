import React, { useRef, useState } from 'react';

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

async function mergePdfBuffers(buffers) {
  try {
    if (!window.PDFLib) throw new Error("PDFLib library is not loaded");
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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * PdfMerger Component
 * Manages PDF drag-and-drop file queueing, reordering, and client-side merging.
 */
export default function PdfMerger({ onMergeComplete, showToast }) {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [outputName, setOutputName] = useState('Merged_Document.pdf');
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
        if (typeof showToast === 'function') showToast(`Failed to load file: ${file.name}`, 'error');
      }
    }

    setFiles(prev => [...prev, ...loadedFiles]);
    if (typeof showToast === 'function') {
      showToast(`Added ${loadedFiles.length} file(s) to merger queue.`, 'success');
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
      if (typeof showToast === 'function') showToast('Please add at least 2 PDF files to merge.', 'error');
      return;
    }

    setIsMerging(true);
    try {
      const buffers = files.map(f => f.buffer);
      const pdfUrl = await mergePdfBuffers(buffers);
      if (typeof onMergeComplete === 'function') {
        onMergeComplete(pdfUrl, outputName);
      }
      if (typeof showToast === 'function') showToast('PDF files merged successfully!', 'success');
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Failed to merge PDFs. One of the files might be corrupted.', 'error');
      }
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = files.reduce((acc, f) => acc + f.pageCount, 0);
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-6">
      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleAddFiles(e);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAddFiles}
          multiple
          accept="application/pdf"
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="p-4 bg-slate-800 rounded-full group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-200">
            Drop PDF files here, or <span className="text-indigo-400">browse</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">Select multiple documents to combine into a single PDF.</p>
        </div>
      </div>

      {/* Queue List Display */}
      {files.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div>
              <h3 className="font-semibold text-slate-200">Merge Queue ({files.length} files)</h3>
              <p className="text-xs text-slate-400">Re-order files before combining.</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              Total Pages: <span className="text-indigo-400 font-medium">{totalPages}</span> | Size: {formatBytes(totalSize)}
            </div>
          </div>

          <div className="space-y-2">
            {files.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className="text-xs font-mono w-6 text-center text-slate-500 font-semibold">{idx + 1}</span>
                  <div className="truncate">
                    <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.pageCount} pages • {formatBytes(item.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => moveFile(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30"
                    title="Move Up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(idx, 1)}
                    disabled={idx === files.length - 1}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30"
                    title="Move Down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded"
                    title="Remove File"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-700/60">
            <div className="w-full sm:w-auto flex items-center space-x-2">
              <label className="text-xs text-slate-400 whitespace-nowrap">Output Name:</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-200 w-full sm:w-64"
              />
            </div>

            <button
              type="button"
              onClick={handleMerge}
              disabled={isMerging}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center transition-all disabled:opacity-50"
            >
              {isMerging ? 'Merging PDFs...' : 'Merge PDFs'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}