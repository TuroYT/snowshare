"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Upload as TusUpload } from "tus-js-client";

export interface TusAfterResponseHeaders {
  shareSlug: string | null;
  shareId: string | null;
  isBulk: string | null;
}

export interface StartTusUploadOptions {
  file: File;
  /** tus metadata (string values only) */
  metadata: Record<string, string>;
  /** Translates a server error code (from a `{ error: CODE }` response body) into a user-facing message. */
  translateErrorCode: (code: string) => string;
  /** Fallback message used when the browser doesn't support resumable uploads, or the error body can't be parsed. */
  networkErrorMessage: string;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onAfterResponse?: (headers: TusAfterResponseHeaders) => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * Resumable tus uploads for the file share form. tus-js-client is loaded lazily, and
 * every upload started through a hook instance is aborted on unmount.
 */
export function useTusUpload() {
  const activeUploadsRef = useRef<Set<TusUpload>>(new Set());
  // Set on unmount: an upload still waiting on the lazy import or on findPreviousUploads()
  // is not in activeUploads yet (or would be restarted by start()), so it must check this
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    const activeUploads = activeUploadsRef.current;
    return () => {
      unmountedRef.current = true;
      activeUploads.forEach((upload) => {
        // abort() may throw synchronously or return a rejected promise
        const logAbortError = (error: unknown) =>
          console.error("useTusUpload: error aborting upload on unmount:", error);
        try {
          Promise.resolve(upload.abort()).catch(logAbortError);
        } catch (error) {
          logAbortError(error);
        }
      });
      activeUploads.clear();
    };
  }, []);

  const startUpload = useCallback((options: StartTusUploadOptions): Promise<void> => {
    const {
      file,
      metadata,
      translateErrorCode,
      networkErrorMessage,
      onProgress,
      onAfterResponse,
      onSuccess,
      onError,
    } = options;

    return import("tus-js-client").then(
      (tus) =>
        new Promise<void>((resolve) => {
          if (unmountedRef.current) {
            resolve();
            return;
          }

          if (!tus.isSupported) {
            onError?.(networkErrorMessage);
            resolve();
            return;
          }

          let settled = false;
          const settle = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };

          const upload = new tus.Upload(file, {
            endpoint: "/api/tus",
            retryDelays: [0, 1000, 3000, 5000, 10000],
            chunkSize: 50 * 1024 * 1024,
            metadata,
            removeFingerprintOnSuccess: true,
            onShouldRetry(err) {
              const status = err?.originalResponse?.getStatus();
              if (status && status >= 400 && status < 500) return false;
              return true;
            },
            onError: (error: unknown) => {
              console.error("useTusUpload: tus upload error:", error);
              let errorMessage = networkErrorMessage;
              const tusError = error as {
                originalResponse?: { getBody?: () => string };
                message?: string;
              };
              const body = tusError?.originalResponse?.getBody?.();
              if (body) {
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.error) {
                    errorMessage = translateErrorCode(parsed.error);
                  }
                } catch (parseError) {
                  console.error("useTusUpload: error parsing tus error body:", parseError);
                  errorMessage = body;
                }
              }
              activeUploadsRef.current.delete(upload);
              onError?.(errorMessage);
              settle();
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              onProgress?.(bytesUploaded, bytesTotal);
            },
            onAfterResponse: (_req, res) => {
              onAfterResponse?.({
                shareSlug: res.getHeader("X-Share-Slug") || null,
                shareId: res.getHeader("X-Share-Id") || null,
                isBulk: res.getHeader("X-Is-Bulk") || null,
              });
            },
            onSuccess: () => {
              activeUploadsRef.current.delete(upload);
              onSuccess?.();
              settle();
            },
          });

          activeUploadsRef.current.add(upload);

          const startUnlessUnmounted = () => {
            if (unmountedRef.current) {
              activeUploadsRef.current.delete(upload);
              settle();
              return;
            }
            upload.start();
          };

          upload
            .findPreviousUploads()
            .then((previousUploads) => {
              if (previousUploads.length > 0 && !unmountedRef.current) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
              }
              startUnlessUnmounted();
            })
            .catch((error) => {
              console.error("useTusUpload: error finding previous uploads:", error);
              startUnlessUnmounted();
            });
        })
    );
  }, []);

  return { startUpload };
}
