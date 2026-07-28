PDF Studio Pro

A web-based PDF manipulation application built with React and Vite that allows users to merge and split PDF documents directly in the browser.

All document processing happens locally on the client side using WebAssembly and Web APIs. No files are uploaded to external servers.

Features

Client-Side Privacy: Files are processed locally in your browser to maintain data security.

PDF Merger: Drag and drop multiple PDF documents, reorder files, and combine them into a single output file.

Page Splitting & Extraction: Extract specific page ranges (e.g., 1-4, 7, 10-12) or individual pages using rendered visual thumbnails.

Page Rotation: Re-orient individual pages prior to extraction.

In-App Preview: Built-in modal viewer to inspect generated PDFs before downloading.

Directory Structure

pdf-studio-pro/
├── public/
│ └── favicon.ico
├── src/
│ ├── components/
│ │ ├── Header.jsx # Top navigation & branded header
│ │ ├── PdfMerger.jsx # File drag-and-drop queue & merge controls
│ │ ├── PdfSplitter.jsx # Visual page picker, rotation, & extraction
│ │ └── PreviewModal.jsx # Blob preview viewer modal
│ ├── utils/
│ │ └── pdfHelpers.js # Core PDF-Lib & PDF.js utility functions
│ ├── App.jsx # Application state container
│ ├── index.css # Tailwind CSS directives
│ └── main.jsx # React root entry point
├── package.json
├── tailwind.config.js
└── README.md

Tech Stack

Framework: React 18 + Vite

Styling: Tailwind CSS

PDF Core Engines:

pdf-lib for binary PDF manipulation (merge, split, rotate)

pdfjs-dist for thumbnail canvas rendering

Getting Started

Prerequisites

Node.js (v18.0 or higher)

npm or yarn

Installation

Clone the repository:

git clone https://github.com/DesmondYim/pdf-studio-pro.git
cd pdf-studio-pro

Install dependencies:

npm install

Start the local development server:

npm run dev

Open http://localhost:5173 in your browser.

License

Distributed under the MIT License. See LICENSE for more information.
