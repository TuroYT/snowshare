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

function sharedFetch<T>(url: string): Promise<T> {
  const existing = inflightRequests.get(url) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    })
    .finally(() => inflightRequests.delete(url));
  inflightRequests.set(url, promise);
  return promise;
}

export function useFetch<T>(url: string | null, options?: FetchOptions): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  // Incremented on each fetch and on unmount: only the latest fetch may update state
  const counterRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetch_ = useCallback(async () => {
    if (!url) return;
    const id = ++counterRef.current;
    setLoading(true);
    setError(null);
    try {
      const json = await sharedFetch<T>(url);
      if (id === counterRef.current) {
        setData(json);
      }
    } catch (err) {
      if (id === counterRef.current) {
        setError(
          optionsRef.current?.errorMessage ?? (err instanceof Error ? err.message : "Unknown error")
        );
      }
    } finally {
      if (id === counterRef.current) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    const counter = counterRef;
    fetch_();
    return () => {
      // Ignore the response of a request started before unmount / url change
      counter.current++;
    };
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_, clearError: () => setError(null) };
}
