"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useTranslation } from "react-i18next";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    fileUrl: string;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
    const { t } = useTranslation();
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setLoading(false);
        setError(null);
    }

    function onDocumentLoadError(error: Error) {
        console.error("PDF load error:", error);
        setError(t("file_preview.pdf_load_error", "Failed to load PDF"));
        setLoading(false);
    }

    const goToPrevPage = () => {
        setPageNumber((prev) => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber((prev) => Math.min(prev + 1, numPages));
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-900/20 border border-red-800 mb-4">
                        <svg
                            className="h-8 w-8 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {loading && (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
                        <p className="text-[var(--foreground-muted)]">{t("loading", "Loading")}...</p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto bg-[var(--background)] rounded-lg flex items-center justify-center p-4">
                <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading=""
                    className="flex justify-center"
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-lg"
                        width={Math.min(window.innerWidth * 0.8, 800)}
                    />
                </Document>
            </div>

            {numPages > 0 && (
                <div className="flex items-center justify-center gap-4 py-4 bg-[var(--surface)] rounded-b-lg border-t border-[var(--border)]">
                    <button
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label={t("file_preview.previous_page", "Previous page")}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <span className="text-[var(--foreground)] font-medium">
                        {t("file_preview.page_of", "Page {{current}} of {{total}}", {
                            current: pageNumber,
                            total: numPages
                        })}
                    </span>

                    <button
                        onClick={goToNextPage}
                        disabled={pageNumber >= numPages}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label={t("file_preview.next_page", "Next page")}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
