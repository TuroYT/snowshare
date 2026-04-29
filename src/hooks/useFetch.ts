"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface FetchOptions {
  /** Message d'erreur traduit à afficher en cas d'échec de la requête */
  errorMessage?: string;
}

export function useFetch<T>(url: string | null, options?: FetchOptions): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetch_ = useCallback(async () => {
    if (!url) return;
    const id = ++counterRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: T = await res.json();
      if (id === counterRef.current) {
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
  }, [url]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
