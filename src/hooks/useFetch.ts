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

const inflightRequests = new Map<string, Promise<unknown>>();

export function useFetch<T>(url: string | null, options?: FetchOptions): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const abortRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(async () => {
    if (!url) return;
    abortRef.current?.abort();
    const id = ++counterRef.current;
    setLoading(true);
    setError(null);
    try {
      const existing = inflightRequests.get(url) as Promise<T> | undefined;
      let promise: Promise<T>;
      if (existing) {
        abortRef.current = null;
        promise = existing;
      } else {
        const controller = new AbortController();
        abortRef.current = controller;
        promise = fetch(url, { signal: controller.signal }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<T>;
        });
        inflightRequests.set(url, promise);
        promise.finally(() => inflightRequests.delete(url));
      }
      const json = await promise;
      if (id === counterRef.current) {
        setData(json);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
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
  }, [url]);

  useEffect(() => {
    fetch_();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_, clearError: () => setError(null) };
}
