import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Reads array buffer metadata for a PDF file
 * @param {ArrayBuffer} buffer - The raw binary buffer of the PDF
 * @returns {Promise<{pageCount: number}>} Metadata object
 */
export async function getPdfMetadata(buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return { pageCount: pdfDoc.getPageCount() };
  } catch (error) {
    console.error("Error reading PDF metadata:", error);
    throw new Error("Unable to parse PDF metadata.");
  }
}

/**
 * Merges multiple PDF ArrayBuffers into a single downloadable PDF Blob URL
 * @param {ArrayBuffer[]} buffers - Array of PDF buffers in target merge order
 * @returns {Promise<string>} Object URL for the merged PDF Blob
 */
export async function mergePdfBuffers(buffers) {
  try {
    const mergedPdf = await PDFDocument.create();

    for (const buffer of buffers) {
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
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
 * Converts range string formats like "1-3, 5, 8-10" into an array of page numbers
 * @param {string} rangeStr - User range input string
 * @param {number} totalPages - Max total pages in document
 * @returns {number[]} Array of 1-indexed page numbers
 */
export function parsePageRange(rangeStr, totalPages) {
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
 * Extracts specific pages from a PDF and applies custom rotations
 * @param {ArrayBuffer} srcBuffer - Original PDF buffer
 * @param {number[]} selectedPages - Array of 1-indexed selected pages
 * @param {Record<number, number>} rotations - Rotation angles by page number
 * @returns {Promise<string>} Object URL for extracted PDF Blob
 */
export async function extractPdfPages(srcBuffer, selectedPages, rotations = {}) {
  try {
    const srcDoc = await PDFDocument.load(srcBuffer, { ignoreEncryption: true });
    const newPdf = await PDFDocument.create();

    const pageIndices = selectedPages.map(p => p - 1);
    const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);

    copiedPages.forEach((page, idx) => {
      const originalPageNum = selectedPages[idx];
      const rot = rotations[originalPageNum] || 0;
      if (rot !== 0) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + rot));
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
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}