"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Modal from "@/components/ui/Modal";
import { useTranslation } from "react-i18next";

const FilePreview = dynamic(() => import("reactjs-file-preview"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
                <p className="text-[var(--foreground-muted)]">Loading preview...</p>
            </div>
        </div>
    )
});

const PdfViewer = dynamic(() => import("./PdfViewer"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
                <p className="text-[var(--foreground-muted)]">Loading PDF...</p>
            </div>
        </div>
    )
});

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
}

const SUPPORTED_EXTENSIONS = [
    // Images
    "jpg", "jpeg", "png", "gif", "webp",
    // Documents
    "pdf",
    // Video
    "mp4", "webm", "ogg"
];

export default function FilePreviewModal({ isOpen, onClose, fileUrl, fileName }: FilePreviewModalProps) {
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [fileExtension, setFileExtension] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            setError(null);
            const extension = fileName.split(".").pop()?.toLowerCase() || "";
            setFileExtension(extension);
            const supported = SUPPORTED_EXTENSIONS.includes(extension);
            setIsSupported(supported);

            if (!supported) {
                setError(t("file_preview.unsupported_format", "This file type is not supported for preview"));
            }
        }
    }, [isOpen, fileName, t]);

    const isPdf = fileExtension === "pdf";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={fileName}
            size="xl"
        >
            <div className="min-h-[400px] flex flex-col">
                {error ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-yellow-900/20 border border-yellow-800 mb-4">
                                <svg
                                    className="h-8 w-8 text-yellow-400"
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
                            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                                {t("file_preview.preview_unavailable", "Preview Unavailable")}
                            </h3>
                            <p className="text-[var(--foreground-muted)] mb-4">{error}</p>
                            {!isSupported && (
                                <div className="text-sm text-[var(--foreground-muted)] bg-[var(--background)] rounded-lg p-3 border border-[var(--border)]">
                                    <p className="font-medium mb-2">
                                        {t("file_preview.supported_formats", "Supported formats:")}
                                    </p>
                                    <p className="text-xs">
                                        Images (jpg, png, gif, webp), Documents (pdf), Videos (mp4, webm, ogg)
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : isPdf ? (
                    <div className="flex-1 overflow-hidden">
                        <PdfViewer fileUrl={fileUrl} />
                    </div>
                ) : (
                    <div className="flex-1 bg-[var(--background)] rounded-lg overflow-hidden">
                        <FilePreview
                            preview={fileUrl}
                            errorImage="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23374151' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%239ca3af'%3EError loading file%3C/text%3E%3C/svg%3E"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
}
