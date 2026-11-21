"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export interface FetchOptions {
  errorMessage?: string;
}

// Identical concurrent GETs share one request. Shared requests are never aborted by a
// single consumer (that used to leave the other consumers with no data and no error).
const inflightRequests = new Map<string, Promise<unknown>>();

// `fresh` skips an in-flight request: a refetch after a mutation must not receive a
// response that was started before the mutation.
function sharedFetch<T>(url: string, fresh = false): Promise<T> {
  const existing = inflightRequests.get(url) as Promise<T> | undefined;
  if (existing && !fresh) return existing;

  const promise: Promise<T> = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    })
    .finally(() => {
      if (inflightRequests.get(url) === promise) inflightRequests.delete(url);
    });
  inflightRequests.set(url, promise);
  return promise;
}

export function useFetch<T>(url: string | null, options?: FetchOptions): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  // Incremented on each fetch and on unmount: only the latest fetch may update state
  const counterRef = useRef(0);
  // URL the current `data` belongs to: data is kept while revalidating the same URL
  const loadedUrlRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const load = useCallback(
    async (fresh: boolean) => {
      if (!url) return;
      const id = ++counterRef.current;
      if (loadedUrlRef.current !== url) {
        // First load, or the URL changed: the previous data no longer applies
        loadedUrlRef.current = null;
        setData(null);
        setLoading(true);
      }
      setError(null);
      try {
        const json = await sharedFetch<T>(url, fresh);
        if (id === counterRef.current) {
          loadedUrlRef.current = url;
          setData(json);
        }
      } catch (err) {
        if (id === counterRef.current) {
          setError(
            optionsRef.current?.errorMessage ??
              (err instanceof Error ? err.message : "Unknown error")
          );
        }
      } finally {
        if (id === counterRef.current) {
          setLoading(false);
        }
      }
    },
    [url]
  );

  const refetch = useCallback(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const counter = counterRef;
    void load(false);
    return () => {
      // Ignore the response of a request started before unmount / url change
      counter.current++;
    };
  }, [load]);

  return { data, loading, error, refetch, clearError: () => setError(null) };
}
